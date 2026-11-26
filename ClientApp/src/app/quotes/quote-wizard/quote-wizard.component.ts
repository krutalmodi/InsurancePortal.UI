import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription, forkJoin } from 'rxjs';
import { FeatureService } from '../../core/feature.service';
import { errorMessage } from '../../core/error-message';
import { LocationService, LookupItem } from '../../core/location.service';
import { Field, FieldValue, addressFields, makeForm, productFields } from '../quote-fields';
import { CreateResult } from '../quote.model';
import { QuoteLookupService } from '../quote-lookup.service';
import { QuoteService } from '../quote.service';

@Component({
  selector: 'app-quote-wizard',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './quote-wizard.component.html',
})
export class QuoteWizardPage {
  readonly features = inject(FeatureService);
  private readonly quoteService = inject(QuoteService);
  private readonly locationService = inject(LocationService);
  private readonly quoteLookups = inject(QuoteLookupService);
  private readonly changeDetector = inject(ChangeDetectorRef);
  readonly steps = ['Product', 'Address', 'Details', 'Review'];
  readonly products = ['Auto', 'Home', 'Health'];
  readonly addressFields = addressFields;
  step = 0;
  product = '';
  address = makeForm(addressFields);
  details = makeForm([]);
  error = '';
  busy = false;
  created?: CreateResult;
  lookups: Record<string, LookupItem[]> = { countryId: [], provinceId: [], locationTypeId: [] };
  lookupError = '';
  loadingLookups = false;
  loadingProvinces = false;
  loadingProduct = 0;
  loadingDependent = false;
  constructor() {
    this.features.load();
    this.loadLookups();
    this.address.controls['countryId'].valueChanges.subscribe((value) => this.loadProvinces(value));
  }
  loadLookups(): void {
    this.lookupError = '';
    this.loadingLookups = true;
    forkJoin({
      countries: this.locationService.countries(),
      types: this.locationService.locationTypes(),
    }).subscribe({
      next: ({ countries, types }) => {
        this.lookups['countryId'] = countries;
        this.lookups['locationTypeId'] = types;
        this.loadingLookups = false;
        this.changeDetector.markForCheck();
      },
      error: (e) => {
        this.lookupError = errorMessage(e);
        this.loadingLookups = false;
        this.changeDetector.markForCheck();
      },
    });
  }
  private loadProvinces(countryId: FieldValue): void {
    this.provinceRequest?.unsubscribe();
    this.lookups['provinceId'] = [];
    this.address.controls['provinceId'].setValue(null);
    if (typeof countryId !== 'number') return;
    this.lookupError = '';
    this.loadingProvinces = true;
    this.provinceRequest = this.locationService.provinces(countryId).subscribe({
      next: (provinces) => {
        this.lookups['provinceId'] = provinces;
        this.loadingProvinces = false;
        this.changeDetector.markForCheck();
      },
      error: (e) => {
        this.lookupError = errorMessage(e);
        this.loadingProvinces = false;
        this.changeDetector.markForCheck();
      },
    });
  }
  retryLookups(): void {
    this.loadLookups();
    const country = this.address.controls['countryId'].value;
    if (typeof country === 'number') this.loadProvinces(country);
    this.loadProductLookups();
  }
  private loadProductLookups(): void {
    for (const field of this.selectedFields) {
      if (!field.lookup || !this.isVisible(field)) continue;
      this.lookups[field.key] = [];
      if (field.dependsOn) {
        const parent = this.details.controls[field.dependsOn].value;
        if (typeof parent === 'number') this.loadDependent(field, parent);
        continue;
      }
      this.loadFieldLookup(field);
    }
  }
  private loadFieldLookup(field: Field): void {
    this.loadingProduct++;
    this.quoteLookups.get(field.lookup!).subscribe({
      next: (items) => {
        this.lookups[field.key] = items;
        this.loadingProduct--;
        this.changeDetector.markForCheck();
      },
      error: (e) => {
        this.lookupError = errorMessage(e);
        this.loadingProduct--;
        this.changeDetector.markForCheck();
      },
    });
  }
  private watchDependents(): void {
    for (const field of this.selectedFields) {
      const condition = field.showIf;
      if (condition) {
        this.details.controls[condition.key].valueChanges.subscribe(() => {
          const control = this.details.controls[field.key];
          if (this.isVisible(field)) {
            control.enable();
            if (!this.lookups[field.key]?.length) this.loadFieldLookup(field);
          } else {
            control.setValue(null);
            control.disable();
          }
          this.changeDetector.markForCheck();
        });
      }
      const parentKey = field.dependsOn;
      if (!parentKey) continue;
      this.details.controls[parentKey].valueChanges.subscribe((value) => {
        this.dependentRequest?.unsubscribe();
        this.lookups[field.key] = [];
        this.details.controls[field.key].setValue(null);
        if (typeof value === 'number') this.loadDependent(field, value);
      });
    }
  }
  private loadDependent(field: Field, parent: number): void {
    this.lookupError = '';
    this.loadingDependent = true;
    this.dependentRequest = this.quoteLookups.get(field.lookup!, parent).subscribe({
      next: (items) => {
        this.lookups[field.key] = items;
        this.loadingDependent = false;
        this.changeDetector.markForCheck();
      },
      error: (e) => {
        this.lookupError = errorMessage(e);
        this.loadingDependent = false;
        this.changeDetector.markForCheck();
      },
    });
  }
  isVisible(field: Field): boolean {
    return !field.showIf || this.details.controls[field.showIf.key]?.value === field.showIf.equals;
  }
  isLoading(field: Field): boolean {
    if (field.options) return false;
    if (field.dependsOn) return this.loadingDependent;
    if (field.key === 'provinceId') return this.loadingProvinces;
    return field.lookup ? this.loadingProduct > 0 : this.loadingLookups;
  }
  emptyLabel(field: Field): string {
    if (this.isLoading(field)) return 'Loading...';
    const parentKey = field.dependsOn ?? (field.key === 'provinceId' ? 'countryId' : '');
    const parentForm = field.dependsOn ? this.details : this.address;
    if (parentKey && !parentForm.value[parentKey]) {
      const parent = [...addressFields, ...this.selectedFields].find((f) => f.key === parentKey);
      return 'Select ' + (parent?.label.toLowerCase() ?? 'a value') + ' first';
    }
    return 'Select ' + field.label.toLowerCase();
  }
  optionValue(field: Field, item: LookupItem): FieldValue {
    return (field.valueBy === 'code' ? item.code : item.id) ?? null;
  }
  optionLabel(field: Field, value: FieldValue | undefined): string {
    const fixed = field.options?.find((option) => option.value === value);
    if (fixed) return fixed.label;
    const match = this.lookups[field.key]?.find((item) => this.optionValue(field, item) === value);
    return match?.name ?? this.display(value);
  }
  private provinceRequest?: Subscription;
  private dependentRequest?: Subscription;
  get selectedFields(): Field[] {
    return productFields[this.product] ?? [];
  }
  get visibleFields(): Field[] {
    return this.currentFields.filter((field) => this.isVisible(field));
  }
  get currentFields(): Field[] {
    return this.step === 1 ? addressFields : this.selectedFields;
  }
  get currentForm(): FormGroup {
    return this.step === 1 ? this.address : this.details;
  }
  selectProduct(name: string): void {
    if (this.product !== name) {
      this.product = name;
      this.details = makeForm(productFields[name]);
      this.dependentRequest?.unsubscribe();
      this.loadingDependent = false;
      this.loadingProduct = 0;
      this.watchDependents();
      this.loadProductLookups();
    }
    this.step = 1;
  }
  next(): void {
    this.currentForm.markAllAsTouched();
    if (this.currentForm.valid) {
      this.error = '';
      this.step++;
    } else this.error = 'Please complete all required fields with valid values.';
  }
  back(): void {
    this.error = '';
    this.step--;
  }
  display(value: FieldValue | undefined): string {
    return value === true
      ? 'Yes'
      : value === false
        ? 'No'
        : value == null || value === ''
          ? '—'
          : String(value);
  }
  submit(): void {
    if (
      !this.features.quoteCreationEnabled() ||
      this.busy ||
      this.step !== 3 ||
      !this.products.includes(this.product) ||
      this.address.invalid ||
      this.details.invalid
    )
      return;
    const type = this.product === 'Auto' ? 1 : this.product === 'Home' ? 2 : 3;
    const key = this.product.toLowerCase() + 'Quote';
    const payload: Record<string, FieldValue> = {};
    for (const field of this.selectedFields) {
      const control = this.details.controls[field.key];
      if (field.uiOnly || control.disabled) continue;
      payload[field.key] = field.toPayload ? field.toPayload(control.value) : control.value;
    }
    const request = {
      productType: type,
      [key]: { ...payload, location: this.address.value },
    };
    this.error = '';
    this.busy = true;
    this.quoteService.create(request).subscribe({
      next: (result) => {
        this.created = result;
        this.busy = false;
        this.step = 4;
        this.changeDetector.markForCheck();
      },
      error: (e) => {
        this.busy = false;
        this.error = errorMessage(e);
        this.changeDetector.markForCheck();
      },
    });
  }
}

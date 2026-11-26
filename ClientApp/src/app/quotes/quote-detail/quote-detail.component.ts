import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable, catchError, forkJoin, of } from 'rxjs';
import { errorMessage } from '../../core/error-message';
import { FeatureService } from '../../core/feature.service';
import { LocationService, LookupItem } from '../../core/location.service';
import { Product, Quote, productName } from '../quote.model';
import { QuoteLookupService, QuoteLookupType } from '../quote-lookup.service';
import { QuoteService } from '../quote.service';

export interface DetailRow {
  label: string;
  value: string;
  hint?: string;
}
export interface DetailSection {
  title: string;
  rows: DetailRow[];
}
export interface RatingFactor {
  type: string;
  input: string;
  multiplier: string;
  amountAfter: string;
}

type LookupKey = QuoteLookupType | 'countries' | 'provinces' | 'location-types';

@Component({
  selector: 'app-quote-detail',
  imports: [CommonModule, RouterLink],
  templateUrl: './quote-detail.component.html',
})
export class QuoteDetailPage {
  readonly features = inject(FeatureService);
  private readonly quoteService = inject(QuoteService);
  private readonly quoteLookups = inject(QuoteLookupService);
  private readonly locations = inject(LocationService);
  private readonly route = inject(ActivatedRoute);
  private readonly changeDetector = inject(ChangeDetectorRef);
  readonly productName = productName;
  quote?: Quote;
  sections: DetailSection[] = [];
  ratingRows: DetailRow[] = [];
  statusName = '';
  statusHint = '';
  currencyCode = '';
  lookupWarning = false;
  loading = false;
  busy = false;
  confirming = false;
  accepted = false;
  error = '';
  actionError = '';
  private lookups: Partial<Record<LookupKey, LookupItem[]>> = {};

  constructor() {
    this.features.getFeatures().subscribe({
      next: (f) => {
        this.features.quotesEnabled.set(f.quotesEnabled);
        this.features.error.set('');
        this.changeDetector.markForCheck();
      },
      error: () => {
        // Details are readable without the flag; only acceptance depends on it.
        this.features.quotesEnabled.set(false);
        this.changeDetector.markForCheck();
      },
    });
    this.loadQuote();
  }

  get canAccept(): boolean {
    return (
      this.features.quotesEnabled() &&
      !!this.quote &&
      this.quote.status?.toLowerCase() === 'quoted' &&
      Date.parse(this.quote.validUntil) > Date.now()
    );
  }
  get product(): Product | undefined {
    return this.quote?.autoQuote ?? this.quote?.homeQuote ?? this.quote?.healthQuote;
  }
  get premium(): number {
    const product = this.product;
    return this.quote?.totalPremium ?? (product?.['quotedPremium'] as number) ?? 0;
  }

  loadQuote(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error = 'Quote ID is missing.';
      this.changeDetector.markForCheck();
      return;
    }
    this.loading = true;
    this.error = '';
    this.changeDetector.markForCheck();
    // The user-scoped list is used because the Quote Service derives the user from the token.
    this.quoteService.getMine().subscribe({
      next: (quotes) => {
        const match = quotes.find((q) => q.id === id);
        if (!match) {
          this.error = 'This quote was not found in your quotes.';
          this.loading = false;
          this.changeDetector.markForCheck();
          return;
        }
        this.quote = match;
        this.loadLookups(match);
      },
      error: (e) => {
        this.error = errorMessage(e);
        this.loading = false;
        this.changeDetector.markForCheck();
      },
    });
  }

  private loadLookups(quote: Quote): void {
    const product = quote.autoQuote ?? quote.homeQuote ?? quote.healthQuote;
    const location = product?.location as Record<string, unknown> | undefined;
    const makeId = Number(quote.autoQuote?.['vehicleMakeId']) || undefined;
    const countryId = Number(location?.['countryId']) || undefined;
    const requests: Partial<Record<LookupKey, Observable<LookupItem[]>>> = {
      'quote-statuses': this.quoteLookups.get('quote-statuses'),
      currencies: this.quoteLookups.get('currencies'),
      countries: this.locations.countries(),
      'location-types': this.locations.locationTypes(),
    };
    if (countryId) requests.provinces = this.locations.provinces(countryId);
    if (quote.autoQuote) {
      requests['vehicle-makes'] = this.quoteLookups.get('vehicle-makes');
      requests['vehicle-models'] = this.quoteLookups.get('vehicle-models', makeId);
      requests['vehicle-colors'] = this.quoteLookups.get('vehicle-colors');
      requests['vehicle-types'] = this.quoteLookups.get('vehicle-types');
      requests['driving-record-types'] = this.quoteLookups.get('driving-record-types');
    } else if (quote.homeQuote) {
      requests['home-types'] = this.quoteLookups.get('home-types');
    } else if (quote.healthQuote) {
      requests['health-statuses'] = this.quoteLookups.get('health-statuses');
      requests['coverage-types'] = this.quoteLookups.get('coverage-types');
    }
    const keys = Object.keys(requests) as LookupKey[];
    let failed = false;
    forkJoin(
      keys.map((key) =>
        requests[key]!.pipe(
          catchError(() => {
            failed = true;
            return of([] as LookupItem[]);
          }),
        ),
      ),
    ).subscribe((results) => {
      keys.forEach((key, i) => (this.lookups[key] = results[i]));
      this.lookupWarning = failed;
      this.build(quote);
      this.loading = false;
      this.changeDetector.markForCheck();
    });
  }

  private find(key: LookupKey, value: unknown): LookupItem | undefined {
    if (value === null || value === undefined || value === '') return undefined;
    const text = String(value).toLowerCase();
    return this.lookups[key]?.find(
      (item) => String(item.id).toLowerCase() === text || item.code?.toLowerCase() === text,
    );
  }
  private lookupRow(label: string, key: LookupKey, value: unknown): DetailRow {
    const item = this.find(key, value);
    return {
      label,
      value: item?.name ?? this.text(value),
      hint: item?.description && item.description !== item.name ? item.description : undefined,
    };
  }
  private text(value: unknown, suffix = ''): string {
    if (value === null || value === undefined || value === '') return '—';
    return typeof value === 'number' ? `${value.toLocaleString('en-US')}${suffix}` : String(value);
  }
  private yesNo(value: unknown): string {
    return value === null || value === undefined ? '—' : value ? 'Yes' : 'No';
  }

  private build(quote: Quote): void {
    const status = this.find('quote-statuses', quote.status);
    this.statusName = status?.name ?? quote.status ?? '—';
    this.statusHint = status?.description ?? '';
    const product = (quote.autoQuote ?? quote.homeQuote ?? quote.healthQuote) as
      Product | undefined;
    const rating = product?.rating as Record<string, unknown> | undefined;
    const currency =
      this.find('currencies', rating?.['currencyId']) ??
      this.find('currencies', rating?.['currency']);
    this.currencyCode = currency?.code ?? (rating?.['currency'] as string) ?? '';
    const sections: DetailSection[] = [];
    if (product) {
      const p = product;
      if (quote.autoQuote) {
        sections.push({
          title: 'Vehicle',
          rows: [
            this.lookupRow('Make', 'vehicle-makes', p['vehicleMakeId']),
            this.lookupRow('Model', 'vehicle-models', p['vehicleModelId']),
            this.lookupRow('Vehicle type', 'vehicle-types', p['vehicleTypeId']),
            this.lookupRow('Color', 'vehicle-colors', p['vehicleColorId']),
            { label: 'Year', value: this.text(p['year']).replace(',', '') },
            { label: 'VIN', value: this.text(p['vin']) },
            { label: 'Current mileage', value: this.text(p['mileage'], ' mi') },
          ],
        });
        sections.push({
          title: 'Driving profile',
          rows: [
            this.lookupRow('Driving record', 'driving-record-types', p['drivingRecord']),
            { label: 'Number of drivers', value: this.text(p['numberOfDrivers']) },
            {
              label: 'Estimated annual mileage',
              value: this.text(p['estimatedAnnualMileage'], ' mi'),
            },
            { label: 'At-fault accidents', value: this.text(p['atFaultAccidentCount']) },
            { label: 'Speeding tickets', value: this.text(p['speedingTicketCount']) },
          ],
        });
      } else if (quote.homeQuote) {
        sections.push({
          title: 'Home',
          rows: [
            this.lookupRow('Home type', 'home-types', p['homeType']),
            { label: 'Year built', value: this.text(p['yearBuilt']).replace(',', '') },
            { label: 'Square footage', value: this.text(p['squareFootage'], ' sq ft') },
            { label: 'Home value', value: this.money(p['homeValue']) },
            { label: 'Number of occupants', value: this.text(p['numberOfOccupants']) },
            { label: 'Security system', value: this.yesNo(p['hasSecuritySystem']) },
            { label: 'Fire alarm', value: this.yesNo(p['hasFireAlarm']) },
          ],
        });
      } else {
        sections.push({
          title: 'Health',
          rows: [
            { label: 'Age', value: this.text(p['age']) },
            this.lookupRow('Health status', 'health-statuses', p['healthStatus']),
            this.lookupRow('Coverage type', 'coverage-types', p['coverageType']),
            { label: 'Pre-existing conditions', value: this.yesNo(p['hasPreexistingConditions']) },
            { label: 'Smoker', value: this.yesNo(p['smoker']) },
            { label: 'Dependents', value: this.text(p['dependents']) },
          ],
        });
      }
      const loc = product.location as Record<string, unknown> | undefined;
      if (loc) {
        const street = [loc['streetAddress1'], loc['streetAddress2']].filter(Boolean).join(', ');
        sections.push({
          title: 'Address',
          rows: [
            { label: 'Street address', value: this.text(street) },
            { label: 'Unit / suite', value: this.text(loc['unitNumber']) },
            { label: 'City', value: this.text(loc['city']) },
            this.lookupRow('Province / state', 'provinces', loc['provinceId']),
            { label: 'Postal / ZIP code', value: this.text(loc['postalCode']) },
            this.lookupRow('Country', 'countries', loc['countryId']),
            this.locationTypeRow(loc['locationTypeId']),
          ],
        });
      }
    }
    this.sections = sections;
    this.ratingRows = rating
      ? [
          { label: 'Currency', value: currency?.name ?? this.text(rating['currency']) },
          { label: 'Term', value: this.text(rating['termMonths'], ' months') },
          { label: 'Total premium', value: this.money(this.premium) },
        ]
      : [];
  }

  // The Location Service returns numeric type ids but the Quote contract declares a GUID.
  private locationTypeRow(value: unknown): DetailRow {
    const item = this.find('location-types', value);
    return { label: 'Location type', value: item?.name ?? '—' };
  }
  private money(value: unknown): string {
    if (typeof value !== 'number') return '—';
    const amount = value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return this.currencyCode ? `${amount} ${this.currencyCode}` : amount;
  }

  accept(): void {
    if (!this.quote || this.busy || !this.canAccept) return;
    this.busy = true;
    this.actionError = '';
    this.quoteService.accept(this.quote.id).subscribe({
      next: (q) => {
        this.quote = { ...this.quote, ...q };
        this.build(this.quote);
        this.accepted = true;
        this.confirming = false;
        this.busy = false;
        this.changeDetector.markForCheck();
      },
      error: (e) => {
        this.actionError = errorMessage(e);
        this.busy = false;
        this.changeDetector.markForCheck();
      },
    });
  }
}

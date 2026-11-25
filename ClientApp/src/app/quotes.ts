import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FeatureService, SessionService, errorMessage } from './core';

interface Quote { id: string; userId: string; referenceNumber: string; createdAt: string; validUntil: string; totalPremium: number; status: string; autoQuote?: Product; homeQuote?: Product; healthQuote?: Product }
interface Product { location?: Record<string, unknown>; rating?: Record<string, unknown>; [key: string]: unknown }
interface CreateResult { quote: Quote; referenceNumber: string }
interface Field { key: string; label: string; type: 'text' | 'number' | 'boolean'; min?: number; optional?: boolean }
const addressFields: Field[] = [
  { key: 'streetAddress1', label: 'Street address', type: 'text' }, { key: 'streetAddress2', label: 'Address line 2', type: 'text', optional: true },
  { key: 'unitNumber', label: 'Unit / suite', type: 'text', optional: true }, { key: 'city', label: 'City', type: 'text' },
  { key: 'postalCode', label: 'Postal / ZIP code', type: 'text' }, { key: 'countryId', label: 'Country reference ID', type: 'number', min: 1 },
  { key: 'provinceId', label: 'Province / state reference ID', type: 'number', min: 1 }, { key: 'locationTypeId', label: 'Location type reference ID', type: 'number', min: 1 }
];
const productFields: Record<string, Field[]> = {
  Auto: [ {key:'vin',label:'VIN',type:'text'}, {key:'vehicleMakeId',label:'Vehicle make reference ID',type:'number',min:1}, {key:'vehicleModelId',label:'Vehicle model reference ID',type:'number',min:1}, {key:'vehicleColorId',label:'Vehicle color reference ID',type:'number',min:1}, {key:'vehicleTypeId',label:'Vehicle type reference ID',type:'number',min:1}, {key:'year',label:'Vehicle year',type:'number',min:1}, {key:'mileage',label:'Mileage',type:'number',min:0}, {key:'drivingRecord',label:'Driving record',type:'text'}, {key:'numberOfDrivers',label:'Number of drivers',type:'number',min:1}, {key:'estimatedAnnualMileage',label:'Estimated annual mileage',type:'number',min:0}, {key:'atFaultAccidents',label:'At-fault accidents',type:'number',min:0}, {key:'speedingTickets',label:'Speeding tickets',type:'number',min:0} ],
  Home: [ {key:'squareFootage',label:'Square footage',type:'number',min:1}, {key:'yearBuilt',label:'Year built',type:'number',min:1}, {key:'homeType',label:'Home type',type:'text'}, {key:'homeValue',label:'Home value',type:'number',min:1}, {key:'numberOfOccupants',label:'Number of occupants',type:'number',min:1}, {key:'hasSecuritySystem',label:'Security system',type:'boolean'}, {key:'hasFireAlarm',label:'Fire alarm',type:'boolean'} ],
  Health: [ {key:'age',label:'Age',type:'number',min:0}, {key:'healthStatus',label:'Health status',type:'text'}, {key:'coverageType',label:'Coverage type',type:'text'}, {key:'dependents',label:'Number of dependents',type:'number',min:0}, {key:'hasPreexistingConditions',label:'Pre-existing conditions',type:'boolean'}, {key:'smoker',label:'Smoker',type:'boolean'} ]
};
type FieldValue = string | number | boolean | null;
function makeForm(fields: Field[]): FormGroup {
  const controls: Record<string, FormControl<FieldValue>> = {};
  for (const field of fields) controls[field.key] = new FormControl<FieldValue>(null, [ ...(field.optional ? [] : [Validators.required]), ...(field.min === undefined ? [] : [Validators.min(field.min)]) ]);
  return new FormGroup(controls);
}
function productName(quote: Quote): string { return quote.autoQuote ? 'Auto' : quote.homeQuote ? 'Home' : quote.healthQuote ? 'Health' : 'Unknown'; }

@Component({ selector: 'app-quote-list', imports: [CommonModule, RouterLink], template: `
<div class="page-heading"><div><span class="eyebrow">YOUR COVERAGE</span><h1>My quotes</h1><p class="muted">Return to your previously created quotes.</p></div><a class="button" routerLink="/portal/quotes/new">+ Create a quote</a></div>
@if (features.error()) { <div class="error" role="alert">{{features.error()}} <button class="text-button" (click)="load()">Retry</button></div> } @else if (!features.quotesEnabled()) { <div class="notice">Quote services are coming soon. This feature will be enabled once access controls and quote statuses are ready.</div> } @else if (loading) { <p role="status">Loading quotes…</p> } @else if (error) { <div class="error" role="alert">{{error}} <button class="text-button" (click)="loadQuotes()">Retry</button></div> } @else if (!quotes.length) { <section class="card empty"><div class="empty-icon">▤</div><h2>No quotes yet</h2><p>Your quotes will appear here.</p><a class="button" routerLink="/portal/quotes/new">Create a quote</a></section> } @else { <div class="card table-wrap"><table><thead><tr><th>Reference</th><th>Product</th><th>Created</th><th>Valid until</th><th>Premium</th><th><span class="sr-only">Details</span></th></tr></thead><tbody>@for (quote of quotes; track quote.id) { <tr><td>{{quote.referenceNumber}}</td><td>{{productName(quote)}}</td><td>{{quote.createdAt | date:'mediumDate'}}</td><td>{{quote.validUntil | date:'mediumDate'}}</td><td>{{quote.totalPremium | number:'1.2-2'}}</td><td><a [routerLink]="['/portal/quotes', quote.id]">View</a></td></tr> }</tbody></table><p class="table-note">Currency is shown in quote details when available.</p></div> }` })
export class QuoteListPage {
  readonly features = inject(FeatureService); private readonly http = inject(HttpClient); private readonly session = inject(SessionService); quotes: Quote[] = []; loading = false; error = ''; readonly productName = productName;
  constructor() { this.load(); }
  load(): void { this.http.get<{quotesEnabled:boolean}>('/api/ui/features').subscribe({next: f => { this.features.quotesEnabled.set(f.quotesEnabled); this.features.error.set(''); if (f.quotesEnabled) this.loadQuotes(); }, error: () => this.features.error.set('Feature availability could not be loaded.')}); }
  loadQuotes(): void { const id = this.session.user()?.id; if (!id) { this.error = 'Your user profile is unavailable.'; return; } this.loading = true; this.error = ''; this.http.get<Quote[]>(`/api/quotes/user/${encodeURIComponent(id)}`).subscribe({ next: q => { this.quotes = q; this.loading = false; }, error: e => { this.error = errorMessage(e); this.loading = false; } }); }
}

@Component({ selector: 'app-quote-wizard', imports: [CommonModule, ReactiveFormsModule, RouterLink], template: `
<div class="page-heading"><div><span class="eyebrow">MY QUOTES / CREATE</span><h1>Create a quote</h1><p class="muted">Tell us a little about what you'd like to insure.</p></div></div>
@if (features.error()) { <div class="error" role="alert">{{features.error()}}</div> } @else if (!features.quotesEnabled()) { <div class="notice">Quote creation is coming soon. This feature will be enabled once access controls and quote statuses are ready.</div><p><a routerLink="/portal">Back to dashboard</a></p> } @else { <div class="wizard-steps" aria-label="Quote progress">@for (label of steps; track label; let i = $index) { <span [class.current]="step === i">{{i + 1}}. {{label}}</span> }</div>
@if (error) { <div class="error" role="alert">{{error}}</div> }
@if (step === 0) { <div class="cards three">@for (name of products; track name) { <button class="card product select-product" (click)="selectProduct(name)"><span class="product-icon">{{name === 'Auto' ? '◇' : name === 'Home' ? '⌂' : '+'}}</span><h3>{{name}} insurance</h3><span class="link">Select {{name}} →</span></button> }</div> }
@if (step === 1 || step === 2) { <section class="card panel"><h2>{{step === 1 ? 'Address' : product + ' details'}}</h2><p class="muted">{{step === 1 ? 'Where is the insured location?' : 'Provide details for your quote.'}}</p><div class="notice">Reference IDs must match the configured service data. Lookup selection is not yet available; contact your administrator for valid IDs.</div><form [formGroup]="currentForm" (ngSubmit)="next()"><div class="form-grid">@for (field of currentFields; track field.key) { <div class="field"><label [for]="field.key">{{field.label}}{{field.optional ? ' (optional)' : ''}}</label>@if (field.type === 'boolean') { <select [id]="field.key" [formControlName]="field.key" required><option [ngValue]="null">Select an answer</option><option [ngValue]="true">Yes</option><option [ngValue]="false">No</option></select> } @else { <input [id]="field.key" [type]="field.type" [formControlName]="field.key" [attr.min]="field.min ?? null" [attr.required]="field.optional ? null : ''"> } @if (currentForm.controls[field.key].invalid && currentForm.controls[field.key].touched) { <small class="field-error">Enter a valid {{field.label.toLowerCase()}}.</small> }</div> }</div><div class="actions"><button type="button" class="button secondary" (click)="back()">Back</button><button class="button">Continue</button></div></form></section> }
@if (step === 3) { <section class="card panel"><h2>Review your information</h2><p class="muted">Please confirm these details before requesting your quote.</p><h3>{{product}} insurance</h3><dl class="review-list">@for (field of addressFields; track field.key) { <dt>{{field.label}}</dt><dd>{{display(address.value[field.key])}}</dd> } @for (field of selectedFields; track field.key) { <dt>{{field.label}}</dt><dd>{{display(details.value[field.key])}}</dd> }</dl><div class="actions"><button class="button secondary" (click)="back()">Back</button><button class="button" (click)="submit()" [disabled]="busy">{{busy ? 'Submitting…' : 'Get my quote'}}</button></div></section> } }` })
export class QuoteWizardPage {
  readonly features = inject(FeatureService); private readonly http = inject(HttpClient); private readonly router = inject(Router);
  readonly steps = ['Product', 'Address', 'Details', 'Review']; readonly products = ['Auto','Home','Health']; readonly addressFields = addressFields;
  step = 0; product = ''; address = makeForm(addressFields); details = makeForm([]); error = ''; busy = false;
  constructor() { this.features.load(); }
  get selectedFields(): Field[] { return productFields[this.product] ?? []; }
  get currentFields(): Field[] { return this.step === 1 ? addressFields : this.selectedFields; }
  get currentForm(): FormGroup { return this.step === 1 ? this.address : this.details; }
  selectProduct(name: string): void { if (this.product !== name) { this.product = name; this.details = makeForm(productFields[name]); } this.step = 1; }
  next(): void { this.currentForm.markAllAsTouched(); if (this.currentForm.valid) { this.error = ''; this.step++; } else this.error = 'Please complete all required fields with valid values.'; }
  back(): void { this.error = ''; this.step--; }
  display(value: FieldValue | undefined): string { return value === true ? 'Yes' : value === false ? 'No' : value == null || value === '' ? '—' : String(value); }
  submit(): void {
    if (!this.features.quotesEnabled() || this.busy || this.step !== 3 || !this.products.includes(this.product) || this.address.invalid || this.details.invalid) return;
    const type = this.product === 'Auto' ? 1 : this.product === 'Home' ? 2 : 3;
    const key = this.product.toLowerCase() + 'Quote';
    const request = { productType: type, [key]: { ...this.details.value, location: this.address.value } };
    this.error = ''; this.busy = true;
    this.http.post<CreateResult>('/api/quotes', request).subscribe({ next: result => { this.busy = false; void this.router.navigate(['/portal/quotes', result.quote.id]); }, error: e => { this.busy = false; this.error = errorMessage(e); } });
  }
}

@Component({ selector: 'app-quote-detail', imports: [CommonModule, RouterLink], template: `
<div class="page-heading"><div><span class="eyebrow">MY QUOTES / DETAILS</span><h1>Quote details</h1><p class="muted">Review your quote information.</p></div><a class="button secondary" routerLink="/portal/quotes">← My quotes</a></div>
@if (features.error()) { <div class="error" role="alert">{{features.error()}}</div> } @else if (!features.quotesEnabled()) { <div class="notice">Quote details are coming soon.</div> } @else if (loading) { <p role="status">Loading quote…</p> } @else if (error) { <div class="error" role="alert">{{error}} <button class="text-button" (click)="loadQuote()">Retry</button></div> } @else if (quote) { <section class="card panel"><div class="detail-heading"><div><span class="eyebrow">{{productName(quote)}} INSURANCE</span><h2>{{quote.referenceNumber}}</h2><p class="muted">Valid until {{quote.validUntil | date:'mediumDate'}}</p></div><div><span class="muted">Quoted premium</span><div class="premium">{{quote.totalPremium | number:'1.2-2'}}</div><small>Currency shown in rating details when available</small></div></div><h3>Quote information</h3><dl class="review-list"><dt>Created</dt><dd>{{quote.createdAt | date:'mediumDate'}}</dd>@for (entry of details; track entry.key) { <dt>{{entry.key}}</dt><dd>{{entry.value}}</dd> }</dl>@if (rating) { <h3>Rating details</h3><pre>{{rating | json}}</pre> }<div class="notice">Accepting a quote does not create a policy or activate coverage.</div>@if (accepted) { <div class="notice" role="status">Your quote was accepted. No policy has been issued.</div> } @else if (canAccept) { @if (confirming) { <p>Accept this quote? This does not issue a policy.</p><div class="actions"><button class="button" (click)="accept()" [disabled]="busy">{{busy ? 'Submitting…' : 'Confirm acceptance'}}</button><button class="button secondary" (click)="confirming = false">Go back</button></div> } @else { <button class="button" (click)="confirming = true">Accept quote</button> } }<p class="muted">Rejecting a quote will be available when that workflow is ready.</p>@if (actionError) { <div class="error" role="alert">{{actionError}}</div> }</section> }` })
export class QuoteDetailPage {
  readonly features = inject(FeatureService); private readonly http = inject(HttpClient); private readonly route = inject(ActivatedRoute); quote?: Quote; loading = false; busy = false; confirming = false; accepted = false; error = ''; actionError = ''; readonly productName = productName;
  constructor() { this.http.get<{quotesEnabled:boolean}>('/api/ui/features').subscribe({next: f => { this.features.quotesEnabled.set(f.quotesEnabled); this.features.error.set(''); if (f.quotesEnabled) this.loadQuote(); }, error: () => this.features.error.set('Feature availability could not be loaded.')}); }
  get canAccept(): boolean { return this.features.quotesEnabled() && !!this.quote && this.quote.status?.toLowerCase() === 'quoted' && Date.parse(this.quote.validUntil) > Date.now(); }
  get product(): Product | undefined { return this.quote?.autoQuote ?? this.quote?.homeQuote ?? this.quote?.healthQuote; }
  get rating(): Record<string, unknown> | undefined { return this.product?.rating; }
  get details(): {key:string;value:string}[] {
    const product = this.product; if (!product) return [];
    const flatten = (obj: Record<string, unknown>): {key:string;value:string}[] => Object.entries(obj).filter(([key, value]) => !['id','locationId','rating','validUntil','quotedPremium'].includes(key) && value !== null && typeof value !== 'object').map(([key,value]) => ({key: key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()), value: typeof value === 'boolean' ? value ? 'Yes' : 'No' : String(value)}));
    return [...(product.location ? flatten(product.location) : []), ...flatten(product)];
  }
  loadQuote(): void { const id = this.route.snapshot.paramMap.get('id'); if (!id) { this.error = 'Quote ID is missing.'; return; } this.loading = true; this.error = ''; this.http.get<Quote>(`/api/quotes/${encodeURIComponent(id)}`).subscribe({ next: q => { this.quote = q; this.loading = false; }, error: e => { this.error = errorMessage(e); this.loading = false; } }); }
  accept(): void { if (!this.quote || this.busy || !this.canAccept) return; this.busy = true; this.actionError = ''; this.http.post<Quote>(`/api/quotes/${encodeURIComponent(this.quote.id)}/accept`, {}).subscribe({ next: q => { this.quote = q; this.accepted = true; this.confirming = false; this.busy = false; }, error: e => { this.actionError = errorMessage(e); this.busy = false; } }); }
}

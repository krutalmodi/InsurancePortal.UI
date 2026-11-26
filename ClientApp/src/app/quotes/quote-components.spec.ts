import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { SessionService } from '../core/session.service';
import { QuoteDetailPage } from './quote-detail/quote-detail.component';
import { QuoteListPage } from './quote-list/quote-list.component';
import { QuoteWizardPage } from './quote-wizard/quote-wizard.component';

const quote = {
  id: 'quote-id',
  userId: 'user-id',
  referenceNumber: 'QT-123',
  status: 'Quoted',
  createdAt: '2026-01-01T00:00:00Z',
  validUntil: '2099-01-01T00:00:00Z',
  totalPremium: 250,
  homeQuote: { homeType: 'House', location: { city: 'Calgary' } },
};

function flushLookups(http: HttpTestingController): void {
  http.expectOne('/api/lookups/countries').flush([
    { id: 1, code: 'USA', name: 'United States' },
    { id: 2, code: 'Canada', name: 'Canada' },
  ]);
  http
    .expectOne('/api/lookups/location-types')
    .flush([{ id: 1, code: 'Residential', name: 'Residential' }]);
}
function flushProductLookups(
  http: HttpTestingController,
  product: 'Auto' | 'Home' | 'Health',
): void {
  const sample = [{ id: 1, code: 'Sample', name: 'Sample' }];
  const types: Record<string, string[]> = {
    Auto: ['vehicle-makes', 'vehicle-colors', 'vehicle-types', 'driving-record-types'],
    Home: ['home-types'],
    Health: ['health-statuses', 'coverage-types', 'smoking-statuses'],
  };
  for (const type of types[product]) http.expectOne('/api/lookups/' + type).flush(sample);
}
function flushProvinces(http: HttpTestingController): void {
  http
    .expectOne('/api/lookups/countries/2/provinces')
    .flush([{ id: 8, code: 'AB', name: 'Alberta', countryId: 2 }]);
}
describe('Quote pages', () => {
  let http: HttpTestingController;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuoteListPage, QuoteDetailPage],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: 'quote-id' }) } },
        },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(SessionService).user.set({
      id: 'user-id',
      email: 'user@example.com',
      firstName: null,
      lastName: null,
      isActive: true,
      roles: ['Registered'],
    });
  });
  afterEach(() => {
    // The optional status filter lookup is not under test in most list scenarios.
    http.match('/api/lookups/quote-statuses').forEach((r) => r.flush([]));
    http.verify();
  });

  it('renders the quote list from the user-scoped API', () => {
    const fixture = TestBed.createComponent(QuoteListPage);
    http.expectOne('/api/ui/features').flush({ quotesEnabled: true });
    http.expectOne('/api/quotes/user').flush([quote]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('QT-123');
    expect(fixture.nativeElement.textContent).toContain('Home');
  });

  it('lists my quotes without a user id even while quote management is gated', async () => {
    const fixture = TestBed.createComponent(QuoteListPage);
    http.expectOne('/api/ui/features').flush({ quotesEnabled: false });
    const request = http.expectOne('/api/quotes/user');
    expect(request.request.method).toBe('GET');
    request.flush([
      { ...quote, id: 'older', referenceNumber: 'QT-OLD', createdAt: '2020-01-01T00:00:00Z' },
      quote,
    ]);
    await fixture.whenStable();
    const rows = Array.from(fixture.nativeElement.querySelectorAll('tbody tr')) as HTMLElement[];
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('QT-123');
    expect(rows[1].textContent).toContain('QT-OLD');
    expect(rows[0].querySelector('a')?.getAttribute('href')).toBe('/portal/quotes/quote-id');
  });

  it('updates quote list loading, error and retry results without forced change detection', async () => {
    const fixture = TestBed.createComponent(QuoteListPage);
    await fixture.whenStable();
    http.expectOne('/api/ui/features').flush({ quotesEnabled: true });
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Loading quotes');
    http
      .expectOne('/api/quotes/user')
      .flush({ error: 'Could not load quotes' }, { status: 500, statusText: 'Error' });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[role=alert]').textContent).toContain(
      'Could not load quotes',
    );
    fixture.nativeElement.querySelector('[role=alert] button').click();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Loading quotes');
    http.expectOne('/api/quotes/user').flush([quote]);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('QT-123');
  });

  it('shows quote submission errors and re-enables submission without forced change detection', async () => {
    const fixture = TestBed.createComponent(QuoteWizardPage);
    http.expectOne('/api/ui/features').flush({ quoteCreationEnabled: true, quotesEnabled: false });
    flushLookups(http);
    const wizard = fixture.componentInstance;
    wizard.selectProduct('Home');
    flushProductLookups(http, 'Home');
    wizard.address.patchValue({
      streetAddress1: '123 Main St',
      city: 'Calgary',
      postalCode: 'T3J 0A1',
      countryId: 2,
      provinceId: 8,
      locationTypeId: 1,
    });
    flushProvinces(http);
    wizard.details.patchValue({
      squareFootage: 1500,
      yearBuilt: 2000,
      homeType: 'House',
      homeValue: 400000,
      numberOfOccupants: 2,
      hasSecuritySystem: true,
      hasFireAlarm: true,
    });
    wizard.next();
    wizard.next();
    fixture.detectChanges();
    const submit = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((button) => button.textContent?.includes('Get my quote'))!;
    submit.click();
    await fixture.whenStable();
    expect(submit.disabled).toBe(true);
    http
      .expectOne('/api/quotes')
      .flush({ error: 'Quote could not be created' }, { status: 400, statusText: 'Bad Request' });
    await fixture.whenStable();
    expect(submit.disabled).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Quote could not be created');
  });

  it('populates country and province dropdowns from the Location Service', async () => {
    const fixture = TestBed.createComponent(QuoteWizardPage);
    http.expectOne('/api/ui/features').flush({ quoteCreationEnabled: true, quotesEnabled: false });
    flushLookups(http);
    const wizard = fixture.componentInstance;
    wizard.selectProduct('Home');
    flushProductLookups(http, 'Home');
    await fixture.whenStable();
    const options = (id: string) =>
      Array.from((fixture.nativeElement.querySelector('#' + id) as HTMLSelectElement).options).map(
        (o) => o.textContent?.trim(),
      );
    expect(options('countryId')).toEqual(expect.arrayContaining(['United States', 'Canada']));
    expect(options('provinceId')).toEqual(['Select country first']);
    wizard.address.controls['countryId'].setValue(2);
    http
      .expectOne('/api/lookups/countries/2/provinces')
      .flush([{ id: 8, code: 'AB', name: 'Alberta', countryId: 2 }]);
    await fixture.whenStable();
    expect(options('provinceId')).toContain('Alberta');
    wizard.address.controls['provinceId'].setValue(8);
    wizard.address.controls['countryId'].setValue(1);
    expect(wizard.address.controls['provinceId'].value).toBeNull();
    http.expectOne('/api/lookups/countries/1/provinces').flush([]);
  });

  it('shows a lookup error and retries loading the address options', async () => {
    const fixture = TestBed.createComponent(QuoteWizardPage);
    http.expectOne('/api/ui/features').flush({ quoteCreationEnabled: true, quotesEnabled: false });
    http.expectOne('/api/lookups/location-types').flush([]);
    http
      .expectOne('/api/lookups/countries')
      .flush({ error: 'down' }, { status: 502, statusText: 'Bad Gateway' });
    fixture.componentInstance.selectProduct('Home');
    flushProductLookups(http, 'Home');
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Could not load options');
    fixture.componentInstance.retryLookups();
    flushLookups(http);
    flushProductLookups(http, 'Home');
    await fixture.whenStable();
    expect(fixture.componentInstance.lookupError).toBe('');
  });

  it('loads Auto lookups and filters vehicle models by the selected make', async () => {
    const fixture = TestBed.createComponent(QuoteWizardPage);
    http.expectOne('/api/ui/features').flush({ quoteCreationEnabled: true, quotesEnabled: false });
    flushLookups(http);
    const wizard = fixture.componentInstance;
    wizard.selectProduct('Auto');
    http.expectOne('/api/lookups/vehicle-makes').flush([{ id: 2, code: 'Honda', name: 'Honda' }]);
    http.expectOne('/api/lookups/vehicle-colors').flush([{ id: 1, code: 'Black', name: 'Black' }]);
    http.expectOne('/api/lookups/vehicle-types').flush([{ id: 3, code: 'Sedan', name: 'Sedan' }]);
    http
      .expectOne('/api/lookups/driving-record-types')
      .flush([{ id: 1, code: 'Clean', name: 'Clean' }]);
    wizard.step = 2;
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('#vehicleModelId').textContent).toContain(
      'Select vehicle make first',
    );
    wizard.details.controls['vehicleMakeId'].setValue(2);
    http
      .expectOne('/api/lookups/vehicle-models?vehicleMakeId=2')
      .flush([{ id: 9, code: 'Civic', name: 'Civic' }]);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('#vehicleModelId').textContent).toContain('Civic');
    wizard.details.controls['drivingRecord'].setValue('Clean');
    expect(wizard.optionLabel(wizard.selectedFields[7], 'Clean')).toBe('Clean');
  });

  it('offers standard dropdowns for Auto year, drivers, mileage, accidents and tickets', async () => {
    const fixture = TestBed.createComponent(QuoteWizardPage);
    http.expectOne('/api/ui/features').flush({ quoteCreationEnabled: true, quotesEnabled: false });
    flushLookups(http);
    const wizard = fixture.componentInstance;
    wizard.selectProduct('Auto');
    flushProductLookups(http, 'Auto');
    wizard.step = 2;
    await fixture.whenStable();
    const values = (id: string) =>
      Array.from((fixture.nativeElement.querySelector('#' + id) as HTMLSelectElement).options)
        .slice(1)
        .map((o) => o.textContent?.trim());
    const years = values('year');
    expect(years[0]).toBe(String(new Date().getFullYear()));
    expect(years[years.length - 1]).toBe('1990');
    expect(values('numberOfDrivers')).toEqual([
      '0',
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      '10',
    ]);
    expect(values('atFaultAccidents')).toHaveLength(11);
    expect(values('speedingTickets')).toHaveLength(11);
    expect(values('estimatedAnnualMileage')).toEqual([
      '0',
      '1,000',
      '3,000',
      '5,000',
      '8,000',
      '10,000',
      '15,000',
      '20,000',
      '35,000',
    ]);
    expect(values('vehicleTypeId')).toEqual(['Sample']);
  });

  it('offers Home and Health dropdowns, maps smoking status and loads the pre-existing condition list on Yes', async () => {
    const fixture = TestBed.createComponent(QuoteWizardPage);
    http.expectOne('/api/ui/features').flush({ quoteCreationEnabled: true, quotesEnabled: false });
    flushLookups(http);
    const wizard = fixture.componentInstance;
    wizard.selectProduct('Home');
    flushProductLookups(http, 'Home');
    wizard.step = 2;
    await fixture.whenStable();
    const values = (id: string) =>
      Array.from((fixture.nativeElement.querySelector('#' + id) as HTMLSelectElement).options)
        .slice(1)
        .map((o) => o.textContent?.trim());
    const built = values('yearBuilt');
    expect(built[0]).toBe(String(new Date().getFullYear()));
    expect(built[built.length - 1]).toBe('1900');
    expect(values('numberOfOccupants')).toHaveLength(11);
    wizard.selectProduct('Health');
    flushProductLookups(http, 'Health');
    wizard.step = 2;
    await fixture.whenStable();
    expect(values('age')[0]).toBe('18');
    expect(values('dependents')).toHaveLength(11);
    expect(fixture.nativeElement.querySelector('#preexistingCondition')).toBeNull();
    wizard.details.controls['hasPreexistingConditions'].setValue(true);
    http
      .expectOne('/api/lookups/health-statuses')
      .flush([{ id: 5, code: 'Chronic', name: 'Chronic Disease' }]);
    await fixture.whenStable();
    expect(values('preexistingCondition')).toEqual(['Chronic Disease']);
    wizard.details.controls['hasPreexistingConditions'].setValue(false);
    expect(wizard.details.controls['preexistingCondition'].disabled).toBe(true);
    expect(values('smoker')).toEqual(['Sample']);
    const smoker = wizard.selectedFields.find((field) => field.key === 'smoker')!;
    expect(smoker.toPayload!('CurrentSmoker')).toBe(true);
    expect(smoker.toPayload!('FormerSmoker')).toBe(false);
  });

  it('filters the quote list by a status from the Quote lookup', async () => {
    const fixture = TestBed.createComponent(QuoteListPage);
    http.expectOne('/api/ui/features').flush({ quotesEnabled: true });
    http.expectOne('/api/quotes/user').flush([quote]);
    http.expectOne('/api/lookups/quote-statuses').flush([
      { id: 1, code: quote.status, name: 'Status Name' },
      { id: 2, code: 'Expired', name: 'Expired' },
    ]);
    await fixture.whenStable();
    const select = fixture.nativeElement.querySelector('#statusFilter') as HTMLSelectElement;
    expect(select.textContent).toContain('Status Name');
    select.value = 'Expired';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).not.toContain('QT-123');
  });

  const autoQuote = {
    ...quote,
    homeQuote: undefined,
    autoQuote: {
      vin: 'VIN123',
      vehicleMakeId: 3,
      vehicleModelId: 9,
      vehicleColorId: 2,
      vehicleTypeId: 1,
      year: 2020,
      mileage: 12000,
      drivingRecord: 'Clean',
      numberOfDrivers: 2,
      estimatedAnnualMileage: 8000,
      location: {
        streetAddress1: '1 Main St',
        city: 'Calgary',
        provinceId: 8,
        countryId: 2,
        locationTypeId: 1,
      },
      rating: {
        currencyId: 2,
        currency: 'CAD',
        planName: 'Standard',
        termMonths: 12,
        factors: [{ type: 'Province', input: 8, multiplier: 1.1, amountAfter: 275 }],
      },
    },
  };
  function flushDetailLookups(): void {
    const named = (name: string, description: string | null = null) => [
      { id: 1, code: 'Quoted', name, description },
      { id: 2, code: 'Clean', name, description },
      { id: 3, code: 'Sample', name, description },
      { id: 8, code: 'AB', name, description },
      { id: 9, code: 'Sample9', name, description },
    ];
    http.expectOne('/api/lookups/quote-statuses').flush(named('Quoted', 'Quote complete'));
    http
      .expectOne('/api/lookups/currencies')
      .flush([{ id: 2, code: 'CAD', name: 'Canadian Dollar' }]);
    http.expectOne('/api/lookups/countries').flush([{ id: 2, code: 'Canada', name: 'Canada' }]);
    http
      .expectOne('/api/lookups/location-types')
      .flush([{ id: 1, code: 'R', name: 'Residential' }]);
    http
      .expectOne('/api/lookups/countries/2/provinces')
      .flush([{ id: 8, code: 'AB', name: 'Alberta' }]);
    http.expectOne('/api/lookups/vehicle-makes').flush([{ id: 3, code: 'T', name: 'Toyota' }]);
    http
      .expectOne('/api/lookups/vehicle-models?vehicleMakeId=3')
      .flush([{ id: 9, code: 'C', name: 'Corolla' }]);
    http.expectOne('/api/lookups/vehicle-colors').flush([{ id: 2, code: 'B', name: 'Blue' }]);
    http.expectOne('/api/lookups/vehicle-types').flush([{ id: 1, code: 'S', name: 'Sedan' }]);
    http
      .expectOne('/api/lookups/driving-record-types')
      .flush([{ id: 5, code: 'Clean', name: 'Clean record', description: 'No incidents' }]);
  }

  it('shows lookup names and descriptions for a quote found in my quotes', async () => {
    const fixture = TestBed.createComponent(QuoteDetailPage);
    http.expectOne('/api/ui/features').flush({ quotesEnabled: false });
    http.expectNone('/api/quotes/quote-id');
    http.expectOne('/api/quotes/user').flush([
      { ...autoQuote, id: 'other' },
      { ...autoQuote, id: 'quote-id' },
    ]);
    flushDetailLookups();
    await fixture.whenStable();
    const text = fixture.nativeElement.textContent;
    for (const expected of [
      'QT-123',
      'Toyota',
      'Corolla',
      'Blue',
      'Sedan',
      'Clean record',
      'No incidents',
      'Alberta',
      'Canada',
      'Residential',
      'Canadian Dollar',
      'Quote complete',
      'Province',
      'Quote acceptance is coming soon.',
    ])
      expect(text).toContain(expected);
    expect(text).not.toContain('Accept quote');
  });

  it('reports a quote that is not in my quotes', async () => {
    const fixture = TestBed.createComponent(QuoteDetailPage);
    http.expectOne('/api/ui/features').flush({ quotesEnabled: true });
    http.expectOne('/api/quotes/user').flush([{ ...quote, id: 'someone-else' }]);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[role=alert]').textContent).toContain('not found');
  });

  it('still renders details with raw values when lookups fail, and accepts when enabled', async () => {
    const fixture = TestBed.createComponent(QuoteDetailPage);
    http.expectOne('/api/ui/features').flush({ quotesEnabled: true });
    http.expectOne('/api/quotes/user').flush([quote]);
    http.expectOne('/api/lookups/quote-statuses').flush([], { status: 500, statusText: 'Error' });
    http.expectOne('/api/lookups/currencies').flush([]);
    http.expectOne('/api/lookups/countries').flush([]);
    http.expectOne('/api/lookups/location-types').flush([]);
    http.expectOne('/api/lookups/home-types').flush([]);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Some descriptions could not be loaded');
    expect(fixture.nativeElement.textContent).toContain('Calgary');
    const find = (label: string) =>
      (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]).find(
        (b) => b.textContent?.includes(label),
      );
    find('Accept quote')!.click();
    await fixture.whenStable();
    find('Confirm acceptance')!.click();
    await fixture.whenStable();
    const request = http.expectOne('/api/quotes/quote-id/accept');
    expect(request.request.method).toBe('POST');
    request.flush({ ...quote, status: 'Accepted' });
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain(
      'Your quote was accepted. No policy has been issued.',
    );
  });
});

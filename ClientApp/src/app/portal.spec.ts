import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { SessionService } from './core/session.service';
import { authInterceptor } from './core/auth.interceptor';
import { QuoteWizardPage } from './quotes/quote-wizard/quote-wizard.component';
import { App } from './app';

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
describe('Portal integration', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', component: App }]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('signs in with Identity and loads the authenticated profile', () => {
    const session = TestBed.inject(SessionService);
    const token = `header.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))}.signature`;
    let email = '';
    session
      .signIn('customer@example.com', 'password')
      .subscribe((profile) => (email = profile.email));
    const login = http.expectOne('/api/auth/login');
    expect(login.request.body).toEqual({ email: 'customer@example.com', password: 'password' });
    login.flush({ token });
    const home = http.expectOne('/api/home/index');
    expect(home.request.headers.get('Authorization')).toBe(`Bearer ${token}`);
    home.flush({ message: 'Welcome to Insurance Portal' });
    const profile = http.expectOne('/api/auth/me');
    expect(profile.request.headers.get('Authorization')).toBe(`Bearer ${token}`);
    profile.flush({
      id: 'user-id',
      email: 'customer@example.com',
      firstName: null,
      lastName: null,
      isActive: true,
      roles: ['Registered'],
    });
    expect(email).toBe('customer@example.com');
    expect(session.home()).toBe('/portal');
    session.signOut();
  });

  it('rejects inactive users and clears their token', () => {
    const session = TestBed.inject(SessionService);
    let failed = false;
    session.signIn('user@example.com', 'password').subscribe({ error: () => (failed = true) });
    http.expectOne('/api/auth/login').flush({ token: 'token' });
    http.expectOne('/api/home/index').flush({ message: 'Welcome' });
    http.expectOne('/api/auth/me').flush({
      id: 'id',
      email: 'user@example.com',
      firstName: null,
      lastName: null,
      isActive: false,
      roles: ['Admin'],
    });
    expect(failed).toBe(true);
    expect(session.token).toBeNull();
    expect(session.user()).toBeNull();
  });

  it('clears the session and does not load a profile when the home check fails', () => {
    const session = TestBed.inject(SessionService);
    let failed = false;
    session.signIn('user@example.com', 'password').subscribe({ error: () => (failed = true) });
    http.expectOne('/api/auth/login').flush({ token: 'token' });
    http
      .expectOne('/api/home/index')
      .flush({ error: 'Service unavailable' }, { status: 503, statusText: 'Service Unavailable' });
    http.expectNone('/api/auth/me');
    expect(failed).toBe(true);
    expect(session.token).toBeNull();
    expect(session.user()).toBeNull();
  });

  it('builds and submits a home quote with the documented contract and bearer token', async () => {
    const session = TestBed.inject(SessionService);
    session.token = 'quote-test-token';
    const fixture = TestBed.createComponent(QuoteWizardPage);
    const wizard = fixture.componentInstance;
    http.expectOne('/api/ui/features').flush({ quoteCreationEnabled: true, quotesEnabled: false });
    flushLookups(http);
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
    wizard.submit();
    const request = http.expectOne('/api/quotes');
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Authorization')).toBe('Bearer quote-test-token');
    expect(request.request.body.productType).toBe(2);
    expect(request.request.body.homeQuote).toMatchObject({
      homeType: 'House',
      homeValue: 400000,
      hasFireAlarm: true,
      location: { countryId: 2, provinceId: 8, postalCode: 'T3J 0A1' },
    });
    request.flush(
      {
        message: 'Quote created successfully',
        referenceNumber: 'QT-1',
        quote: {
          id: 'quote-id',
          userId: 'user-id',
          referenceNumber: 'QT-1',
          status: 'Draft',
          createdAt: '2026-11-26T12:00:00Z',
          validUntil: '2026-12-26T12:00:00Z',
          totalPremium: 250,
          homeQuote: { homeType: 'House' },
        },
      },
      { status: 201, statusText: 'Created' },
    );
    await fixture.whenStable();
    expect(wizard.step).toBe(4);
    expect(fixture.nativeElement.textContent).toContain('QT-1');
  });

  it('does not submit an incomplete quote', () => {
    const fixture = TestBed.createComponent(QuoteWizardPage);
    const wizard = fixture.componentInstance;
    http.expectOne('/api/ui/features').flush({ quoteCreationEnabled: true, quotesEnabled: false });
    flushLookups(http);
    wizard.selectProduct('Auto');
    flushProductLookups(http, 'Auto');
    wizard.next();
    expect(wizard.step).toBe(1);
    expect(wizard.error).toContain('required');
    wizard.submit();
    http.expectNone('/api/quotes');
  });

  it('allows optional Auto rating values to be omitted', () => {
    const fixture = TestBed.createComponent(QuoteWizardPage);
    const wizard = fixture.componentInstance;
    http.expectOne('/api/ui/features').flush({ quoteCreationEnabled: true, quotesEnabled: false });
    flushLookups(http);
    wizard.selectProduct('Auto');
    flushProductLookups(http, 'Auto');
    wizard.address.patchValue({
      streetAddress1: '123 Main St',
      city: 'Calgary',
      postalCode: 'T3J 0A1',
      countryId: 2,
      provinceId: 8,
      locationTypeId: 1,
    });
    flushProvinces(http);
    wizard.next();
    wizard.details.patchValue({
      vin: 'VIN123',
      vehicleMakeId: 1,
      vehicleModelId: 1,
      vehicleColorId: 1,
      year: 2020,
      mileage: 10000,
      drivingRecord: 'Clean',
      numberOfDrivers: 1,
      estimatedAnnualMileage: 12000,
    });
    http.expectOne('/api/lookups/vehicle-models?vehicleMakeId=1').flush([]);
    wizard.details.patchValue({ vehicleModelId: 1 });
    wizard.next();
    expect(wizard.step).toBe(3);
    wizard.submit();
    const request = http.expectOne('/api/quotes');
    expect(request.request.body.autoQuote).toMatchObject({
      vehicleTypeId: null,
      atFaultAccidents: null,
      speedingTickets: null,
    });
    request.flush(
      {
        message: 'Created',
        referenceNumber: 'QT-AUTO',
        quote: {
          id: 'auto-id',
          userId: 'user-id',
          referenceNumber: 'QT-AUTO',
          status: 'Draft',
          createdAt: '2026-11-26T12:00:00Z',
          validUntil: '2026-12-26T12:00:00Z',
          totalPremium: 150,
        },
      },
      { status: 201, statusText: 'Created' },
    );
  });

  it('requires explicit yes or no answers for health details', () => {
    const fixture = TestBed.createComponent(QuoteWizardPage);
    const wizard = fixture.componentInstance;
    http.expectOne('/api/ui/features').flush({ quoteCreationEnabled: true, quotesEnabled: false });
    flushLookups(http);
    wizard.selectProduct('Health');
    flushProductLookups(http, 'Health');
    wizard.address.patchValue({
      streetAddress1: '123 Main St',
      city: 'Calgary',
      postalCode: 'T3J 0A1',
      countryId: 2,
      provinceId: 8,
      locationTypeId: 1,
    });
    flushProvinces(http);
    wizard.next();
    wizard.details.patchValue({
      age: 30,
      healthStatus: 'Good',
      coverageType: 'Individual',
      dependents: 0,
    });
    wizard.next();
    expect(wizard.step).toBe(2);
    wizard.details.patchValue({ hasPreexistingConditions: false, smoker: 'NonSmoker' });
    wizard.next();
    expect(wizard.step).toBe(3);
    wizard.submit();
    const request = http.expectOne('/api/quotes');
    expect(request.request.body).toMatchObject({
      productType: 3,
      healthQuote: { hasPreexistingConditions: false, smoker: false, dependents: 0 },
    });
    request.flush({ quote: { id: 'quote-id' }, referenceNumber: 'QT-1' });
  });

  it('does not submit while the quote feature is disabled', () => {
    const fixture = TestBed.createComponent(QuoteWizardPage);
    const wizard = fixture.componentInstance;
    http.expectOne('/api/ui/features').flush({ quoteCreationEnabled: false, quotesEnabled: false });
    flushLookups(http);
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
      hasSecuritySystem: false,
      hasFireAlarm: true,
    });
    wizard.next();
    wizard.next();
    wizard.submit();
    http.expectNone('/api/quotes');
  });

  it('sends unsupported roles to access denied', () => {
    const session = TestBed.inject(SessionService);
    session.user.set({
      id: 'id',
      email: 'user@example.com',
      firstName: null,
      lastName: null,
      isActive: true,
      roles: ['Providers Staff'],
    });
    expect(session.home()).toBe('/access-denied');
    session.user.set({
      id: 'id',
      email: 'user@example.com',
      firstName: null,
      lastName: null,
      isActive: true,
      roles: ['Agents'],
    });
    expect(session.home()).toBe('/staff');
  });
});

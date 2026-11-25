import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { SessionService, authInterceptor } from './core';
import { QuoteWizardPage } from './quotes';
import { App } from './app';

describe('Portal integration', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: '**', component: App }]), provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('signs in with Identity and loads the authenticated profile', () => {
    const session = TestBed.inject(SessionService);
    const token = `header.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))}.signature`;
    let email = '';
    session.signIn('customer@example.com', 'password').subscribe(profile => email = profile.email);
    const login = http.expectOne('/api/auth/login');
    expect(login.request.body).toEqual({ email: 'customer@example.com', password: 'password' });
    login.flush({ token });
    const profile = http.expectOne('/api/auth/me');
    expect(profile.request.headers.get('Authorization')).toBe(`Bearer ${token}`);
    profile.flush({ id: 'user-id', email: 'customer@example.com', firstName: null, lastName: null, isActive: true, roles: ['Registered'] });
    expect(email).toBe('customer@example.com');
    expect(session.home()).toBe('/portal');
    session.signOut();
  });

  it('rejects inactive users and clears their token', () => {
    const session = TestBed.inject(SessionService);
    let failed = false;
    session.signIn('user@example.com', 'password').subscribe({ error: () => failed = true });
    http.expectOne('/api/auth/login').flush({ token: 'token' });
    http.expectOne('/api/auth/me').flush({ id: 'id', email: 'user@example.com', firstName: null, lastName: null, isActive: false, roles: ['Admin'] });
    expect(failed).toBe(true);
    expect(session.token).toBeNull();
    expect(session.user()).toBeNull();
  });

  it('builds a home quote request with the documented fields', () => {
    const fixture = TestBed.createComponent(QuoteWizardPage);
    const wizard = fixture.componentInstance;
    http.expectOne('/api/ui/features').flush({ quotesEnabled: true });
    wizard.selectProduct('Home');
    wizard.address.patchValue({ streetAddress1: '123 Main St', city: 'Calgary', postalCode: 'T3J 0A1', countryId: 2, provinceId: 8, locationTypeId: 1 });
    wizard.details.patchValue({ squareFootage: 1500, yearBuilt: 2000, homeType: 'House', homeValue: 400000, numberOfOccupants: 2, hasSecuritySystem: true, hasFireAlarm: true });
    wizard.next(); wizard.next(); wizard.submit();
    const request = http.expectOne('/api/quotes');
    expect(request.request.method).toBe('POST');
    expect(request.request.body.productType).toBe(2);
    expect(request.request.body.homeQuote).toMatchObject({ homeType: 'House', homeValue: 400000, hasFireAlarm: true, location: { countryId: 2, provinceId: 8, postalCode: 'T3J 0A1' } });
    request.flush({ quote: { id: 'quote-id' }, referenceNumber: 'QT-1' });
  });

  it('does not submit an incomplete quote', () => {
    const fixture = TestBed.createComponent(QuoteWizardPage);
    const wizard = fixture.componentInstance;
    http.expectOne('/api/ui/features').flush({ quotesEnabled: true });
    wizard.selectProduct('Auto');
    wizard.next();
    expect(wizard.step).toBe(1);
    expect(wizard.error).toContain('required');
    wizard.submit();
    http.expectNone('/api/quotes');
  });

  it('requires explicit yes or no answers for health details', () => {
    const fixture = TestBed.createComponent(QuoteWizardPage);
    const wizard = fixture.componentInstance;
    http.expectOne('/api/ui/features').flush({ quotesEnabled: true });
    wizard.selectProduct('Health');
    wizard.address.patchValue({ streetAddress1: '123 Main St', city: 'Calgary', postalCode: 'T3J 0A1', countryId: 2, provinceId: 8, locationTypeId: 1 });
    wizard.next();
    wizard.details.patchValue({ age: 30, healthStatus: 'Good', coverageType: 'Individual', dependents: 0 });
    wizard.next();
    expect(wizard.step).toBe(2);
    wizard.details.patchValue({ hasPreexistingConditions: false, smoker: false });
    wizard.next();
    expect(wizard.step).toBe(3);
    wizard.submit();
    const request = http.expectOne('/api/quotes');
    expect(request.request.body).toMatchObject({ productType: 3, healthQuote: { hasPreexistingConditions: false, smoker: false, dependents: 0 } });
    request.flush({ quote: { id: 'quote-id' }, referenceNumber: 'QT-1' });
  });

  it('does not submit while the quote feature is disabled', () => {
    const fixture = TestBed.createComponent(QuoteWizardPage);
    const wizard = fixture.componentInstance;
    http.expectOne('/api/ui/features').flush({ quotesEnabled: false });
    wizard.selectProduct('Home');
    wizard.address.patchValue({ streetAddress1: '123 Main St', city: 'Calgary', postalCode: 'T3J 0A1', countryId: 2, provinceId: 8, locationTypeId: 1 });
    wizard.details.patchValue({ squareFootage: 1500, yearBuilt: 2000, homeType: 'House', homeValue: 400000, numberOfOccupants: 2, hasSecuritySystem: false, hasFireAlarm: true });
    wizard.next(); wizard.next(); wizard.submit();
    http.expectNone('/api/quotes');
  });

  it('sends unsupported roles to access denied', () => {
    const session = TestBed.inject(SessionService);
    session.user.set({ id: 'id', email: 'user@example.com', firstName: null, lastName: null, isActive: true, roles: ['Providers Staff'] });
    expect(session.home()).toBe('/access-denied');
    session.user.set({ id: 'id', email: 'user@example.com', firstName: null, lastName: null, isActive: true, roles: ['Agents'] });
    expect(session.home()).toBe('/staff');
  });
});

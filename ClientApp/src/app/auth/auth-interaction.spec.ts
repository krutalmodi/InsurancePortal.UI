import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../app.routes';
import { authInterceptor } from '../core/auth.interceptor';
import { SessionService } from '../core/session.service';
import { AuthPage } from './auth.component';

const token = `header.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 60 }))}.signature`;

describe('Login interactions in zoneless mode', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter(routes),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('unlocks the form and displays an error on 401, then permits a successful retry', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/sign-in', AuthPage);
    const form = harness.routeNativeElement!.querySelector('form')!;
    const email = form.querySelector<HTMLInputElement>('#email')!;
    const password = form.querySelector<HTMLInputElement>('#password')!;
    email.value = 'user@example.com';
    email.dispatchEvent(new Event('input', { bubbles: true }));
    password.value = 'password';
    password.dispatchEvent(new Event('input', { bubbles: true }));
    await harness.fixture.whenStable();
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await harness.fixture.whenStable();
    const button = form.querySelector('button')!;
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain('Please wait');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    http
      .expectOne('/api/auth/login')
      .flush({ error: 'Invalid credentials' }, { status: 401, statusText: 'Unauthorized' });
    await harness.fixture.whenStable();
    expect(button.disabled).toBe(false);
    expect(harness.routeNativeElement?.querySelector('[role=alert]')?.textContent).toContain(
      'Invalid credentials',
    );
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    http.expectOne('/api/auth/login').flush({ token });
    http.expectOne('/api/home/index').flush({ message: 'Welcome' });
    http.expectOne('/api/auth/me').flush({
      id: 'id',
      email: 'user@example.com',
      firstName: 'Alex',
      lastName: null,
      isActive: true,
      roles: ['Registered'],
    });
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/portal');
    expect(harness.routeNativeElement?.querySelector('.account')?.textContent).toContain('Alex');
  });

  it('allows registration retry and shows the sign-in notice after success', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/sign-up', AuthPage);
    page.email = 'user@example.com';
    page.password = 'password';
    page.confirm = 'password';
    page.firstName = ' Alex ';
    page.lastName = ' Morgan ';
    page.username = ' alex ';
    page.submit(true);
    const registration = http.expectOne('/api/auth/register');
    expect(registration.request.method).toBe('POST');
    expect(registration.request.body).toEqual({
      email: 'user@example.com',
      password: 'password',
      firstName: 'Alex',
      lastName: 'Morgan',
      username: 'alex',
    });
    registration.flush(
      { error: 'Account already exists' },
      { status: 400, statusText: 'Bad Request' },
    );
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.querySelector('[role=alert]')?.textContent).toContain(
      'Account already exists',
    );
    page.submit(true);
    http.expectOne('/api/auth/register').flush({ message: 'User registered successfully.' });
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toContain('/sign-in');
    expect(harness.routeNativeElement?.querySelector('[role=status]')?.textContent).toContain(
      'Account created. Please sign in.',
    );
  });

  it.each(['/api/home/index', '/api/auth/me'])(
    'shows a verification error when %s returns 401',
    async (failedEndpoint) => {
      const harness = await RouterTestingHarness.create();
      const page = await harness.navigateByUrl('/sign-in', AuthPage);
      page.email = 'user@example.com';
      page.password = 'password';
      page.submit(true);
      http.expectOne('/api/auth/login').flush({ token });
      if (failedEndpoint === '/api/auth/me')
        http.expectOne('/api/home/index').flush({ message: 'Welcome' });
      http.expectOne(failedEndpoint).flush(null, { status: 401, statusText: 'Unauthorized' });
      await harness.fixture.whenStable();
      expect(TestBed.inject(Router).url).toBe('/sign-in');
      expect(TestBed.inject(SessionService).token).toBeNull();
      expect(TestBed.inject(SessionService).user()).toBeNull();
      expect(harness.routeNativeElement?.querySelector('[role=alert]')?.textContent).toContain(
        failedEndpoint === '/api/home/index'
          ? 'home check returned 401'
          : 'profile check returned 401',
      );
      expect(harness.routeNativeElement?.querySelector('button')?.disabled).toBe(false);
    },
  );

  it('signs out an established session on an authenticated 401', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/sign-in', AuthPage);
    page.email = 'user@example.com';
    page.password = 'password';
    page.submit(true);
    http.expectOne('/api/auth/login').flush({ token });
    http.expectOne('/api/home/index').flush({ message: 'Welcome' });
    http.expectOne('/api/auth/me').flush({
      id: 'id',
      email: 'user@example.com',
      firstName: null,
      lastName: null,
      isActive: true,
      roles: ['Admin'],
    });
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/staff');
    const client = TestBed.inject(SessionService);
    TestBed.inject(HttpClient)
      .get('/api/auth/me')
      .subscribe({ error: () => {} });
    http.expectOne('/api/auth/me').flush(null, { status: 401, statusText: 'Unauthorized' });
    await harness.fixture.whenStable();
    expect(client.token).toBeNull();
    expect(client.user()).toBeNull();
    expect(TestBed.inject(Router).url).toBe('/sign-in?expired=1');
    expect(harness.routeNativeElement?.textContent).toContain('Your session expired');
  });
});

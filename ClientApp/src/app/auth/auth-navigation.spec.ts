import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../app.routes';
import { authInterceptor } from '../core/auth.interceptor';
import { AuthPage } from './auth.component';

describe('Authenticated navigation', () => {
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

  it.each([
    { role: 'Registered', url: '/portal', heading: 'Welcome back' },
    { role: 'Admin', url: '/staff', heading: 'Admin dashboard' },
    { role: 'Agents', url: '/staff', heading: 'Agent dashboard' },
  ])(
    'opens the $role dashboard and displays the account after authenticated login',
    async ({ role, url, heading }) => {
      const harness = await RouterTestingHarness.create();
      const page = await harness.navigateByUrl('/sign-in', AuthPage);
      page.email = 'alex@example.com';
      page.password = 'password';
      page.submit(true);
      const token = `header.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 60 }))}.signature`;
      http.expectOne('/api/auth/login').flush({ token });
      const home = http.expectOne('/api/home/index');
      expect(home.request.headers.get('Authorization')).toBe(`Bearer ${token}`);
      home.flush({ message: 'Welcome to Insurance Portal', authenticatedUser: 'alex@example.com' });
      const profile = http.expectOne('/api/auth/me');
      expect(profile.request.headers.get('Authorization')).toBe(`Bearer ${token}`);
      profile.flush({
        id: 'user-id',
        email: 'alex@example.com',
        firstName: 'Alex',
        lastName: 'Morgan',
        isActive: true,
        roles: [role],
      });
      await harness.fixture.whenStable();
      expect(TestBed.inject(Router).url).toBe(url);
      expect(harness.routeNativeElement?.textContent).toContain(heading);
      expect(harness.routeNativeElement?.querySelector('.account')?.textContent).toContain(
        'Alex Morgan',
      );
      expect(harness.routeNativeElement?.querySelector('.account')?.textContent).toContain(
        'alex@example.com',
      );
      expect(harness.routeNativeElement?.querySelector('.account')?.textContent).toContain(role);
    },
  );
});

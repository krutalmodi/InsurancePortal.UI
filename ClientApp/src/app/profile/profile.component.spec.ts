import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../app.routes';
import { authInterceptor } from '../core/auth.interceptor';
import { SessionService } from '../core/session.service';
import { ProfilePage } from './profile.component';

describe('Profile editing', () => {
  let http: HttpTestingController;
  let session: SessionService;
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
    session = TestBed.inject(SessionService);
    session.token = 'test-token';
  });
  afterEach(() => http.verify());

  it.each([
    { role: 'Registered', url: '/portal/profile' },
    { role: 'Admin', url: '/staff/profile' },
    { role: 'Agents', url: '/staff/profile' },
  ])(
    'updates $role profile and header with the authenticated PATCH response',
    async ({ role, url }) => {
      session.user.set({
        id: 'id',
        email: 'user@example.com',
        firstName: 'Alex',
        lastName: null,
        isActive: true,
        roles: [role],
      });
      const harness = await RouterTestingHarness.create();
      await harness.navigateByUrl(url);
      const page = harness.fixture.debugElement.query(By.directive(ProfilePage))
        .componentInstance as ProfilePage;
      const form = harness.routeNativeElement!.querySelector('form')!;
      const lastName = form.querySelector<HTMLInputElement>('#profileLastName')!;
      lastName.value = ' Morgan ';
      lastName.dispatchEvent(new Event('input', { bubbles: true }));
      await harness.fixture.whenStable();
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await harness.fixture.whenStable();
      expect(form.querySelector('button')!.disabled).toBe(true);
      page.save(true);
      const request = http.expectOne('/api/auth/me');
      expect(request.request.method).toBe('PATCH');
      expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
      expect(request.request.body).toEqual({ lastName: 'Morgan' });
      request.flush(null, { status: 204, statusText: 'No Content' });
      await harness.fixture.whenStable();
      expect(session.user()?.lastName).toBe('Morgan');
      expect(harness.routeNativeElement?.querySelector('.account')?.textContent).toContain(
        'Alex Morgan',
      );
      expect(harness.routeNativeElement?.querySelector('[role=status]')?.textContent).toContain(
        'Profile updated.',
      );
      expect(form.querySelector('button')!.disabled).toBe(false);
    },
  );

  it('shows errors and permits retry without changing the saved profile', async () => {
    session.user.set({
      id: 'id',
      email: 'user@example.com',
      firstName: 'Alex',
      lastName: null,
      isActive: true,
      roles: ['Registered'],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/portal/profile');
    const page = harness.fixture.debugElement.query(By.directive(ProfilePage))
      .componentInstance as ProfilePage;
    page.firstName = 'Sam';
    page.save(true);
    http
      .expectOne('/api/auth/me')
      .flush({ error: 'Update failed' }, { status: 400, statusText: 'Bad Request' });
    await harness.fixture.whenStable();
    expect(session.user()?.firstName).toBe('Alex');
    expect(harness.routeNativeElement?.querySelector('[role=alert]')?.textContent).toContain(
      'Update failed',
    );
    page.save(true);
    const retry = http.expectOne('/api/auth/me');
    expect(retry.request.body).toEqual({ firstName: 'Sam' });
    retry.flush(null, { status: 204, statusText: 'No Content' });
    await harness.fixture.whenStable();
    expect(session.user()?.firstName).toBe('Sam');
  });

  it('expires the session if the profile update is unauthorized', async () => {
    session.user.set({
      id: 'id',
      email: 'user@example.com',
      firstName: 'Alex',
      lastName: null,
      isActive: true,
      roles: ['Registered'],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/portal/profile');
    const page = harness.fixture.debugElement.query(By.directive(ProfilePage))
      .componentInstance as ProfilePage;
    page.firstName = 'Sam';
    page.save(true);
    http.expectOne('/api/auth/me').flush(null, { status: 401, statusText: 'Unauthorized' });
    await harness.fixture.whenStable();
    expect(session.user()).toBeNull();
    expect(session.token).toBeNull();
    expect(harness.routeNativeElement?.textContent).toContain('Your session expired');
  });

  it('does not send an empty or unchanged update', async () => {
    session.user.set({
      id: 'id',
      email: 'user@example.com',
      firstName: 'Alex',
      lastName: null,
      isActive: true,
      roles: ['Registered'],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/portal/profile');
    const page = harness.fixture.debugElement.query(By.directive(ProfilePage))
      .componentInstance as ProfilePage;
    page.save(true);
    expect(page.notice).toContain('No changes');
    page.firstName = '   ';
    page.save(true);
    expect(page.error).toContain('cannot be blank');
    page.firstName = 'A'.repeat(101);
    page.save(false);
    expect(page.error).toContain('100 characters');
    http.expectNone('/api/auth/me');
  });
});

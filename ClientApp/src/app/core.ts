import { inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, Observable, switchMap, tap, throwError } from 'rxjs';

export interface UserProfile {
  id: string; email: string; firstName: string | null; lastName: string | null;
  isActive: boolean; roles: string[];
}
interface TokenResponse { token: string }
interface Features { quotesEnabled: boolean }

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private expiryTimer?: ReturnType<typeof setTimeout>;
  readonly user = signal<UserProfile | null>(null);
  token: string | null = null;

  signIn(email: string, password: string): Observable<UserProfile> {
    return this.http.post<TokenResponse>('/api/auth/login', { email, password }).pipe(
      switchMap(response => {
        if (!response.token) return throwError(() => new Error('The identity service did not return a token.'));
        this.token = response.token;
        return this.http.get<UserProfile>('/api/auth/me');
      }),
      tap(profile => {
        if (!profile.isActive) throw new Error('This account is inactive.');
        const payload = JSON.parse(atob(this.token!.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: number };
        const remaining = (payload.exp ?? 0) * 1000 - Date.now();
        if (remaining <= 0) throw new Error('Your session has expired. Please sign in again.');
        this.user.set(profile);
        this.expiryTimer = setTimeout(() => this.signOut(true), Math.min(remaining, 2147483647));
      }),
      catchError(error => { this.clear(); return throwError(() => error); })
    );
  }
  register(email: string, password: string): Observable<unknown> {
    return this.http.post('/api/auth/register', { email, password });
  }
  hasRole(...roles: string[]): boolean {
    return this.user()?.roles.some(role => roles.some(expected => role.toLowerCase() === expected.toLowerCase())) ?? false;
  }
  home(): string { return this.hasRole('Admin', 'Agents') ? '/staff' : this.hasRole('Registered') ? '/portal' : '/access-denied'; }
  signOut(expired = false): void {
    this.clear();
    void this.router.navigate(['/sign-in'], { queryParams: expired ? { expired: '1' } : {} });
  }
  private clear(): void { if (this.expiryTimer) clearTimeout(this.expiryTimer); this.token = null; this.user.set(null); }
}

@Injectable({ providedIn: 'root' })
export class FeatureService {
  private readonly http = inject(HttpClient);
  readonly quotesEnabled = signal(false);
  readonly error = signal('');
  load(): void {
    this.http.get<Features>('/api/ui/features').subscribe({
      next: features => { this.quotesEnabled.set(features.quotesEnabled); this.error.set(''); },
      error: () => { this.quotesEnabled.set(false); this.error.set('Feature availability could not be loaded. Please try again later.'); }
    });
  }
}

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const session = inject(SessionService);
  const authenticated = request.url.startsWith('/api/') && !!session.token;
  const outgoing = authenticated ? request.clone({ setHeaders: { Authorization: `Bearer ${session.token}` } }) : request;
  return next(outgoing).pipe(catchError((error: unknown) => {
    if (authenticated && error instanceof HttpErrorResponse && error.status === 401) session.signOut(true);
    return throwError(() => error);
  }));
};
export const authGuard: CanActivateFn = (_route, state) => {
  const session = inject(SessionService);
  return session.user() ? true : inject(Router).createUrlTree(['/sign-in'], { queryParams: { returnUrl: state.url } });
};
export const staffGuard: CanActivateFn = () => inject(SessionService).hasRole('Admin', 'Agents') || inject(Router).createUrlTree(['/access-denied']);
export const customerGuard: CanActivateFn = () => inject(SessionService).hasRole('Registered') || inject(Router).createUrlTree(['/access-denied']);

export function errorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (typeof error.error === 'string' && error.error.trim()) return error.error;
    if (typeof error.error?.error === 'string') return error.error.error;
    if (error.status === 0 || error.status >= 500) return 'The service is temporarily unavailable. Please try again.';
    if (error.status === 401) return 'Your email or password was not accepted.';
    return 'The request could not be completed. Please check your information and try again.';
  }
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

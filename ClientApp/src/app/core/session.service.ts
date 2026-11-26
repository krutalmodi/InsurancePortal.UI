import { inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, Observable, switchMap, tap, throwError } from 'rxjs';

export interface UserProfile {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
  roles: string[];
}
interface TokenResponse {
  token: string;
}

export interface Registration {
  email: string;
  password: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
}

export interface ProfileUpdate {
  firstName?: string;
  lastName?: string;
}

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private expiryTimer?: ReturnType<typeof setTimeout>;
  readonly user = signal<UserProfile | null>(null);
  token: string | null = null;

  signIn(email: string, password: string): Observable<UserProfile> {
    return this.http.post<TokenResponse>('/api/auth/login', { email, password }).pipe(
      switchMap((response) => {
        if (!response.token)
          return throwError(() => new Error('The identity service did not return a token.'));
        this.token = response.token;
        return this.verifySession(this.http.get('/api/home/index'), 'home check').pipe(
          switchMap(() =>
            this.verifySession(this.http.get<UserProfile>('/api/auth/me'), 'profile check'),
          ),
        );
      }),
      tap((profile) => {
        if (!profile.isActive) throw new Error('This account is inactive.');
        const payload = JSON.parse(
          atob(this.token!.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')),
        ) as { exp?: number };
        const remaining = (payload.exp ?? 0) * 1000 - Date.now();
        if (remaining <= 0) throw new Error('Your session has expired. Please sign in again.');
        this.user.set(profile);
        this.expiryTimer = setTimeout(() => this.signOut(true), Math.min(remaining, 2147483647));
      }),
      catchError((error) => {
        this.clear();
        return throwError(() => error);
      }),
    );
  }
  register(registration: Registration): Observable<{ message: string }> {
    return this.http.post<{ message: string }>('/api/auth/register', registration);
  }
  updateProfile(update: ProfileUpdate): Observable<void> {
    const userId = this.user()?.id;
    const token = this.token;
    return this.http
      .patch<void>('/api/auth/me', update)
      .pipe(
        tap(() =>
          this.user.update((user) =>
            user && user.id === userId && this.token === token ? { ...user, ...update } : user,
          ),
        ),
      );
  }
  hasRole(...roles: string[]): boolean {
    return (
      this.user()?.roles.some((role) =>
        roles.some((expected) => role.toLowerCase() === expected.toLowerCase()),
      ) ?? false
    );
  }
  home(): string {
    return this.hasRole('Admin', 'Agents')
      ? '/staff'
      : this.hasRole('Registered')
        ? '/portal'
        : '/access-denied';
  }
  signOut(expired = false): void {
    this.clear();
    void this.router.navigate(['/sign-in'], { queryParams: expired ? { expired: '1' } : {} });
  }
  private verifySession<T>(request: Observable<T>, check: string): Observable<T> {
    return request.pipe(
      catchError((error: unknown) =>
        throwError(() =>
          error instanceof HttpErrorResponse && error.status === 401
            ? new Error(
                `Sign-in succeeded, but the identity ${check} returned 401. Please try again or contact support.`,
              )
            : error,
        ),
      ),
    );
  }
  private clear(): void {
    if (this.expiryTimer) clearTimeout(this.expiryTimer);
    this.token = null;
    this.user.set(null);
  }
}

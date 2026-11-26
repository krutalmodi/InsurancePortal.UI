import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { SessionService } from './session.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const session = inject(SessionService);
  const token = request.url.startsWith('/api/') ? session.token : null;
  const outgoing = token
    ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : request;
  return next(outgoing).pipe(
    catchError((error: unknown) => {
      if (
        token &&
        session.token === token &&
        session.user() &&
        error instanceof HttpErrorResponse &&
        error.status === 401
      )
        session.signOut(true);
      return throwError(() => error);
    }),
  );
};

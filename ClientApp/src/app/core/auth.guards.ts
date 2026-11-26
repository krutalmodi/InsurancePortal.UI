import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from './session.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const session = inject(SessionService);
  return session.user()
    ? true
    : inject(Router).createUrlTree(['/sign-in'], { queryParams: { returnUrl: state.url } });
};
export const staffGuard: CanActivateFn = () =>
  inject(SessionService).hasRole('Admin', 'Agents') ||
  inject(Router).createUrlTree(['/access-denied']);
export const customerGuard: CanActivateFn = () =>
  inject(SessionService).hasRole('Registered') || inject(Router).createUrlTree(['/access-denied']);

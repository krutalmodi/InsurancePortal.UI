import { HttpErrorResponse } from '@angular/common/http';

export function errorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (typeof error.error === 'string' && error.error.trim()) return error.error;
    if (typeof error.error?.error === 'string') return error.error.error;
    if (error.status === 0 || error.status >= 500)
      return 'The service is temporarily unavailable. Please try again.';
    if (error.status === 401) return 'Your email or password was not accepted.';
    return 'The request could not be completed. Please check your information and try again.';
  }
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

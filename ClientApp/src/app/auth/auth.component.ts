import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SessionService } from '../core/session.service';
import { errorMessage } from '../core/error-message';

@Component({
  selector: 'app-auth',
  imports: [FormsModule, RouterLink],
  templateUrl: './auth.component.html',
})
export class AuthPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly changeDetector = inject(ChangeDetectorRef);
  readonly session = inject(SessionService);
  get registering(): boolean {
    return this.router.url.split('?')[0] === '/sign-up';
  }
  get returnUrl(): string | null {
    return this.route.snapshot.queryParamMap.get('returnUrl');
  }
  email = '';
  password = '';
  confirm = '';
  firstName = '';
  lastName = '';
  username = '';
  busy = false;
  error = '';
  notice = this.route.snapshot.queryParamMap.has('expired')
    ? 'Your session expired. Please sign in again.'
    : '';
  submit(valid: boolean): void {
    if (this.busy) return;
    this.error = '';
    this.notice = '';
    if (!valid) {
      this.error = 'Enter a valid email address and complete all required fields.';
      return;
    }
    if (this.registering && this.password !== this.confirm) {
      this.error = 'Passwords do not match.';
      return;
    }
    this.busy = true;
    if (this.registering) {
      this.session
        .register({
          email: this.email,
          password: this.password,
          firstName: this.firstName.trim() || null,
          lastName: this.lastName.trim() || null,
          username: this.username.trim() || null,
        })
        .subscribe({
          next: () => {
            this.busy = false;
            this.password = '';
            this.confirm = '';
            this.notice = 'Account created. Please sign in.';
            this.changeDetector.markForCheck();
            void this.router.navigate(['/sign-in'], {
              queryParams: { registered: '1', returnUrl: this.returnUrl },
            });
          },
          error: (e) => {
            this.busy = false;
            this.error = errorMessage(e);
            this.changeDetector.markForCheck();
          },
        });
    } else {
      this.session.signIn(this.email, this.password).subscribe({
        next: () => {
          this.busy = false;
          this.changeDetector.markForCheck();
          const target = this.route.snapshot.queryParamMap.get('returnUrl');
          const allowed =
            (target?.startsWith('/portal') && this.session.hasRole('Registered')) ||
            (target?.startsWith('/staff') && this.session.hasRole('Admin', 'Agents'));
          void this.router.navigateByUrl(
            allowed && target && !target.startsWith('//') ? target : this.session.home(),
          );
        },
        error: (e) => {
          this.busy = false;
          this.error = errorMessage(e);
          this.changeDetector.markForCheck();
        },
      });
    }
  }
  constructor() {
    if (this.route.snapshot.queryParamMap.has('registered'))
      this.notice = 'Account created. Please sign in.';
  }
}

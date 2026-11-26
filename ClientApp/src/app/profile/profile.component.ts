import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { errorMessage } from '../core/error-message';
import { ProfileUpdate, SessionService } from '../core/session.service';

@Component({
  selector: 'app-profile',
  imports: [FormsModule],
  templateUrl: './profile.component.html',
})
export class ProfilePage {
  readonly session = inject(SessionService);
  private readonly changeDetector = inject(ChangeDetectorRef);
  firstName = this.session.user()?.firstName ?? '';
  lastName = this.session.user()?.lastName ?? '';
  busy = false;
  error = '';
  notice = '';

  save(valid: boolean): void {
    if (this.busy) return;
    this.error = '';
    this.notice = '';
    const user = this.session.user();
    if (!user) {
      this.error = 'Your user profile is unavailable. Please sign in again.';
      return;
    }
    const firstName = this.firstName.trim();
    const lastName = this.lastName.trim();
    if (
      !valid ||
      (this.firstName && !firstName) ||
      (this.lastName && !lastName) ||
      (user.firstName && !firstName) ||
      (user.lastName && !lastName)
    ) {
      this.error = 'Names cannot be blank once provided, and must be at most 100 characters.';
      return;
    }
    const update: ProfileUpdate = {};
    if (firstName && firstName !== user.firstName) update.firstName = firstName;
    if (lastName && lastName !== user.lastName) update.lastName = lastName;
    if (!update.firstName && !update.lastName) {
      this.notice = 'No changes to save.';
      return;
    }
    this.busy = true;
    this.session.updateProfile(update).subscribe({
      next: () => {
        this.busy = false;
        this.firstName = firstName;
        this.lastName = lastName;
        this.notice = 'Profile updated.';
        this.changeDetector.markForCheck();
      },
      error: (error) => {
        this.busy = false;
        this.error = errorMessage(error);
        this.changeDetector.markForCheck();
      },
    });
  }
}

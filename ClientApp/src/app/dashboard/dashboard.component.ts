import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SessionService } from '../core/session.service';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink],
  templateUrl: './dashboard.component.html',
})
export class DashboardPage {
  private readonly router = inject(Router);
  readonly session = inject(SessionService);
  get staff(): boolean {
    return this.router.url.startsWith('/staff');
  }
  get admin(): boolean {
    return this.session.hasRole('Admin');
  }
}

import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SessionService } from '../core/session.service';

@Component({
  selector: 'app-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.css',
})
export class ShellPage {
  readonly session = inject(SessionService);
  private readonly router = inject(Router);
  menuOpen = false;
  get displayName(): string {
    const user = this.session.user();
    return [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || '';
  }
  get staff(): boolean {
    return this.router.url.startsWith('/staff');
  }
  get links(): { path: string; label: string; icon: string; exact: boolean; soon?: boolean }[] {
    const base = this.staff ? '/staff' : '/portal';
    const common = [{ path: base, label: 'Dashboard', icon: '▦', exact: true }];
    const pages = this.staff
      ? this.session.hasRole('Admin')
        ? [
            ['customers', 'Customers'],
            ['quotes', 'Quotes'],
            ['users', 'Users & roles'],
            ['policies', 'Policies'],
            ['payments', 'Payments'],
            ['claims', 'Claims'],
          ]
        : [
            ['customers', 'My customers'],
            ['quotes', 'Customer quotes'],
            ['policies', 'Policies'],
          ]
      : [
          ['quotes', 'My quotes'],
          ['policies', 'My policies'],
          ['payments', 'Payments'],
          ['claims', 'Claims'],
        ];
    return [
      ...common,
      ...pages.map(([path, label]) => ({
        path: `${base}/${path}`,
        label,
        icon: '▤',
        exact: false,
        soon: ['policies', 'payments', 'claims'].includes(path),
      })),
      { path: `${base}/profile`, label: 'My profile', icon: '○', exact: false },
    ];
  }
}

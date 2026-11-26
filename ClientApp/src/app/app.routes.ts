import { Routes } from '@angular/router';
import { authGuard, staffGuard, customerGuard } from './core/auth.guards';
import { PublicPage } from './public/public.component';
import { ProductPage } from './public/product/product.component';
import { AuthPage } from './auth/auth.component';
import { AccessDeniedPage } from './auth/access-denied/access-denied.component';
import { ShellPage } from './shell/shell.component';
import { DashboardPage } from './dashboard/dashboard.component';
import { ComingSoonPage } from './shared/coming-soon/coming-soon.component';
import { ProfilePage } from './profile/profile.component';
import { StaffPage } from './staff/staff.component';
import { QuoteWizardPage } from './quotes/quote-wizard/quote-wizard.component';
import { QuoteListPage } from './quotes/quote-list/quote-list.component';
import { QuoteDetailPage } from './quotes/quote-detail/quote-detail.component';

export const routes: Routes = [
  { path: '', component: PublicPage },
  { path: 'products/:product', component: ProductPage },
  { path: 'sign-in', component: AuthPage },
  { path: 'sign-up', component: AuthPage },
  { path: 'access-denied', component: AccessDeniedPage },
  {
    path: 'portal',
    component: ShellPage,
    canActivate: [authGuard, customerGuard],
    children: [
      { path: '', component: DashboardPage },
      { path: 'quotes', component: QuoteListPage },
      { path: 'quotes/new', component: QuoteWizardPage },
      { path: 'quotes/:id', component: QuoteDetailPage },
      { path: 'profile', component: ProfilePage },
      { path: ':section', component: ComingSoonPage },
    ],
  },
  {
    path: 'staff',
    component: ShellPage,
    canActivate: [authGuard, staffGuard],
    children: [
      { path: '', component: DashboardPage },
      { path: 'profile', component: ProfilePage },
      { path: ':section', component: StaffPage },
    ],
  },
  { path: '**', redirectTo: '' },
];

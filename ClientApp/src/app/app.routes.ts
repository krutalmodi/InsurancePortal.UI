import { Routes } from '@angular/router';
import { authGuard, staffGuard, customerGuard } from './core';
import { PublicPage, ProductPage, AuthPage, ShellPage, DashboardPage, ComingSoonPage, ProfilePage, StaffPage, AccessDeniedPage } from './pages';
import { QuoteWizardPage, QuoteListPage, QuoteDetailPage } from './quotes';

export const routes: Routes = [
  { path: '', component: PublicPage },
  { path: 'products/:product', component: ProductPage },
  { path: 'sign-in', component: AuthPage },
  { path: 'sign-up', component: AuthPage },
  { path: 'access-denied', component: AccessDeniedPage },
  { path: 'portal', component: ShellPage, canActivate: [authGuard, customerGuard], children: [
    { path: '', component: DashboardPage },
    { path: 'quotes', component: QuoteListPage },
    { path: 'quotes/new', component: QuoteWizardPage },
    { path: 'quotes/:id', component: QuoteDetailPage },
    { path: 'profile', component: ProfilePage },
    { path: ':section', component: ComingSoonPage }
  ] },
  { path: 'staff', component: ShellPage, canActivate: [authGuard, staffGuard], children: [
    { path: '', component: DashboardPage },
    { path: 'profile', component: ProfilePage },
    { path: ':section', component: StaffPage }
  ] },
  { path: '**', redirectTo: '' }
];

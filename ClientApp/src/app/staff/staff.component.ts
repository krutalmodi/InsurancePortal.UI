import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  selector: 'app-staff-page',
  imports: [RouterLink],
  templateUrl: './staff.component.html',
})
export class StaffPage {
  private readonly route = inject(ActivatedRoute);
  get title(): string {
    const value = this.route.snapshot.paramMap.get('section');
    return (
      (
        {
          customers: 'Customers',
          quotes: 'Quotes',
          users: 'Users & roles',
          policies: 'Policies',
          payments: 'Payments',
          claims: 'Claims',
        } as Record<string, string>
      )[value ?? ''] ?? 'This page'
    );
  }
}

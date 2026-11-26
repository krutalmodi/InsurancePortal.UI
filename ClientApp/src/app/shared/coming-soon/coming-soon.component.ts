import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  selector: 'app-coming-soon',
  imports: [RouterLink],
  templateUrl: './coming-soon.component.html',
})
export class ComingSoonPage {
  private readonly route = inject(ActivatedRoute);
  get title(): string {
    const value = this.route.snapshot.paramMap.get('section');
    return (
      (
        { policies: 'My policies', payments: 'Payments', claims: 'Claims' } as Record<
          string,
          string
        >
      )[value ?? ''] ?? 'This page'
    );
  }
}

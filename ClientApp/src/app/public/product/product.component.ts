import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  selector: 'app-product',
  imports: [RouterLink],
  templateUrl: './product.component.html',
})
export class ProductPage {
  private readonly route = inject(ActivatedRoute);
  get name(): string | undefined {
    const product = this.route.snapshot.paramMap.get('product') ?? '';
    return ({ auto: 'Auto', home: 'Home', health: 'Health' } as Record<string, string>)[product];
  }
}

import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-public',
  imports: [RouterLink],
  templateUrl: './public.component.html',
})
export class PublicPage {
  readonly products = [
    { name: 'Auto', icon: '◇', description: 'Explore coverage for your vehicle.' },
    { name: 'Home', icon: '⌂', description: 'Explore coverage for your home.' },
    { name: 'Health', icon: '+', description: 'Explore health insurance options.' },
  ];
}

import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Observable } from 'rxjs';

export interface Features {
  quoteCreationEnabled: boolean;
  quotesEnabled: boolean;
}

@Injectable({ providedIn: 'root' })
export class FeatureService {
  private readonly http = inject(HttpClient);
  readonly quoteCreationEnabled = signal(false);
  readonly quotesEnabled = signal(false);
  readonly error = signal('');

  getFeatures(): Observable<Features> {
    return this.http.get<Features>('/api/ui/features');
  }

  load(): void {
    this.getFeatures().subscribe({
      next: (features) => {
        this.quoteCreationEnabled.set(features.quoteCreationEnabled);
        this.quotesEnabled.set(features.quotesEnabled);
        this.error.set('');
      },
      error: () => {
        this.quoteCreationEnabled.set(false);
        this.quotesEnabled.set(false);
        this.error.set('Feature availability could not be loaded. Please try again later.');
      },
    });
  }
}

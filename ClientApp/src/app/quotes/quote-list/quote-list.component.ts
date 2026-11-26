import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FeatureService } from '../../core/feature.service';
import { errorMessage } from '../../core/error-message';
import { LookupItem } from '../../core/location.service';
import { Quote, productName } from '../quote.model';
import { QuoteLookupService } from '../quote-lookup.service';
import { QuoteService } from '../quote.service';

@Component({
  selector: 'app-quote-list',
  imports: [CommonModule, RouterLink],
  templateUrl: './quote-list.component.html',
})
export class QuoteListPage {
  readonly features = inject(FeatureService);
  private readonly quoteService = inject(QuoteService);
  private readonly quoteLookups = inject(QuoteLookupService);
  private readonly changeDetector = inject(ChangeDetectorRef);
  readonly productName = productName;
  quotes: Quote[] = [];
  statuses: LookupItem[] = [];
  statusFilter = '';
  loading = false;
  error = '';
  constructor() {
    this.load();
  }
  get visibleQuotes(): Quote[] {
    const filter = this.statusFilter.toLowerCase();
    return filter
      ? this.quotes.filter((q) => (q.status ?? '').toLowerCase() === filter)
      : this.quotes;
  }
  onStatusFilter(event: Event): void {
    this.statusFilter = (event.target as HTMLSelectElement).value;
  }
  statusLabel(status: string | undefined): string {
    const match = this.statuses.find((s) => s.code?.toLowerCase() === (status ?? '').toLowerCase());
    return match?.name ?? status ?? '—';
  }
  load(): void {
    this.features.getFeatures().subscribe({
      next: (f) => {
        this.features.quoteCreationEnabled.set(f.quoteCreationEnabled);
        this.features.quotesEnabled.set(f.quotesEnabled);
        this.features.error.set('');
      },
      error: () => {
        this.features.quoteCreationEnabled.set(false);
        this.features.error.set('Feature availability could not be loaded.');
      },
    });
    // GET /api/quotes/user is scoped to the token's user by the Quote Service.
    this.loadQuotes();
  }
  loadQuotes(): void {
    this.loading = true;
    this.error = '';
    this.changeDetector.markForCheck();
    this.quoteService.getMine().subscribe({
      next: (q) => {
        this.quotes = [...q].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        this.loading = false;
        this.changeDetector.markForCheck();
        this.quoteLookups.get('quote-statuses').subscribe({
          next: (s) => {
            this.statuses = s;
            this.changeDetector.markForCheck();
          },
          error: () => undefined, // the filter is optional; the list still works
        });
      },
      error: (e) => {
        this.error = errorMessage(e);
        this.loading = false;
        this.changeDetector.markForCheck();
      },
    });
  }
}

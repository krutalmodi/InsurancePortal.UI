import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { CreateResult, Quote, QuoteRequest } from './quote.model';

@Injectable({ providedIn: 'root' })
export class QuoteService {
  private readonly http = inject(HttpClient);
  getMine(): Observable<Quote[]> {
    return this.http.get<Quote[]>('/api/quotes/user');
  }
  getById(id: string): Observable<Quote> {
    return this.http.get<Quote>(`/api/quotes/${encodeURIComponent(id)}`);
  }
  create(request: QuoteRequest): Observable<CreateResult> {
    return this.http.post<CreateResult>('/api/quotes', request);
  }
  accept(id: string): Observable<Quote> {
    return this.http.post<Quote>(`/api/quotes/${encodeURIComponent(id)}/accept`, {});
  }
}

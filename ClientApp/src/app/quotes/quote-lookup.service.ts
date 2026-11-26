import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { LookupItem } from '../core/location.service';

export type QuoteLookupType =
  | 'quote-statuses'
  | 'product-types'
  | 'product-quote-statuses'
  | 'quoted-by-types'
  | 'vehicle-colors'
  | 'driving-record-types'
  | 'home-types'
  | 'health-statuses'
  | 'coverage-types'
  | 'smoking-statuses'
  | 'currencies'
  | 'insurance-providers'
  | 'vehicle-makes'
  | 'vehicle-models'
  | 'vehicle-types';

@Injectable({ providedIn: 'root' })
export class QuoteLookupService {
  private readonly http = inject(HttpClient);
  get(type: QuoteLookupType, vehicleMakeId?: number): Observable<LookupItem[]> {
    const params = vehicleMakeId ? new HttpParams().set('vehicleMakeId', vehicleMakeId) : undefined;
    return this.http.get<LookupItem[]>(`/api/lookups/${type}`, { params });
  }
}

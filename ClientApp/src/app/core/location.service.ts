import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface LookupItem {
  id: number;
  name: string;
  code?: string;
  description?: string | null;
}
export interface ProvinceItem extends LookupItem {
  countryId: number;
}

@Injectable({ providedIn: 'root' })
export class LocationService {
  private readonly http = inject(HttpClient);
  countries(): Observable<LookupItem[]> {
    return this.http.get<LookupItem[]>('/api/lookups/countries');
  }
  provinces(countryId: number): Observable<ProvinceItem[]> {
    return this.http.get<ProvinceItem[]>(`/api/lookups/countries/${countryId}/provinces`);
  }
  locationTypes(): Observable<LookupItem[]> {
    return this.http.get<LookupItem[]>('/api/lookups/location-types');
  }
}

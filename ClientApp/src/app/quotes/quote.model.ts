export interface Quote {
  id: string;
  userId: string;
  referenceNumber: string;
  createdAt: string;
  validUntil: string;
  totalPremium: number;
  status: string;
  autoQuote?: Product;
  homeQuote?: Product;
  healthQuote?: Product;
}
export interface Product {
  location?: Record<string, unknown>;
  rating?: Record<string, unknown>;
  [key: string]: unknown;
}
export interface CreateResult {
  message?: string;
  quote: Quote;
  referenceNumber: string;
}
export interface QuoteRequest {
  productType: number;
  [key: string]: unknown;
}
export function productName(quote: Quote): string {
  return quote.autoQuote
    ? 'Auto'
    : quote.homeQuote
      ? 'Home'
      : quote.healthQuote
        ? 'Health'
        : 'Unknown';
}

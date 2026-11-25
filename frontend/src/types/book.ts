export interface Book {
  id: number;
  title: string;
  author: string;
  isbn: string;
  cost_usd: string | number;
  selling_price_local: string | number | null;
  price_currency: string | null;
  price_exchange_rate: string | number | null;
  stock_quantity: number;
  category: string;
  supplier_country: string;
  created_at: string;
  updated_at: string;
}

export interface BookPayload {
  title: string;
  author: string;
  isbn: string;
  cost_usd: number;
  stock_quantity: number;
  category: string;
  supplier_country: string;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface PriceCalculationResult {
  book_id: number;
  cost_usd: number;
  exchange_rate: number;
  cost_local: number;
  margin_percentage: number;
  selling_price_local: number;
  currency: string;
  used_fallback?: boolean;
  calculation_timestamp: string;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning';
  title: string;
  message: string;
}

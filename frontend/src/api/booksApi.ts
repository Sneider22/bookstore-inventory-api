import type {
  Book,
  BookPayload,
  PaginatedResponse,
  PriceCalculationResult,
} from '../types/book';

const RAW_BASE_URL =
  import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
const API_BASE_URL = RAW_BASE_URL.replace(/\/+$/, '');

export class ApiError extends Error {
  status: number;
  fieldErrors?: Record<string, string[]>;

  constructor(
    status: number,
    message: string,
    fieldErrors?: Record<string, string[]>
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T;
  }

  let data: unknown = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const obj = (data && typeof data === 'object' ? data : {}) as Record<
      string,
      unknown
    >;

    const fieldErrors: Record<string, string[]> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (key !== 'error' && key !== 'detail' && Array.isArray(val)) {
        fieldErrors[key] = val.map((item) => String(item));
      }
    }

    let message = `Error HTTP ${response.status}`;
    if (typeof obj.error === 'string') {
      message = obj.error;
    } else if (typeof obj.detail === 'string') {
      message = obj.detail;
    } else if (Object.keys(fieldErrors).length > 0) {
      message = Object.entries(fieldErrors)
        .map(([field, msgs]) => `${field}: ${msgs.join(', ')}`)
        .join(' | ');
    } else if (response.status === 404) {
      message = 'Recurso no encontrado (404).';
    } else if (response.status === 503) {
      message = 'Servicio externo no disponible (503).';
    } else if (response.status >= 500) {
      message = 'Error interno del servidor (500).';
    }

    throw new ApiError(
      response.status,
      message,
      Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined
    );
  }

  return data as T;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers || {}),
      },
      ...options,
    });
    return await handleResponse<T>(response);
  } catch (err) {
    if (err instanceof ApiError) {
      throw err;
    }
    throw new ApiError(
      0,
      'No se pudo conectar con el backend en ' + API_BASE_URL
    );
  }
}

export const booksApi = {
  // GET /books (y /books?page={page} cuando page > 1)
  list(page = 1): Promise<PaginatedResponse<Book>> {
    const query = page > 1 ? `?page=${page}` : '';
    return request<PaginatedResponse<Book>>(`/books${query}`);
  },

  // GET /books/search?category={category} (sin barra final)
  searchByCategory(
    category: string,
    page = 1
  ): Promise<PaginatedResponse<Book>> {
    const params = new URLSearchParams({
      category: category.trim(),
    });
    if (page > 1) {
      params.set('page', String(page));
    }
    return request<PaginatedResponse<Book>>(
      `/books/search?${params.toString()}`
    );
  },

  // GET /books/low-stock?threshold={threshold} (sin barra final)
  getLowStock(threshold = 10, page = 1): Promise<PaginatedResponse<Book>> {
    const params = new URLSearchParams({
      threshold: String(threshold),
    });
    if (page > 1) {
      params.set('page', String(page));
    }
    return request<PaginatedResponse<Book>>(
      `/books/low-stock?${params.toString()}`
    );
  },

  // Recorre páginas del endpoint seleccionado cuando hay filtros/ordenamientos extendidos
  async fetchAllPages(
    fetcher: (page: number) => Promise<PaginatedResponse<Book>>
  ): Promise<Book[]> {
    const all: Book[] = [];
    let currentPage = 1;
    const MAX_PAGES = 50;

    while (currentPage <= MAX_PAGES) {
      const res = await fetcher(currentPage);
      all.push(...res.results);
      if (!res.next) break;
      currentPage += 1;
    }

    return all;
  },

  // GET /books/{id}
  getById(id: number): Promise<Book> {
    return request<Book>(`/books/${id}`);
  },

  // POST /books
  create(payload: BookPayload): Promise<Book> {
    return request<Book>('/books', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // PUT /books/{id}
  update(id: number, payload: BookPayload): Promise<Book> {
    return request<Book>(`/books/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  // PATCH /books/{id} (para ajuste rápido de stock)
  patchStock(id: number, stock_quantity: number): Promise<Book> {
    return request<Book>(`/books/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ stock_quantity }),
    });
  },

  // DELETE /books/{id}
  remove(id: number): Promise<void> {
    return request<void>(`/books/${id}`, {
      method: 'DELETE',
    });
  },

  // POST /books/{id}/calculate-price
  calculatePrice(
    id: number,
    currency = 'EUR'
  ): Promise<PriceCalculationResult> {
    return request<PriceCalculationResult>(`/books/${id}/calculate-price`, {
      method: 'POST',
      body: JSON.stringify({ currency }),
    });
  },
};

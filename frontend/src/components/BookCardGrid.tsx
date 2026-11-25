import { Calculator, Eye, Loader2, Pencil, Trash2 } from 'lucide-react';
import type { Book } from '../types/book';
import { getCountryName } from '../utils/countries';

interface BookCardGridProps {
  books: Book[];
  isLoading: boolean;
  lowStockThreshold: number;
  onOpenDetail: (bookId: number) => void;
  onOpenCalculator: (book: Book) => void;
  onEdit: (book: Book) => void;
  onDelete: (book: Book) => void;
}

export function BookCardGrid({
  books,
  isLoading,
  lowStockThreshold,
  onOpenDetail,
  onOpenCalculator,
  onEdit,
  onDelete,
}: BookCardGridProps) {
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white py-14 text-center text-slate-500 dark:border-zinc-800/90 dark:bg-[#121215] dark:text-zinc-400 dark:ring-1 dark:ring-white/[0.04]">
        <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-[#0d5451] dark:text-emerald-400" />
        <p className="text-sm">Cargando inventario...</p>
      </div>
    );
  }

  if (books.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white py-14 text-center text-sm text-slate-500 dark:border-zinc-800/90 dark:bg-[#121215] dark:text-zinc-400 dark:ring-1 dark:ring-white/[0.04]">
        No hay libros que coincidan con los filtros actuales.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {books.map((book) => {
        const isLowStock = book.stock_quantity <= lowStockThreshold;

        return (
          <article
            key={book.id}
            className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-slate-300 hover:shadow-md dark:border-zinc-800/90 dark:bg-[#121215] dark:shadow-none dark:ring-1 dark:ring-white/[0.04] dark:hover:border-zinc-700"
          >
            <div>
              {/* Etiquetas superiores: categoría/país + stock */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-zinc-800/90 dark:text-zinc-300">
                    {book.category}
                  </span>
                  <span
                    title={getCountryName(book.supplier_country)}
                    className="rounded-md border border-slate-200 px-1.5 py-0.5 font-mono text-[11px] font-medium text-slate-600 dark:border-zinc-700/80 dark:text-zinc-400"
                  >
                    {book.supplier_country}
                  </span>
                </div>

                <span
                  className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${
                    isLowStock
                      ? 'bg-amber-100 text-amber-800 dark:border dark:border-amber-800/50 dark:bg-amber-950/70 dark:text-amber-300'
                      : 'bg-emerald-50 text-emerald-800 dark:border dark:border-emerald-800/50 dark:bg-emerald-950/70 dark:text-emerald-300'
                  }`}
                >
                  {book.stock_quantity} uds{isLowStock ? ' · Bajo' : ''}
                </span>
              </div>

              {/* Título editorial y autor */}
              <h3 className="mt-3 line-clamp-2 font-serif text-xl leading-snug font-bold tracking-tight text-slate-900 dark:text-zinc-100">
                {book.title}
              </h3>
              <p className="mt-0.5 truncate text-sm text-slate-500 dark:text-zinc-400">
                {book.author}
              </p>
              <p className="mt-2 font-mono text-xs text-slate-400 dark:text-zinc-500">
                ISBN {book.isbn} · #{book.id}
              </p>
            </div>

            <div className="mt-4">
              {/* Bloque de precios */}
              <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3.5 py-3 dark:border dark:border-zinc-800/80 dark:bg-zinc-950/70">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                    Costo USD
                  </p>
                  <p className="mt-0.5 font-mono text-sm font-semibold text-slate-800 dark:text-zinc-200">
                    ${Number(book.cost_usd).toFixed(2)}
                  </p>
                </div>

                {book.selling_price_local !== null ? (
                  <div className="text-right">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                      Precio local
                    </p>
                    <p className="font-serif text-2xl leading-none font-bold text-[#0d5451] dark:text-emerald-400">
                      {Number(book.selling_price_local).toFixed(2)}
                    </p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onOpenCalculator(book)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#0d5451] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#093e3c] dark:bg-emerald-600 dark:hover:bg-emerald-500"
                  >
                    <Calculator className="h-3.5 w-3.5" />
                    Calcular precio
                  </button>
                )}
              </div>

              {/* Acciones de la tarjeta */}
              <div className="mt-3.5 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-zinc-800/80">
                <button
                  type="button"
                  onClick={() => onOpenDetail(book.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Ver detalle
                </button>

                <div className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onOpenCalculator(book)}
                    title="Calcular Precio de Venta"
                    className="rounded-lg p-1.5 text-[#0d5451] transition hover:bg-[#0d5451]/10 dark:text-emerald-400 dark:hover:bg-emerald-950/50"
                  >
                    <Calculator className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onEdit(book)}
                    title="Editar"
                    className="rounded-lg p-1.5 text-slate-600 transition hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(book)}
                    title="Eliminar"
                    className="rounded-lg p-1.5 text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

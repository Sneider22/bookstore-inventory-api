import { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import type { Book, PriceCalculationResult } from '../types/book';
import { getCountryName } from '../utils/countries';
import { ModalShell } from './ModalShell';

interface BookDetailModalProps {
  book: Book | null;
  isLoading: boolean;
  isCalculating: boolean;
  calculationResult: PriceCalculationResult | null;
  onClose: () => void;
  onCalculate: (bookId: number, currency: string) => Promise<void>;
}

const CURRENCIES = ['EUR', 'VES', 'USD', 'GBP', 'MXN', 'COP'];

export function BookDetailModal({
  book,
  isLoading,
  isCalculating,
  calculationResult,
  onClose,
  onCalculate,
}: BookDetailModalProps) {
  const [currency, setCurrency] = useState('EUR');

  const activeResult =
    book && calculationResult && calculationResult.book_id === book.id
      ? calculationResult
      : null;

  const hasSavedPrice = book !== null && book.selling_price_local !== null;

  // Datos del último cálculo: preferimos activeResult (recién calculado),
  // si no hay, usamos los datos persistidos en el libro (price_currency, price_exchange_rate)
  const displayPrice = activeResult
    ? activeResult.selling_price_local
    : hasSavedPrice
      ? Number(book!.selling_price_local)
      : null;

  const displayCurrency = activeResult
    ? activeResult.currency
    : book?.price_currency ?? null;

  const displayExchangeRate = activeResult
    ? activeResult.exchange_rate
    : book?.price_exchange_rate != null
      ? Number(book.price_exchange_rate)
      : null;

  // cost_local = selling_price_local / 1.40  (margen fijo 40%)
  const displayCostLocal = activeResult
    ? activeResult.cost_local
    : hasSavedPrice && displayExchangeRate != null
      ? Number(book!.selling_price_local) / 1.4
      : null;

  const marginGain = activeResult
    ? (activeResult.selling_price_local - activeResult.cost_local).toFixed(2)
    : displayPrice != null && displayCostLocal != null
      ? (displayPrice - displayCostLocal).toFixed(2)
      : null;

  return (
    <ModalShell maxWidthClass="max-w-md">
      <div className="p-6 sm:p-7">
        {/* Encabezado de la carta */}
        <div className="flex items-start justify-between gap-4">
          <p className="text-xs font-medium tracking-wide text-slate-500 dark:text-zinc-400">
            {book ? `Detalle del libro · #${book.id}` : 'Detalle del libro'}
          </p>
          <button
            type="button"
            onClick={onClose}
            disabled={isCalculating}
            aria-label="Cerrar detalle"
            className="-mt-1 -mr-1 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-14 text-slate-500 dark:text-zinc-400">
            <Loader2 className="mb-3 h-6 w-6 animate-spin text-[#0d5451] dark:text-emerald-400" />
            <p className="text-sm">Cargando ficha del libro...</p>
          </div>
        ) : book ? (
          <div className="mt-1.5">
            {/* Título editorial y metadatos */}
            <h2 className="font-serif text-3xl leading-tight font-bold tracking-tight text-slate-900 dark:text-zinc-100">
              {book.title}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
              {book.author} · {book.category} ·{' '}
              <span title={getCountryName(book.supplier_country)}>
                {book.supplier_country}
              </span>
            </p>

            {/* Ficha rápida de inventario */}
            <div className="mt-4 flex flex-wrap items-center gap-2 border-y border-slate-100 py-2.5 text-xs text-slate-600 dark:border-zinc-800 dark:text-zinc-400">
              <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-slate-700 dark:bg-zinc-800/90 dark:text-zinc-300">
                ISBN: {book.isbn}
              </span>
              <span
                className={`rounded-md px-2 py-1 font-medium ${
                  book.stock_quantity <= 10
                    ? 'bg-amber-100 text-amber-800 dark:border dark:border-amber-800/50 dark:bg-amber-950/70 dark:text-amber-300'
                    : 'bg-emerald-50 text-emerald-800 dark:border dark:border-emerald-800/50 dark:bg-emerald-950/70 dark:text-emerald-300'
                }`}
              >
                Stock: {book.stock_quantity} uds
              </span>
              <span className="text-slate-400 dark:text-zinc-500">
                {getCountryName(book.supplier_country)}
              </span>
            </div>

            {/* Desglose de cálculo de precio */}
            <div className="mt-5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold tracking-wide text-slate-700 dark:text-zinc-300">
                  Cálculo del precio de venta
                </h3>
                {activeResult?.used_fallback && (
                  <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900 dark:border dark:border-amber-800/50 dark:bg-amber-950/70 dark:text-amber-300">
                    Tasa de respaldo
                  </span>
                )}
              </div>

              <dl className="mt-2 divide-y divide-slate-100 text-sm dark:divide-zinc-800/80">
                  <div className="flex items-center justify-between py-2.5">
                    <dt className="text-slate-500 dark:text-zinc-400">Costo original</dt>
                    <dd className="font-mono font-semibold text-slate-900 dark:text-zinc-100">
                      ${Number(book.cost_usd).toFixed(2)} USD
                    </dd>
                  </div>

                  <div className="flex items-center justify-between py-2.5">
                    <dt className="text-slate-500 dark:text-zinc-400">Tasa de cambio aplicada</dt>
                    <dd className="font-mono font-medium text-slate-900 dark:text-zinc-100">
                      {displayExchangeRate != null
                        ? `× ${Number(displayExchangeRate).toFixed(4)}`
                        : '—'}
                    </dd>
                  </div>

                  <div className="flex items-center justify-between py-2.5">
                    <dt className="text-slate-500 dark:text-zinc-400">
                      Costo en moneda local
                      {displayCurrency && (
                        <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                          {displayCurrency}
                        </span>
                      )}
                    </dt>
                    <dd className="font-mono font-medium text-slate-900 dark:text-zinc-100">
                      {displayCostLocal != null ? displayCostLocal.toFixed(2) : '—'}
                    </dd>
                  </div>

                  <div className="flex items-center justify-between py-2.5">
                    <dt className="text-slate-500 dark:text-zinc-400">Margen de ganancia</dt>
                    <dd className="font-mono font-medium text-slate-900 dark:text-zinc-100">
                      {marginGain !== null
                        ? `+ ${activeResult?.margin_percentage ?? 40}% (${marginGain})`
                        : '+ 40%'}
                    </dd>
                  </div>
                </dl>
            </div>

            {/* Caja destacada del precio de venta sugerido */}
            <div className="mt-4 rounded-xl bg-[#0d5451] px-5 py-4 text-white dark:border dark:border-emerald-800/60 dark:bg-emerald-950/80">
              <p className="text-xs font-medium text-teal-100/90 dark:text-emerald-300/90">
                Precio de venta sugerido
              </p>
              {displayPrice !== null ? (
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="font-serif text-4xl font-bold tracking-tight dark:text-emerald-300">
                    {displayPrice.toFixed(2)}
                  </span>
                  <span className="text-xs font-semibold tracking-wider text-teal-100 uppercase dark:text-emerald-400">
                    {displayCurrency ?? 'Local'}
                  </span>
                </div>
              ) : (
                <p className="mt-1 font-serif text-xl text-teal-100 dark:text-emerald-200">
                  Sin calcular aún
                </p>
              )}
              {activeResult && (
                <p className="mt-1.5 text-[11px] text-teal-100/75 dark:text-emerald-300/75">
                  Calculado el{' '}
                  {new Date(activeResult.calculation_timestamp).toLocaleString()}
                </p>
              )}
            </div>

            {/* Selector de moneda + botón principal */}
            <div className="mt-4 flex items-center gap-2.5">
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                disabled={isCalculating}
                aria-label="Moneda destino"
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-800 focus:border-[#0d5451] focus:outline-none dark:border-zinc-700/80 dark:bg-zinc-950/80 dark:text-zinc-100 dark:focus:border-emerald-500"
              >
                {CURRENCIES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => onCalculate(book.id, currency)}
                disabled={isCalculating}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#0d5451] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#093e3c] disabled:opacity-60 dark:bg-emerald-600 dark:hover:bg-emerald-500"
              >
                {isCalculating && <Loader2 className="h-4 w-4 animate-spin" />}
                {displayPrice !== null
                  ? 'Recalcular precio de venta'
                  : 'Calcular precio de venta'}
              </button>
            </div>
          </div>
        ) : (
          <p className="py-10 text-center text-sm text-slate-500 dark:text-zinc-400">
            No se encontró el libro solicitado.
          </p>
        )}
      </div>
    </ModalShell>
  );
}

import { useMemo, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import type { Book, BookPayload } from '../types/book';
import { getAllCountryOptions } from '../utils/countries';
import { ModalShell } from './ModalShell';

interface BookFormModalProps {
  book: Book | null;
  isSubmitting: boolean;
  serverFieldErrors?: Record<string, string[]>;
  onClose: () => void;
  onSubmit: (payload: BookPayload) => Promise<void>;
}

interface FormState {
  title: string;
  author: string;
  isbn: string;
  cost_usd: string;
  stock_quantity: string;
  category: string;
  supplier_country: string;
}

const SUGGESTED_CATEGORIES = [
  'Literatura Clásica',
  'Novela',
  'Ficción',
  'Tecnología',
  'Ciencia',
  'Historia',
];

function validateIsbn(rawIsbn: string): boolean {
  const clean = rawIsbn.replace(/[-\s]/g, '').toUpperCase();
  return /^\d{9}[\dX]$/.test(clean) || /^\d{13}$/.test(clean);
}

export function BookFormModal({
  book,
  isSubmitting,
  serverFieldErrors,
  onClose,
  onSubmit,
}: BookFormModalProps) {
  const [form, setForm] = useState<FormState>({
    title: book?.title ?? '',
    author: book?.author ?? '',
    isbn: book?.isbn ?? '',
    cost_usd: book ? String(book.cost_usd) : '',
    stock_quantity: book ? String(book.stock_quantity) : '0',
    category: book?.category ?? '',
    supplier_country: book?.supplier_country
      ? book.supplier_country.toUpperCase()
      : '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const countryOptions = useMemo(
    () => getAllCountryOptions(book?.supplier_country),
    [book?.supplier_country]
  );

  const validate = (): boolean => {
    const nextErrors: Record<string, string> = {};

    if (!form.title.trim()) nextErrors.title = 'El título es obligatorio.';
    if (!form.author.trim()) nextErrors.author = 'El autor es obligatorio.';

    if (!form.isbn.trim()) {
      nextErrors.isbn = 'El ISBN es obligatorio.';
    } else if (!validateIsbn(form.isbn)) {
      nextErrors.isbn = 'El ISBN debe tener formato válido de 10 o 13 dígitos.';
    }

    const cost = Number(form.cost_usd);
    if (!form.cost_usd || Number.isNaN(cost) || cost <= 0) {
      nextErrors.cost_usd = 'El costo en USD debe ser mayor a 0.';
    }

    const stock = Number(form.stock_quantity);
    if (
      form.stock_quantity === '' ||
      Number.isNaN(stock) ||
      !Number.isInteger(stock) ||
      stock < 0
    ) {
      nextErrors.stock_quantity =
        'El stock debe ser un número entero mayor o igual a 0.';
    }

    if (!form.category.trim()) {
      nextErrors.category = 'La categoría es obligatoria.';
    }

    const validCodes = new Set(countryOptions.map((c) => c.code));
    if (!form.supplier_country || !validCodes.has(form.supplier_country)) {
      nextErrors.supplier_country = 'Selecciona un país proveedor válido.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    await onSubmit({
      title: form.title.trim(),
      author: form.author.trim(),
      isbn: form.isbn.trim(),
      cost_usd: Number(Number(form.cost_usd).toFixed(2)),
      stock_quantity: Number(form.stock_quantity),
      category: form.category.trim(),
      supplier_country: form.supplier_country.trim().toUpperCase(),
    });
  };

  const getFieldError = (field: keyof FormState): string | undefined => {
    if (errors[field]) return errors[field];
    const serverMsgs = serverFieldErrors?.[field];
    return serverMsgs?.length ? serverMsgs.join(' ') : undefined;
  };

  const inputClass =
    'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0d5451] focus:outline-none dark:border-zinc-700/80 dark:bg-zinc-950/80 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-emerald-500';

  return (
    <ModalShell maxWidthClass="max-w-lg">
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-zinc-800">
        <div>
          <p className="text-xs font-medium text-slate-400 dark:text-zinc-500">
            {book ? `Edición · #${book.id}` : 'Registro de inventario'}
          </p>
          <h2 className="font-serif text-2xl font-bold text-slate-900 dark:text-zinc-100">
            {book ? 'Editar libro' : 'Nuevo libro'}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          aria-label="Cerrar formulario"
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 p-6">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-zinc-400">
            Título
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Ej. El Quijote"
            className={inputClass}
          />
          {getFieldError('title') && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              {getFieldError('title')}
            </p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-zinc-400">
            Autor
          </label>
          <input
            type="text"
            value={form.author}
            onChange={(e) => setForm({ ...form, author: e.target.value })}
            placeholder="Ej. Miguel de Cervantes"
            className={inputClass}
          />
          {getFieldError('author') && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              {getFieldError('author')}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-zinc-400">
              ISBN (10 o 13 dígitos)
            </label>
            <input
              type="text"
              value={form.isbn}
              onChange={(e) => setForm({ ...form, isbn: e.target.value })}
              placeholder="978-84-376-0494-7"
              className={`${inputClass} font-mono`}
            />
            {getFieldError('isbn') && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                {getFieldError('isbn')}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-zinc-400">
              Categoría
            </label>
            <input
              type="text"
              list="book-categories-list"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="Literatura Clásica"
              className={inputClass}
            />
            <datalist id="book-categories-list">
              {SUGGESTED_CATEGORIES.map((cat) => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {SUGGESTED_CATEGORIES.slice(0, 4).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setForm({ ...form, category: cat })}
                  className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-100 dark:border-zinc-700 dark:bg-zinc-800/90 dark:text-zinc-300 dark:hover:bg-zinc-700/80"
                >
                  {cat}
                </button>
              ))}
            </div>
            {getFieldError('category') && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                {getFieldError('category')}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-zinc-400">
              Costo (USD)
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={form.cost_usd}
              onChange={(e) => setForm({ ...form, cost_usd: e.target.value })}
              placeholder="15.99"
              className={`${inputClass} font-mono`}
            />
            {getFieldError('cost_usd') && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                {getFieldError('cost_usd')}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-zinc-400">
              Stock
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={form.stock_quantity}
              onChange={(e) =>
                setForm({ ...form, stock_quantity: e.target.value })
              }
              className={`${inputClass} font-mono`}
            />
            {getFieldError('stock_quantity') && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                {getFieldError('stock_quantity')}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-zinc-400">
              País Proveedor
            </label>
            <select
              value={form.supplier_country}
              onChange={(e) =>
                setForm({ ...form, supplier_country: e.target.value })
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-900 focus:border-[#0d5451] focus:outline-none dark:border-zinc-700/80 dark:bg-zinc-950/80 dark:text-zinc-100 dark:focus:border-emerald-500"
            >
              <option value="">Selecciona...</option>
              {countryOptions.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
            {getFieldError('supplier_country') && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                {getFieldError('supplier_country')}
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-4 dark:border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800/90 dark:text-zinc-200 dark:hover:bg-zinc-700/80"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-xl bg-[#0d5451] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#093e3c] disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {book ? 'Guardar cambios' : 'Crear libro'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

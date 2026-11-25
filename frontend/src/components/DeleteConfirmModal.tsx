import { AlertTriangle, Loader2, X } from 'lucide-react';
import type { Book } from '../types/book';
import { ModalShell } from './ModalShell';

interface DeleteConfirmModalProps {
  book: Book;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function DeleteConfirmModal({
  book,
  isDeleting,
  onClose,
  onConfirm,
}: DeleteConfirmModalProps) {
  return (
    <ModalShell maxWidthClass="max-w-md">
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-red-50 p-2.5 text-red-600 dark:bg-red-950/60 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400 dark:text-zinc-500">
                Confirmar acción
              </p>
              <h2 className="font-serif text-xl font-bold text-slate-900 dark:text-zinc-100">
                Eliminar libro
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            aria-label="Cerrar confirmación"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
          ¿Estás seguro de que deseas eliminar{' '}
          <span className="font-semibold text-slate-900 dark:text-zinc-100">{book.title}</span>{' '}
          (ISBN: <code className="font-mono text-xs">{book.isbn}</code>)? Esta
          acción no se puede deshacer.
        </p>

        <div className="mt-6 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800/90 dark:text-zinc-200 dark:hover:bg-zinc-700/80"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
            Eliminar
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

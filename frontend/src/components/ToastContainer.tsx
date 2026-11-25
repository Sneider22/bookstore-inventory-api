import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import type { ToastMessage } from '../types/book';

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed right-4 bottom-4 z-50 flex w-full max-w-sm flex-col gap-2">
      {toasts.map((toast) => {
        const styles =
          toast.type === 'success'
            ? 'border-green-300 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950/80 dark:text-green-200'
            : toast.type === 'warning'
              ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/80 dark:text-amber-200'
              : 'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/80 dark:text-red-200';

        const Icon =
          toast.type === 'success'
            ? CheckCircle2
            : toast.type === 'warning'
              ? AlertTriangle
              : Info;

        return (
          <div
            key={toast.id}
            className={`flex items-start gap-3 rounded-lg border p-3 shadow-md ${styles}`}
          >
            <Icon className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold">{toast.title}</p>
              <p className="mt-0.5 break-words opacity-90">{toast.message}</p>
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="rounded p-1 opacity-70 hover:opacity-100"
              aria-label="Cerrar notificación"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

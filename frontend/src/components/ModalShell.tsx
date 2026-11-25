import { useEffect, type ReactNode } from 'react';

interface ModalShellProps {
  children: ReactNode;
  maxWidthClass?: string;
}

/**
 * Contenedor modal que oscurece el fondo manteniendo visible el contenido
 * detrás y bloquea el scroll del documento mientras está abierto.
 */
export function ModalShell({
  children,
  maxWidthClass = 'max-w-lg',
}: ModalShellProps) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-[2px] dark:bg-black/75 dark:backdrop-blur-xs"
    >
      <div
        className={`w-full ${maxWidthClass} rounded-2xl border border-slate-200/90 bg-white shadow-2xl dark:border-zinc-800 dark:bg-[#141417]`}
      >
        {children}
      </div>
    </div>
  );
}

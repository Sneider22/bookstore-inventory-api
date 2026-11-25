import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  options: SelectOption[];
  placeholder?: string;
  searchable?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  size?: 'sm' | 'md';
  direction?: 'down' | 'up';
  className?: string;
  onChange: (value: string) => void;
}

export function CustomSelect({
  value,
  options,
  placeholder = 'Selecciona...',
  searchable = false,
  disabled = false,
  ariaLabel,
  size = 'md',
  direction = 'down',
  className = '',
  onChange,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        opt.value.toLowerCase().includes(q)
    );
  }, [options, searchTerm]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleToggle = () => {
    if (disabled) return;
    setIsOpen((prev) => {
      if (prev) setSearchTerm('');
      return !prev;
    });
  };

  const handleSelect = (nextValue: string) => {
    onChange(nextValue);
    setIsOpen(false);
    setSearchTerm('');
  };

  const triggerPadding =
    size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm';

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        onClick={handleToggle}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border bg-white text-left transition focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-950/80 ${triggerPadding} ${
          isOpen
            ? 'border-[#0d5451] ring-2 ring-[#0d5451]/15 dark:border-emerald-500 dark:ring-emerald-500/20'
            : 'border-slate-200 hover:border-slate-300 dark:border-zinc-700/80 dark:hover:border-zinc-600'
        }`}
      >
        <span
          className={`truncate ${
            selectedOption
              ? 'text-slate-800 dark:text-zinc-100'
              : 'text-slate-400 dark:text-zinc-500'
          }`}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
            isOpen ? 'rotate-180 text-[#0d5451] dark:text-emerald-400' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div
          className={`absolute z-40 w-full min-w-[10.5rem] rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-zinc-800 dark:bg-[#141417] ${
            direction === 'up' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          }`}
        >
          {searchable && (
            <div className="relative mb-1.5">
              <Search className="pointer-events-none absolute top-2 left-2.5 h-3.5 w-3.5 text-slate-400 dark:text-zinc-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar..."
                autoFocus
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pr-2.5 pl-7 text-xs text-slate-800 focus:border-[#0d5451] focus:bg-white focus:outline-none dark:border-zinc-700/80 dark:bg-zinc-950/80 dark:text-zinc-100 dark:focus:border-emerald-500 dark:focus:bg-zinc-950"
              />
            </div>
          )}

          <ul
            role="listbox"
            className="max-h-56 space-y-0.5 overflow-y-auto overscroll-contain"
          >
            {filteredOptions.length === 0 ? (
              <li className="px-3 py-2 text-center text-xs text-slate-400 dark:text-zinc-500">
                Sin coincidencias
              </li>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <li key={opt.value || '__empty__'}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelect(opt.value)}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition sm:text-sm ${
                        isSelected
                          ? 'bg-[#0d5451]/10 font-semibold text-[#0d5451] dark:bg-emerald-950/70 dark:text-emerald-300'
                          : 'text-slate-700 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <span className="truncate">{opt.label}</span>
                      {isSelected && (
                        <Check className="h-3.5 w-3.5 shrink-0 text-[#0d5451] dark:text-emerald-400" />
                      )}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

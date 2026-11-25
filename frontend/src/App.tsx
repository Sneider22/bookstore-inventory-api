import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BookOpen,
  Calculator,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Layers,
  LayoutGrid,
  LayoutList,
  Loader2,
  Moon,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sun,
  Trash2,
  X,
} from 'lucide-react';
import { ApiError, booksApi } from './api/booksApi';
import { BookCardGrid } from './components/BookCardGrid';
import { BookDetailModal } from './components/BookDetailModal';
import { BookFormModal } from './components/BookFormModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { ToastContainer } from './components/ToastContainer';
import type {
  Book,
  BookPayload,
  PriceCalculationResult,
  ToastMessage,
} from './types/book';
import { formatCountryLabel, getCountryName } from './utils/countries';
import { exportBooksToCsv, exportBooksToExcel, exportBooksToPdf } from './utils/exportInventory';

type BackendMode = 'all' | 'category' | 'low-stock';

type SortOption =
  | 'oldest'
  | 'newest'
  | 'title_asc'
  | 'title_desc'
  | 'stock_desc'
  | 'stock_asc'
  | 'price_desc'
  | 'price_asc';

interface ComplementaryFilters {
  title: string;
  country: string;
  minPrice: number | null;
  maxPrice: number | null;
}

const PAGE_SIZE = 10;

const SUGGESTED_CATEGORIES = [
  'Literatura Clásica',
  'Novela',
  'Ficción',
  'Tecnología',
  'Ciencia',
  'Historia',
];

const DEFAULT_COMPLEMENTARY: ComplementaryFilters = {
  title: '',
  country: '',
  minPrice: null,
  maxPrice: null,
};

function useIsMobile(breakpointPx = 767): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= breakpointPx : false
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia(`(max-width: ${breakpointPx}px)`);
    const update = () => setIsMobile(mediaQuery.matches);
    update();
    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, [breakpointPx]);

  return isMobile;
}

function sortBooks(list: Book[], sortBy: SortOption): Book[] {
  const copy = [...list];
  copy.sort((a, b) => {
    switch (sortBy) {
      case 'newest':
        return (
          b.id - a.id ||
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      case 'oldest':
        return (
          a.id - b.id ||
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      case 'title_asc':
        return a.title.localeCompare(b.title, 'es', { sensitivity: 'base' });
      case 'title_desc':
        return b.title.localeCompare(a.title, 'es', { sensitivity: 'base' });
      case 'stock_desc':
        return b.stock_quantity - a.stock_quantity;
      case 'stock_asc':
        return a.stock_quantity - b.stock_quantity;
      case 'price_desc':
        return Number(b.cost_usd) - Number(a.cost_usd);
      case 'price_asc':
        return Number(a.cost_usd) - Number(b.cost_usd);
      default:
        return 0;
    }
  });
  return copy;
}

export function App() {
  // ── Dark Mode ────────────────────────────────────────────────────────────────
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);
  // ─────────────────────────────────────────────────────────────────────────────
  const [books, setBooks] = useState<Book[]>([]);
  const [catalogBooks, setCatalogBooks] = useState<Book[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);
  const [page, setPage] = useState(1);

  // Modo explícito de endpoint del backend (/books, /books/search, /books/low-stock)
  const [backendMode, setBackendMode] = useState<BackendMode>('all');
  const [categoryInput, setCategoryInput] = useState('');
  const [activeCategory, setActiveCategory] = useState('');
  const [thresholdInput, setThresholdInput] = useState('10');
  const [activeThreshold, setActiveThreshold] = useState(10);

  // Filtros complementarios locales (sobre la respuesta del endpoint activo)
  const [titleInput, setTitleInput] = useState('');
  const [showTitleSuggestions, setShowTitleSuggestions] = useState(false);
  const [countryInput, setCountryInput] = useState('');
  const [minPriceInput, setMinPriceInput] = useState('');
  const [maxPriceInput, setMaxPriceInput] = useState('');
  const [complementary, setComplementary] = useState<ComplementaryFilters>(
    DEFAULT_COMPLEMENTARY
  );

  const [sortBy, setSortBy] = useState<SortOption>('oldest');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const isMobile = useIsMobile();

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [serverFieldErrors, setServerFieldErrors] = useState<
    Record<string, string[]> | undefined
  >(undefined);

  const [deletingBook, setDeletingBook] = useState<Book | null>(null);
  const [calculationResult, setCalculationResult] =
    useState<PriceCalculationResult | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailBook, setDetailBook] = useState<Book | null>(null);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const titleContainerRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const addToast = useCallback(
    (type: ToastMessage['type'], title: string, message: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { id, type, title, message }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 5000);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Carga resumen completo del inventario para KPIs, países disponibles y autocompletado de título
  const fetchCatalogSummary = useCallback(async () => {
    try {
      const all = await booksApi.fetchAllPages((p) => booksApi.list(p));
      setCatalogBooks(all);
    } catch {
      // Silencioso: el manejo de errores visible ya ocurre en fetchBooks
    }
  }, []);

  const fetchBooks = useCallback(async () => {
    setIsLoading(true);
    try {
      const hasComplementaryFilters =
        Boolean(complementary.title) ||
        Boolean(complementary.country) ||
        complementary.minPrice !== null ||
        complementary.maxPrice !== null;

      const currentPageSize =
        viewMode === 'grid' ? (isMobile ? 6 : 12) : PAGE_SIZE;

      // Llamada directa al endpoint paginado correspondiente del backend cuando coincide con su orden natural
      if (!hasComplementaryFilters && sortBy === 'newest' && viewMode === 'table' && backendMode !== 'low-stock') {
        let data;
        if (backendMode === 'category' && activeCategory) {
          data = await booksApi.searchByCategory(activeCategory, page);
        } else {
          data = await booksApi.list(page);
        }
        setBooks(data.results);
        setTotalCount(data.count);
        setHasNext(Boolean(data.next));
        setHasPrevious(Boolean(data.previous));
        return;
      }

      // Cuando hay filtros complementarios o un orden distinto, consume el endpoint activo y refina
      const fetcher =
        backendMode === 'category' && activeCategory
          ? (p: number) => booksApi.searchByCategory(activeCategory, p)
          : backendMode === 'low-stock'
            ? (p: number) => booksApi.getLowStock(activeThreshold, p)
            : (p: number) => booksApi.list(p);

      const allBooks = await booksApi.fetchAllPages(fetcher);

      const titleQuery = complementary.title.toLowerCase();
      const countryQuery = complementary.country.toLowerCase();

      const filtered = allBooks.filter((book) => {
        if (
          titleQuery &&
          !book.title.toLowerCase().includes(titleQuery) &&
          !book.author.toLowerCase().includes(titleQuery)
        ) {
          return false;
        }
        if (
          countryQuery &&
          book.supplier_country.toLowerCase() !== countryQuery
        ) {
          return false;
        }
        const cost = Number(book.cost_usd);
        if (
          complementary.minPrice !== null &&
          cost < complementary.minPrice
        ) {
          return false;
        }
        if (
          complementary.maxPrice !== null &&
          cost > complementary.maxPrice
        ) {
          return false;
        }
        return true;
      });

      const sorted = sortBooks(filtered, sortBy);
      const total = sorted.length;
      const maxPage = Math.max(1, Math.ceil(total / currentPageSize));
      const safePage = Math.min(page, maxPage);
      const start = (safePage - 1) * currentPageSize;

      setBooks(sorted.slice(start, start + currentPageSize));
      setTotalCount(total);
      setHasPrevious(safePage > 1);
      setHasNext(safePage < maxPage);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? `${err.status ? `[${err.status}] ` : ''}${err.message}`
          : 'Error inesperado al cargar inventario.';
      addToast('error', 'Error al cargar libros', msg);
    } finally {
      setIsLoading(false);
    }
  }, [
    backendMode,
    activeCategory,
    activeThreshold,
    complementary,
    sortBy,
    viewMode,
    isMobile,
    page,
    addToast,
  ]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      await Promise.resolve();
      if (!active) return;
      await fetchBooks();
    };
    void load();
    return () => {
      active = false;
    };
  }, [fetchBooks]);

  useEffect(() => {
    let active = true;
    const loadSummary = async () => {
      await Promise.resolve();
      if (!active) return;
      await fetchCatalogSummary();
    };
    void loadSummary();
    return () => {
      active = false;
    };
  }, [fetchCatalogSummary]);

  // Cierra el autocompletado de título y menú de exportación al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        titleContainerRef.current &&
        !titleContainerRef.current.contains(event.target as Node)
      ) {
        setShowTitleSuggestions(false);
      }
      if (
        exportMenuRef.current &&
        !exportMenuRef.current.contains(event.target as Node)
      ) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Métricas del panel superior (KPIs)
  const kpiStats = useMemo(() => {
    const source = catalogBooks.length > 0 ? catalogBooks : books;
    const totalTitles =
      catalogBooks.length > 0 ? catalogBooks.length : totalCount;
    const totalUnits = source.reduce((sum, b) => sum + b.stock_quantity, 0);
    const lowStockCount = source.filter(
      (b) => b.stock_quantity <= activeThreshold
    ).length;
    const unpricedCount = source.filter(
      (b) => b.selling_price_local === null
    ).length;

    return { totalTitles, totalUnits, lowStockCount, unpricedCount };
  }, [catalogBooks, books, totalCount, activeThreshold]);

  // Países disponibles en los libros registrados para el selector de filtro
  const availableCountries = useMemo(() => {
    const codes = new Set<string>();
    const source = catalogBooks.length > 0 ? catalogBooks : books;
    for (const b of source) {
      if (b.supplier_country?.trim()) {
        codes.add(b.supplier_country.trim().toUpperCase());
      }
    }
    return Array.from(codes).sort((a, b) =>
      getCountryName(a).localeCompare(getCountryName(b), 'es')
    );
  }, [catalogBooks, books]);

  // Sugerencias de autocompletado mientras escribe en Título o Autor
  const titleSuggestions = useMemo(() => {
    const query = titleInput.trim().toLowerCase();
    if (!query) return [];
    const source = catalogBooks.length > 0 ? catalogBooks : books;
    return source
      .filter(
        (b) =>
          b.title.toLowerCase().includes(query) ||
          b.author.toLowerCase().includes(query)
      )
      .slice(0, 5);
  }, [titleInput, catalogBooks, books]);

  // Acción explícita para GET /books/search?category=... (o GET /books si está vacía)
  const handleCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = categoryInput.trim();
    if (!trimmed) {
      setActiveCategory('');
      setBackendMode('all');
      setPage(1);
      return;
    }
    setActiveCategory(trimmed);
    setBackendMode('category');
    setPage(1);
  };

  // Acción explícita para GET /books/low-stock?threshold=10
  const handleLowStockToggle = () => {
    if (backendMode === 'low-stock') {
      setBackendMode('all');
      setPage(1);
      return;
    }

    const parsed = Number(thresholdInput);
    if (
      thresholdInput.trim() === '' ||
      Number.isNaN(parsed) ||
      !Number.isInteger(parsed) ||
      parsed < 0
    ) {
      addToast(
        'warning',
        'Umbral inválido',
        'El umbral de stock bajo debe ser un entero mayor o igual a 0.'
      );
      return;
    }

    setActiveThreshold(parsed);
    setActiveCategory('');
    setCategoryInput('');
    setBackendMode('low-stock');
    setPage(1);
  };

  // Aplicar filtros complementarios (Título, País, Rango de precios)
  const handleApplyComplementary = (e: React.FormEvent) => {
    e.preventDefault();
    setShowTitleSuggestions(false);

    const parsedMin =
      minPriceInput.trim() === '' ? null : Number(minPriceInput);
    const parsedMax =
      maxPriceInput.trim() === '' ? null : Number(maxPriceInput);

    if (parsedMin !== null && (Number.isNaN(parsedMin) || parsedMin < 0)) {
      addToast(
        'warning',
        'Precio mínimo inválido',
        'El precio mínimo debe ser un número mayor o igual a 0.'
      );
      return;
    }

    if (parsedMax !== null && (Number.isNaN(parsedMax) || parsedMax < 0)) {
      addToast(
        'warning',
        'Precio máximo inválido',
        'El precio máximo debe ser un número mayor o igual a 0.'
      );
      return;
    }

    if (
      parsedMin !== null &&
      parsedMax !== null &&
      parsedMin > parsedMax
    ) {
      addToast(
        'warning',
        'Rango de precios inválido',
        'El precio mínimo no puede ser mayor que el precio máximo.'
      );
      return;
    }

    setComplementary({
      title: titleInput.trim(),
      country: countryInput.trim().toUpperCase(),
      minPrice: parsedMin,
      maxPrice: parsedMax,
    });
    setPage(1);
  };

  const handleSelectTitleSuggestion = (book: Book) => {
    setTitleInput(book.title);
    setShowTitleSuggestions(false);
    setComplementary((prev) => ({
      ...prev,
      title: book.title,
    }));
    setPage(1);
  };

  const handleCountrySelectChange = (value: string) => {
    setCountryInput(value);
    setComplementary((prev) => ({
      ...prev,
      country: value,
    }));
    setPage(1);
  };

  const handleResetAll = () => {
    setBackendMode('all');
    setCategoryInput('');
    setActiveCategory('');
    setThresholdInput('10');
    setActiveThreshold(10);
    setTitleInput('');
    setShowTitleSuggestions(false);
    setCountryInput('');
    setMinPriceInput('');
    setMaxPriceInput('');
    setComplementary(DEFAULT_COMPLEMENTARY);
    setSortBy('oldest');
    setPage(1);
  };

  const handleToggleColumnSort = (
    ascOption: SortOption,
    descOption: SortOption
  ) => {
    setSortBy((prev) => (prev === descOption ? ascOption : descOption));
    setPage(1);
  };

  const handleRefreshAll = async () => {
    await Promise.all([fetchBooks(), fetchCatalogSummary()]);
    addToast('success', 'Datos actualizados', 'Se ha recargado la información del inventario.');
  };

  const handleExport = async (format: 'pdf' | 'xlsx' | 'csv') => {
    setExportMenuOpen(false);
    setIsExporting(true);
    try {
      const fetcher =
        backendMode === 'category' && activeCategory
          ? (p: number) => booksApi.searchByCategory(activeCategory, p)
          : backendMode === 'low-stock'
            ? (p: number) => booksApi.getLowStock(activeThreshold, p)
            : (p: number) => booksApi.list(p);

      const allBooks = await booksApi.fetchAllPages(fetcher);
      const titleQuery = complementary.title.toLowerCase();
      const countryQuery = complementary.country.toLowerCase();

      const filtered = allBooks.filter((book) => {
        if (
          titleQuery &&
          !book.title.toLowerCase().includes(titleQuery) &&
          !book.author.toLowerCase().includes(titleQuery)
        ) {
          return false;
        }
        if (
          countryQuery &&
          book.supplier_country.toLowerCase() !== countryQuery
        ) {
          return false;
        }
        const cost = Number(book.cost_usd);
        if (complementary.minPrice !== null && cost < complementary.minPrice) {
          return false;
        }
        if (complementary.maxPrice !== null && cost > complementary.maxPrice) {
          return false;
        }
        return true;
      });

      const sorted = sortBooks(filtered, sortBy);

      if (sorted.length === 0) {
        addToast(
          'warning',
          'Sin datos para exportar',
          'No hay libros que coincidan con los filtros actuales.'
        );
        return;
      }

      if (format === 'xlsx') {
        exportBooksToExcel(sorted);
        addToast(
          'success',
          'Excel (.xlsx) exportado',
          `Se descargaron ${sorted.length} registros en hoja de cálculo Excel.`
        );
      } else if (format === 'csv') {
        exportBooksToCsv(sorted);
        addToast(
          'success',
          'CSV exportado',
          `Se descargaron ${sorted.length} registros en formato CSV.`
        );
      } else {
        const activeFilterParts: string[] = [];
        if (backendMode === 'category' && activeCategory) {
          activeFilterParts.push(`Categoría "${activeCategory}"`);
        }
        if (backendMode === 'low-stock') {
          activeFilterParts.push(`Stock <= ${activeThreshold}`);
        }
        if (complementary.title) {
          activeFilterParts.push(`Título/Autor "${complementary.title}"`);
        }
        if (complementary.country) {
          activeFilterParts.push(`País ${formatCountryLabel(complementary.country)}`);
        }
        if (complementary.minPrice !== null || complementary.maxPrice !== null) {
          activeFilterParts.push(
            `Costo $${complementary.minPrice ?? 0} - $${complementary.maxPrice ?? '∞'}`
          );
        }

        exportBooksToPdf(sorted, {
          lowStockThreshold: activeThreshold,
          filterSummary:
            activeFilterParts.length > 0 ? activeFilterParts.join(' · ') : undefined,
        });
        addToast(
          'success',
          'PDF generado',
          `Reporte Bookstore Inventory con ${sorted.length} libros descargado.`
        );
      }
    } catch {
      addToast(
        'error',
        'Error al exportar',
        'No se pudo generar el archivo de exportación.'
      );
    } finally {
      setIsExporting(false);
    }
  };

  const openCreateModal = () => {
    setEditingBook(null);
    setServerFieldErrors(undefined);
    setFormModalOpen(true);
  };

  const openEditModal = (book: Book) => {
    setEditingBook(book);
    setServerFieldErrors(undefined);
    setFormModalOpen(true);
  };

  const handleFormSubmit = async (payload: BookPayload) => {
    setIsSubmitting(true);
    setServerFieldErrors(undefined);
    try {
      if (editingBook) {
        await booksApi.update(editingBook.id, payload);
        addToast(
          'success',
          'Libro actualizado',
          `"${payload.title}" se actualizó correctamente.`
        );
      } else {
        await booksApi.create(payload);
        addToast(
          'success',
          'Libro creado',
          `"${payload.title}" se agregó al inventario.`
        );
      }
      setFormModalOpen(false);
      setEditingBook(null);
      await handleRefreshAll();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.fieldErrors) {
          setServerFieldErrors(err.fieldErrors);
        }
        addToast(
          'error',
          `Error al guardar (${err.status || 'Red'})`,
          err.message
        );
      } else {
        addToast('error', 'Error', 'Ocurrió un error inesperado.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingBook) return;
    setIsDeleting(true);
    try {
      await booksApi.remove(deletingBook.id);
      addToast(
        'success',
        'Libro eliminado',
        `"${deletingBook.title}" fue eliminado.`
      );
      setDeletingBook(null);
      if (books.length === 1 && page > 1) {
        setPage((p) => p - 1);
        await fetchCatalogSummary();
      } else {
        await handleRefreshAll();
      }
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? `[${err.status}] ${err.message}`
          : 'No se pudo eliminar el libro.';
      addToast('error', 'Error al eliminar', msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenDetail = async (bookId: number) => {
    setDetailOpen(true);
    setDetailBook(null);
    setIsLoadingDetail(true);
    try {
      const freshBook = await booksApi.getById(bookId);
      setDetailBook(freshBook);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? `[${err.status}] ${err.message}`
          : 'No se pudo obtener el detalle del libro.';
      addToast('error', 'Error al consultar detalle', msg);
      setDetailOpen(false);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleOpenCalculator = (book: Book) => {
    setDetailBook(book);
    setIsLoadingDetail(false);
    setDetailOpen(true);
  };

  const handleCalculatePrice = async (bookId: number, currency: string) => {
    setIsCalculating(true);
    try {
      const res = await booksApi.calculatePrice(bookId, currency);
      setCalculationResult(res);
      setDetailBook((prev) =>
        prev && prev.id === bookId
          ? { ...prev, selling_price_local: res.selling_price_local, price_currency: res.currency, price_exchange_rate: res.exchange_rate }
          : prev
      );
      setBooks((prev) =>
        prev.map((b) =>
          b.id === bookId
            ? { ...b, selling_price_local: res.selling_price_local, price_currency: res.currency, price_exchange_rate: res.exchange_rate }
            : b
        )
      );
      setCatalogBooks((prev) =>
        prev.map((b) =>
          b.id === bookId
            ? { ...b, selling_price_local: res.selling_price_local, price_currency: res.currency, price_exchange_rate: res.exchange_rate }
            : b
        )
      );
      if (res.used_fallback) {
        addToast(
          'warning',
          'Cálculo completado con tasa de respaldo',
          `La API externa falló; se aplicó tasa por defecto para ${res.currency}.`
        );
      } else {
        addToast(
          'success',
          'Precio calculado',
          `Precio sugerido: ${res.selling_price_local.toFixed(2)} ${res.currency}`
        );
      }
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? `[${err.status}] ${err.message}`
          : 'Error al calcular el precio.';
      addToast('error', 'Error en cálculo de precio', msg);
    } finally {
      setIsCalculating(false);
    }
  };

  const hasAnyActiveFilterOrSort =
    backendMode !== 'all' ||
    Boolean(complementary.title) ||
    Boolean(complementary.country) ||
    complementary.minPrice !== null ||
    complementary.maxPrice !== null ||
    sortBy !== 'oldest';

  const complementaryCount =
    (complementary.title ? 1 : 0) +
    (complementary.country ? 1 : 0) +
    (complementary.minPrice !== null || complementary.maxPrice !== null ? 1 : 0);

  const activePageSize = viewMode === 'grid' ? (isMobile ? 6 : 12) : PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(totalCount / activePageSize));

  const renderSortIcon = (ascOption: SortOption, descOption: SortOption) => {
    if (sortBy === ascOption) {
      return <ArrowUp className="h-3.5 w-3.5 text-blue-600" />;
    }
    if (sortBy === descOption) {
      return <ArrowDown className="h-3.5 w-3.5 text-blue-600" />;
    }
    return <ArrowUpDown className="h-3.5 w-3.5 text-gray-400" />;
  };

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip bg-[#eef3f0] text-slate-900 transition-colors duration-200 dark:bg-[#09090b] dark:text-zinc-100">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white transition-colors dark:border-zinc-800/90 dark:bg-[#121215]">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-[#0d5451]/10 p-2 text-[#0d5451] dark:border dark:border-emerald-800/60 dark:bg-emerald-950/80 dark:text-emerald-400">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <h1 className="font-serif text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
                  Bookstore Inventory
                </h1>
                <p className="text-xs text-slate-500 sm:text-sm dark:text-zinc-400">
                  Gestión de inventario y precios sugeridos
                </p>
              </div>
            </div>

            {/* Dark Mode Toggle en esquina superior derecha en móvil */}
            <button
              type="button"
              onClick={() => setDarkMode((v) => !v)}
              aria-label={darkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              title={darkMode ? 'Modo claro' : 'Modo oscuro'}
              className="inline-flex shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-600 transition-colors hover:bg-slate-50 sm:hidden dark:border-zinc-700 dark:bg-zinc-800/90 dark:text-zinc-200 dark:hover:bg-zinc-700/80"
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>

          <div className="flex w-full items-center gap-2 sm:w-auto sm:justify-end">
            {/* Exportar CSV / Excel / PDF */}
            <div ref={exportMenuRef} className="relative flex-1 sm:flex-none">
              <button
                type="button"
                onClick={() => setExportMenuOpen((v) => !v)}
                disabled={isExporting || isLoading}
                className="inline-flex w-full items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 sm:w-auto sm:gap-1.5 sm:px-3 sm:text-sm dark:border-zinc-700 dark:bg-zinc-800/90 dark:text-zinc-200 dark:hover:bg-zinc-700/80"
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 shrink-0" />
                )}
                <span className="hidden sm:inline">Exportar</span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-zinc-400" />
              </button>

              {exportMenuOpen && (
                <div className="absolute left-0 z-30 mt-1.5 w-60 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl sm:left-auto sm:right-0 dark:border-zinc-800 dark:bg-[#141417]">
                  <button
                    type="button"
                    onClick={() => void handleExport('pdf')}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-[#0d5451] dark:text-emerald-400" />
                    <div>
                      <p className="font-medium">Exportar PDF</p>
                      <p className="text-[11px] text-slate-400 dark:text-zinc-500">
                        Reporte Bookstore Inventory
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleExport('xlsx')}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <FileSpreadsheet className="h-4 w-4 shrink-0 text-[#0d5451] dark:text-emerald-400" />
                    <div>
                      <p className="font-medium">Exportar Excel (.xlsx)</p>
                      <p className="text-[11px] text-slate-400 dark:text-zinc-500">
                        Columnas nativas autoajustadas
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleExport('csv')}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <FileSpreadsheet className="h-4 w-4 shrink-0 text-slate-400 dark:text-zinc-400" />
                    <div>
                      <p className="font-medium">Exportar CSV</p>
                      <p className="text-[11px] text-slate-400 dark:text-zinc-500">
                        Delimitado por punto y coma (;)
                      </p>
                    </div>
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleRefreshAll}
              disabled={isLoading}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 sm:flex-none sm:px-3.5 sm:text-sm dark:border-zinc-700 dark:bg-zinc-800/90 dark:text-zinc-200 dark:hover:bg-zinc-700/80"
            >
              <RefreshCw className={`h-4 w-4 shrink-0 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refrescar</span>
            </button>

            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-[#0f3d33] px-3 py-2 text-[13px] font-semibold text-white transition hover:bg-[#165245] sm:flex-none sm:gap-1.5 sm:px-4 sm:text-sm dark:bg-emerald-700 dark:text-white dark:hover:bg-emerald-600"
            >
              <Plus className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Nuevo Libro</span>
              <span className="sm:hidden">Nuevo</span>
            </button>

            {/* Dark Mode Toggle en escritorio */}
            <button
              type="button"
              onClick={() => setDarkMode((v) => !v)}
              aria-label={darkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              title={darkMode ? 'Modo claro' : 'Modo oscuro'}
              className="hidden items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-600 transition-colors hover:bg-slate-50 sm:inline-flex dark:border-zinc-700 dark:bg-zinc-800/90 dark:text-zinc-200 dark:hover:bg-zinc-700/80"
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto w-full max-w-7xl flex-1 space-y-4 px-3 py-4 sm:space-y-5 sm:px-6 sm:py-6">
        {/* Panel resumen KPIs */}
        <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <div className="flex items-start justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-3.5 transition-colors sm:p-4 dark:border-zinc-800/90 dark:bg-[#121215] dark:shadow-none dark:ring-1 dark:ring-white/[0.04]">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                Total libros
              </p>
              <p className="mt-1 font-serif text-2xl font-bold text-slate-900 sm:text-3xl dark:text-zinc-100">
                {kpiStats.totalTitles}
              </p>
            </div>
            <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 dark:text-zinc-500" />
          </div>

          <div className="flex items-start justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-3.5 transition-colors sm:p-4 dark:border-zinc-800/90 dark:bg-[#121215] dark:shadow-none dark:ring-1 dark:ring-white/[0.04]">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                En stock
              </p>
              <p className="mt-1 font-serif text-2xl font-bold text-slate-900 sm:text-3xl dark:text-zinc-100">
                {kpiStats.totalUnits}
              </p>
            </div>
            <Layers className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 dark:text-zinc-500" />
          </div>

          <button
            type="button"
            onClick={handleLowStockToggle}
            className={`flex items-start justify-between gap-2 rounded-2xl border p-3.5 text-left transition sm:p-4 dark:shadow-none dark:ring-1 dark:ring-white/[0.04] ${
              backendMode === 'low-stock'
                ? 'border-amber-400/80 bg-amber-50/60 dark:border-amber-700/60 dark:bg-amber-950/25'
                : 'border-slate-200 bg-white hover:border-slate-300 dark:border-zinc-800/90 dark:bg-[#121215] dark:hover:border-zinc-700'
            }`}
            title="Haz clic para filtrar libros con stock bajo"
          >
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 truncate text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                {kpiStats.lowStockCount > 0 && (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                )}
                <span>Stock ≤ {activeThreshold}</span>
              </p>
              <p
                className={`mt-1 font-serif text-2xl font-bold sm:text-3xl ${
                  kpiStats.lowStockCount > 0
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-slate-900 dark:text-zinc-100'
                }`}
              >
                {kpiStats.lowStockCount}
              </p>
            </div>
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 dark:text-zinc-500" />
          </button>

          <div className="flex items-start justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-3.5 transition-colors sm:p-4 dark:border-zinc-800/90 dark:bg-[#121215] dark:shadow-none dark:ring-1 dark:ring-white/[0.04]">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                Sin precio
              </p>
              <p className="mt-1 font-serif text-2xl font-bold text-slate-900 sm:text-3xl dark:text-zinc-100">
                {kpiStats.unpricedCount}
              </p>
            </div>
            <Calculator className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 dark:text-zinc-500" />
          </div>
        </section>

        {/* Filtros */}
        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3.5 transition-colors sm:p-4 dark:border-zinc-800/90 dark:bg-[#121215] dark:shadow-none dark:ring-1 dark:ring-white/[0.04]">
          {/* Fila 1 */}
          <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:border-b sm:border-slate-100 sm:pb-3 dark:sm:border-zinc-800/80">
            <form onSubmit={handleCategorySubmit} className="flex w-full items-center gap-2 sm:w-auto">
              <div className="relative flex-1 sm:w-56">
                <Search className="pointer-events-none absolute top-2.5 left-2.5 h-4 w-4 text-slate-400 dark:text-zinc-500" />
                <input
                  type="text"
                  list="filter-categories-list"
                  value={categoryInput}
                  onChange={(e) => setCategoryInput(e.target.value)}
                  placeholder="Categoría..."
                  className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pr-3 pl-8 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0d5451] focus:outline-none dark:border-zinc-700/80 dark:bg-zinc-950/80 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-emerald-500"
                />
                <datalist id="filter-categories-list">
                  {SUGGESTED_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </div>
              <button
                type="submit"
                className="shrink-0 rounded-xl border border-slate-200 bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-200 dark:border-zinc-700 dark:bg-zinc-800/90 dark:text-zinc-200 dark:hover:bg-zinc-700/80"
              >
                Buscar
              </button>
            </form>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <form
                onSubmit={(e) => { e.preventDefault(); handleLowStockToggle(); }}
                className="flex items-center gap-1.5"
              >
                <label className="text-xs font-medium text-slate-500 dark:text-zinc-400">
                  Stock ≤
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={thresholdInput}
                  onChange={(e) => setThresholdInput(e.target.value)}
                  aria-label="Umbral de stock bajo"
                  className="w-14 rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-center text-sm text-slate-900 focus:border-[#0d5451] focus:outline-none dark:border-zinc-700/80 dark:bg-zinc-950/80 dark:text-zinc-100 dark:focus:border-emerald-500"
                />
                <button
                  type="submit"
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium sm:text-sm ${
                    backendMode === 'low-stock'
                      ? 'border-amber-400 bg-amber-100 text-amber-900 dark:border-amber-700/70 dark:bg-amber-950/70 dark:text-amber-300'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800/90 dark:text-zinc-200 dark:hover:bg-zinc-700/80'
                  }`}
                >
                  <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Low Stock
                </button>
              </form>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowMobileFilters((v) => !v)}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-medium sm:hidden ${
                    showMobileFilters || complementaryCount > 0
                      ? 'border-[#0d5451]/40 bg-[#0d5451]/10 text-[#0d5451] dark:border-emerald-700/60 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : 'border-slate-200 bg-white text-slate-700 dark:border-zinc-700 dark:bg-zinc-800/90 dark:text-zinc-200'
                  }`}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Filtros
                  {complementaryCount > 0 && (
                    <span className="rounded-full bg-[#0d5451] px-1.5 text-[10px] text-white dark:bg-emerald-600">
                      {complementaryCount}
                    </span>
                  )}
                </button>

                {hasAnyActiveFilterOrSort && (
                  <button
                    type="button"
                    onClick={handleResetAll}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#0d5451]/50 bg-[#0d5451]/10 px-3 py-1.5 text-xs font-semibold text-[#0d5451] transition hover:bg-[#0d5451]/20 sm:text-sm dark:border-emerald-700/60 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-950/90"
                  >
                    <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    Limpiar filtros
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Fila 2: Filtros complementarios */}
          <form
            onSubmit={handleApplyComplementary}
            className={`${
              showMobileFilters ? 'grid border-t border-slate-100 pt-3 dark:border-zinc-800/80' : 'hidden'
            } grid-cols-1 gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-4`}
          >
            <div ref={titleContainerRef} className="relative">
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-zinc-400">
                Filtrar por título o autor
              </label>
              <input
                type="text"
                value={titleInput}
                onFocus={() => setShowTitleSuggestions(true)}
                onChange={(e) => {
                  setTitleInput(e.target.value);
                  setShowTitleSuggestions(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setShowTitleSuggestions(false);
                }}
                placeholder="Ej. Or... (Orgullo y prejuicio)"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0d5451] focus:outline-none dark:border-zinc-700/80 dark:bg-zinc-950/80 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-emerald-500"
              />
              {showTitleSuggestions && titleSuggestions.length > 0 && (
                <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-[#141417]">
                  {titleSuggestions.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => handleSelectTitleSuggestion(item)}
                        className="flex w-full flex-col px-3 py-1.5 text-left hover:bg-[#0d5451]/5 dark:hover:bg-zinc-800"
                      >
                        <span className="truncate text-sm font-medium text-slate-900 dark:text-zinc-100">
                          {item.title}
                        </span>
                        <span className="truncate text-xs text-slate-500 dark:text-zinc-400">
                          {item.author} · {item.category}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-zinc-400">
                Filtrar por país
              </label>
              <select
                value={countryInput}
                onChange={(e) => handleCountrySelectChange(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-[#0d5451] focus:outline-none dark:border-zinc-700/80 dark:bg-zinc-950/80 dark:text-zinc-100 dark:focus:border-emerald-500"
              >
                <option value="">Todos los países</option>
                {availableCountries.map((code) => (
                  <option key={code} value={code}>
                    {formatCountryLabel(code)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-zinc-400">
                Costo USD (Mín / Máx)
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={minPriceInput}
                  onChange={(e) => setMinPriceInput(e.target.value)}
                  placeholder="Mín"
                  className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0d5451] focus:outline-none dark:border-zinc-700/80 dark:bg-zinc-950/80 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-emerald-500"
                />
                <span className="text-slate-400 dark:text-zinc-500">-</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={maxPriceInput}
                  onChange={(e) => setMaxPriceInput(e.target.value)}
                  placeholder="Máx"
                  className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0d5451] focus:outline-none dark:border-zinc-700/80 dark:bg-zinc-950/80 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                className="w-full rounded-xl bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-900 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
              >
                Aplicar filtros
              </button>
            </div>
          </form>
        </section>

        {/* Barra de resumen y orden */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 dark:text-zinc-400">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-slate-700 dark:text-zinc-300">
              Mostrando {books.length} de {totalCount} registros
            </span>
            {backendMode === 'category' && activeCategory && (
              <span className="rounded bg-blue-100 px-2 py-0.5 text-blue-900 dark:border dark:border-blue-800/50 dark:bg-blue-950/60 dark:text-blue-300">
                Categoría: &ldquo;{activeCategory}&rdquo;
              </span>
            )}
            {backendMode === 'low-stock' && (
              <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-900 dark:border dark:border-amber-800/50 dark:bg-amber-950/70 dark:text-amber-300">
                Low Stock: &le; {activeThreshold}
              </span>
            )}
            {complementary.title && (
              <span className="rounded bg-slate-200 px-2 py-0.5 dark:bg-zinc-800 dark:text-zinc-200">
                Título: &ldquo;{complementary.title}&rdquo;
              </span>
            )}
            {complementary.country && (
              <span className="rounded bg-slate-200 px-2 py-0.5 dark:bg-zinc-800 dark:text-zinc-200">
                País: {formatCountryLabel(complementary.country)}
              </span>
            )}
            {(complementary.minPrice !== null || complementary.maxPrice !== null) && (
              <span className="rounded bg-slate-200 px-2 py-0.5 dark:bg-zinc-800 dark:text-zinc-200">
                Costo: ${complementary.minPrice ?? 0} – $
                {complementary.maxPrice !== null ? complementary.maxPrice : '∞'}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label htmlFor="sort-select" className="text-slate-600 dark:text-zinc-400">
                Ordenar por:
              </label>
              <select
                id="sort-select"
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as SortOption);
                  setPage(1);
                }}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-[#0d5451] focus:outline-none dark:border-zinc-700/80 dark:bg-zinc-950/80 dark:text-zinc-100 dark:focus:border-emerald-500"
              >
                <option value="oldest">Más antiguos (ID / Fecha)</option>
                <option value="newest">Más recientes (ID / Fecha)</option>
                <option value="title_asc">Título (A → Z)</option>
                <option value="title_desc">Título (Z → A)</option>
                <option value="stock_desc">Stock (Mayor a menor)</option>
                <option value="stock_asc">Stock (Menor a mayor)</option>
                <option value="price_desc">Costo USD (Mayor a menor)</option>
                <option value="price_asc">Costo USD (Menor a mayor)</option>
              </select>
            </div>

            {/* Selector Tabla / Tarjetas */}
            <div
              role="group"
              aria-label="Modo de vista"
              className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <button
                type="button"
                onClick={() => { setViewMode('table'); setPage(1); }}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  viewMode === 'table'
                    ? 'bg-[#0d5451] text-white dark:bg-emerald-600 dark:text-white'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
                }`}
              >
                <LayoutList className="h-3.5 w-3.5" />
                Tabla
              </button>
              <button
                type="button"
                onClick={() => { setViewMode('grid'); setPage(1); }}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  viewMode === 'grid'
                    ? 'bg-[#0d5451] text-white dark:bg-emerald-600 dark:text-white'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Tarjetas
              </button>
            </div>
          </div>
        </div>

        {/* Vista principal */}
        {viewMode === 'grid' ? (
          <div className="space-y-4">
            <BookCardGrid
              books={books}
              isLoading={isLoading}
              lowStockThreshold={activeThreshold}
              onOpenDetail={handleOpenDetail}
              onOpenCalculator={handleOpenCalculator}
              onEdit={openEditModal}
              onDelete={setDeletingBook}
            />
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-zinc-800/90 dark:bg-[#121215] dark:ring-1 dark:ring-white/[0.04]">
              <span className="text-slate-600 dark:text-zinc-400">
                Página {page} de {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!hasPrevious || isLoading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-800/90 dark:text-zinc-200 dark:hover:bg-zinc-700/80"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={!hasNext || isLoading}
                  onClick={() => setPage((p) => p + 1)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-800/90 dark:text-zinc-200 dark:hover:bg-zinc-700/80"
                >
                  Siguiente
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ) : (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-zinc-800/90 dark:bg-[#121215] dark:shadow-none dark:ring-1 dark:ring-white/[0.04]">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-zinc-800/80">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-600 dark:bg-zinc-900/80 dark:text-zinc-400">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleToggleColumnSort('oldest', 'newest')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-zinc-100"
                      title="Ordenar por más reciente / más antiguo"
                    >
                      ID
                      {renderSortIcon('oldest', 'newest')}
                    </button>
                  </th>
                  <th className="min-w-[210px] whitespace-nowrap px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleToggleColumnSort('title_asc', 'title_desc')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-zinc-100"
                      title="Ordenar alfabéticamente por título"
                    >
                      Título / Autor
                      {renderSortIcon('title_asc', 'title_desc')}
                    </button>
                  </th>
                  <th className="whitespace-nowrap px-4 py-3">ISBN</th>
                  <th className="whitespace-nowrap px-4 py-3">Categoría</th>
                  <th className="whitespace-nowrap px-4 py-3">País</th>
                  <th className="whitespace-nowrap px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleToggleColumnSort('stock_asc', 'stock_desc')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-zinc-100"
                      title="Ordenar por cantidad de stock"
                    >
                      Stock
                      {renderSortIcon('stock_asc', 'stock_desc')}
                    </button>
                  </th>
                  <th className="whitespace-nowrap px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleToggleColumnSort('price_asc', 'price_desc')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-zinc-100"
                      title="Ordenar por costo en USD"
                    >
                      Costo USD
                      {renderSortIcon('price_asc', 'price_desc')}
                    </button>
                  </th>
                  <th className="whitespace-nowrap px-4 py-3">Precio Local</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white dark:divide-zinc-800/80 dark:bg-[#121215]">
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-500 dark:text-zinc-400">
                      <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-[#0d5451] dark:text-emerald-400" />
                      Cargando inventario...
                    </td>
                  </tr>
                ) : books.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-500 dark:text-zinc-400">
                      No hay libros que coincidan con los filtros actuales.
                    </td>
                  </tr>
                ) : (
                  books.map((book) => {
                    const isLowStock = book.stock_quantity <= activeThreshold;

                    return (
                      <tr key={book.id} className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/50">
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-500 dark:text-zinc-400">
                          #{book.id}
                        </td>
                        <td className="min-w-[210px] px-4 py-3">
                          <div className="font-medium text-slate-900 dark:text-zinc-100">
                            {book.title}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-zinc-400">
                            {book.author}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-700 dark:text-zinc-300">
                          {book.isbn}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-700 dark:text-zinc-300">
                          {book.category}
                        </td>
                        <td
                          className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-700 dark:text-zinc-300"
                          title={getCountryName(book.supplier_country)}
                        >
                          {book.supplier_country}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold ${
                              isLowStock
                                ? 'bg-amber-100 text-amber-800 dark:border dark:border-amber-800/50 dark:bg-amber-950/70 dark:text-amber-300'
                                : 'bg-emerald-50 text-emerald-800 dark:border dark:border-emerald-800/50 dark:bg-emerald-950/70 dark:text-emerald-300'
                            }`}
                          >
                            {book.stock_quantity}
                            {isLowStock && <span className="font-normal">· Bajo</span>}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-slate-800 dark:text-zinc-200">
                          ${Number(book.cost_usd).toFixed(2)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono">
                          {book.selling_price_local !== null ? (
                            <span className="font-semibold text-[#0d5451] dark:text-emerald-400">
                              {Number(book.selling_price_local).toFixed(2)}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenCalculator(book)}
                              className="inline-flex items-center gap-1 rounded-lg border border-[#0d5451]/25 bg-[#0d5451]/5 px-2.5 py-1 font-sans text-xs font-medium text-[#0d5451] transition hover:bg-[#0d5451]/15 dark:border-emerald-700/60 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-900/70"
                            >
                              <Calculator className="h-3.5 w-3.5" />
                              Calcular precio
                            </button>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenDetail(book.id)}
                              title="Ver detalle"
                              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenCalculator(book)}
                              title="Calcular Precio de Venta"
                              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-[#0d5451] dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-emerald-400"
                            >
                              <Calculator className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditModal(book)}
                              title="Editar"
                              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingBook(book)}
                              title="Eliminar"
                              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:text-zinc-500 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Paginación tabla */}
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-zinc-800/90 dark:bg-zinc-900/80">
            <span className="text-slate-600 dark:text-zinc-400">
              Página {page} de {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!hasPrevious || isLoading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-800/90 dark:text-zinc-200 dark:hover:bg-zinc-700/80"
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </button>
              <button
                type="button"
                disabled={!hasNext || isLoading}
                onClick={() => setPage((p) => p + 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-800/90 dark:text-zinc-200 dark:hover:bg-zinc-700/80"
              >
                Siguiente
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-8 border-t border-slate-200 bg-white transition-colors dark:border-zinc-800/90 dark:bg-[#121215]">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:text-zinc-400">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-[#0d5451]/10 p-1.5 text-[#0d5451] dark:border dark:border-emerald-800/60 dark:bg-emerald-950/80 dark:text-emerald-400">
              <BookOpen className="h-4 w-4" />
            </div>
            <div>
              <p className="font-serif text-sm font-bold text-slate-800 dark:text-zinc-200">
                Bookstore Inventory
              </p>
              <p className="text-[11px] text-slate-400 dark:text-zinc-500">
                Sistema de inventario editorial · Django REST + React
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11px] text-slate-500 dark:text-zinc-400">
            <span>
              Catálogo:{' '}
              <strong className="font-semibold text-slate-700 dark:text-zinc-200">
                {kpiStats.totalTitles} libros
              </strong>
            </span>
            <span>
              Países:{' '}
              <strong className="font-semibold text-slate-700 dark:text-zinc-200">
                {availableCountries.length}
              </strong>
            </span>
            <span>
              Margen estándar:{' '}
              <strong className="font-semibold text-[#0d5451] dark:text-emerald-400">+40%</strong>
            </span>
            <span>Tasas USD: ExchangeRate-API (con respaldo local)</span>
          </div>
        </div>
      </footer>

      {/* Modales */}
      {formModalOpen && (
        <BookFormModal
          book={editingBook}
          isSubmitting={isSubmitting}
          serverFieldErrors={serverFieldErrors}
          onClose={() => { setFormModalOpen(false); setEditingBook(null); }}
          onSubmit={handleFormSubmit}
        />
      )}

      {deletingBook && (
        <DeleteConfirmModal
          book={deletingBook}
          isDeleting={isDeleting}
          onClose={() => setDeletingBook(null)}
          onConfirm={handleConfirmDelete}
        />
      )}

      {detailOpen && (
        <BookDetailModal
          book={detailBook}
          isLoading={isLoadingDetail}
          isCalculating={isCalculating}
          calculationResult={calculationResult}
          onClose={() => setDetailOpen(false)}
          onCalculate={handleCalculatePrice}
        />
      )}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default App;

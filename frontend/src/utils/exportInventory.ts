import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type { Book } from '../types/book';
import { getCountryName } from './countries';

function getDateStamp(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function escapeCsvCell(value: string | number): string {
  const str = String(value);
  if (/[;"\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Exporta la lista de libros a un archivo Excel nativo (.xlsx) con columnas autoajustadas.
 */
export function exportBooksToExcel(books: Book[]): void {
  const rows = books.map((book) => ({
    ID: book.id,
    Título: book.title,
    Autor: book.author,
    ISBN: String(book.isbn),
    Categoría: book.category,
    País: `${book.supplier_country} (${getCountryName(book.supplier_country)})`,
    Stock: book.stock_quantity,
    'Costo USD': Number(Number(book.cost_usd).toFixed(2)),
    'Precio Local':
      book.selling_price_local !== null
        ? Number(Number(book.selling_price_local).toFixed(2))
        : 'Sin calcular',
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet['!cols'] = [
    { wch: 6 },
    { wch: 36 },
    { wch: 26 },
    { wch: 18 },
    { wch: 20 },
    { wch: 20 },
    { wch: 8 },
    { wch: 12 },
    { wch: 14 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventario');
  XLSX.writeFile(workbook, `bookstore-inventario-${getDateStamp()}.xlsx`);
}

/**
 * Exporta la lista de libros a un archivo CSV (delimitado por ';' para Excel en español, UTF-8 BOM).
 */
export function exportBooksToCsv(books: Book[]): void {
  const headers = [
    'ID',
    'Título',
    'Autor',
    'ISBN',
    'Categoría',
    'País',
    'Stock',
    'Costo USD',
    'Precio Local',
  ];

  const rows = books.map((book) => [
    book.id,
    book.title,
    book.author,
    book.isbn,
    book.category,
    `${book.supplier_country} (${getCountryName(book.supplier_country)})`,
    book.stock_quantity,
    Number(book.cost_usd).toFixed(2),
    book.selling_price_local !== null
      ? Number(book.selling_price_local).toFixed(2)
      : 'Sin calcular',
  ]);

  const csvContent =
    '\uFEFF' +
    [headers, ...rows]
      .map((row) => row.map(escapeCsvCell).join(';'))
      .join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `bookstore-inventario-${getDateStamp()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

interface PdfExportOptions {
  lowStockThreshold: number;
  filterSummary?: string;
}

/**
 * Genera y descarga un reporte PDF con la identidad visual de Bookstore Inventory.
 */
export function exportBooksToPdf(
  books: Book[],
  { lowStockThreshold, filterSummary }: PdfExportOptions
): void {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 14;

  // ── Header principal (#0d5451) ──────────────────────────────────────────────
  doc.setFillColor(13, 84, 81);
  doc.rect(0, 0, pageWidth, 26, 'F');

  // Badge del logo (libro abierto vectorial)
  doc.setFillColor(19, 104, 100);
  doc.roundedRect(marginX, 5.5, 13, 13, 2.5, 2.5, 'F');
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.6);
  // Mitad izquierda del libro
  doc.line(marginX + 3.2, 8.5, marginX + 6.5, 9.2);
  doc.line(marginX + 3.2, 8.5, marginX + 3.2, 15.2);
  doc.line(marginX + 3.2, 15.2, marginX + 6.5, 15.8);
  // Mitad derecha del libro
  doc.line(marginX + 9.8, 8.5, marginX + 6.5, 9.2);
  doc.line(marginX + 9.8, 8.5, marginX + 9.8, 15.2);
  doc.line(marginX + 9.8, 15.2, marginX + 6.5, 15.8);
  // Lomo central
  doc.line(marginX + 6.5, 9.2, marginX + 6.5, 15.8);

  // Título y subtítulo
  doc.setTextColor(255, 255, 255);
  doc.setFont('times', 'bold');
  doc.setFontSize(18);
  doc.text('Bookstore Inventory', marginX + 17, 12.2);

  doc.setTextColor(204, 251, 241);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(
    'Reporte de inventario editorial y precios sugeridos',
    marginX + 17,
    17.5
  );

  // Fecha y conteo a la derecha
  const generatedAt = new Date().toLocaleString('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`${books.length} libros exportados`, pageWidth - marginX, 11.5, {
    align: 'right',
  });
  doc.setTextColor(204, 251, 241);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Generado: ${generatedAt}`, pageWidth - marginX, 17, {
    align: 'right',
  });

  // ── Franja de métricas resumen ──────────────────────────────────────────────
  const totalUnits = books.reduce((sum, b) => sum + b.stock_quantity, 0);
  const lowStockCount = books.filter(
    (b) => b.stock_quantity <= lowStockThreshold
  ).length;
  const unpricedCount = books.filter(
    (b) => b.selling_price_local === null
  ).length;

  let currentY = 32;
  doc.setFillColor(247, 245, 240);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(marginX, currentY, pageWidth - marginX * 2, 11, 2, 2, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  const summaryText = `Total libros: ${books.length}    |    Unidades en stock: ${totalUnits}    |    Stock <= ${lowStockThreshold}: ${lowStockCount}    |    Sin precio local: ${unpricedCount}`;
  doc.text(summaryText, marginX + 4, currentY + 6.8);

  currentY += 15;

  if (filterSummary) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Filtros aplicados: ${filterSummary}`, marginX, currentY);
    currentY += 5;
  }

  // ── Tabla principal ─────────────────────────────────────────────────────────
  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX, bottom: 16 },
    head: [
      [
        'ID',
        'Título',
        'Autor',
        'ISBN',
        'Categoría',
        'País',
        'Stock',
        'Costo USD',
        'Precio Local',
      ],
    ],
    body: books.map((book) => [
      `#${book.id}`,
      book.title,
      book.author,
      book.isbn,
      book.category,
      book.supplier_country,
      `${book.stock_quantity} uds`,
      `$${Number(book.cost_usd).toFixed(2)}`,
      book.selling_price_local !== null
        ? Number(book.selling_price_local).toFixed(2)
        : 'Sin calcular',
    ]),
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      cellPadding: 2.8,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [13, 84, 81],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 249],
    },
    columnStyles: {
      0: { cellWidth: 14, halign: 'center' },
      5: { cellWidth: 14, halign: 'center' },
      6: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
      7: { cellWidth: 24, halign: 'right' },
      8: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      if (data.section === 'body') {
        const book = books[data.row.index];
        if (!book) return;

        if (data.column.index === 6) {
          if (book.stock_quantity <= lowStockThreshold) {
            data.cell.styles.textColor = [180, 83, 9];
          } else {
            data.cell.styles.textColor = [13, 84, 81];
          }
        }

        if (data.column.index === 8) {
          if (book.selling_price_local !== null) {
            data.cell.styles.textColor = [13, 84, 81];
          } else {
            data.cell.styles.textColor = [148, 163, 184];
            data.cell.styles.fontStyle = 'normal';
          }
        }
      }
    },
    didDrawPage: () => {
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(marginX, pageHeight - 11, pageWidth - marginX, pageHeight - 11);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(
        'Bookstore Inventory · Sistema de inventario editorial',
        marginX,
        pageHeight - 6.5
      );
    },
  });

  // Numeración de páginas ("Página X de Y")
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i += 1) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Página ${i} de ${totalPages}`,
      pageWidth - marginX,
      pageHeight - 6.5,
      { align: 'right' }
    );
  }

  doc.save(`bookstore-inventario-${getDateStamp()}.pdf`);
}

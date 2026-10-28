import type { Dataset, FilterState, WidgetInstance } from './types';
import {
  aggregateNumeric,
  filterDatasetRows,
  groupMultiSum,
  groupSum,
  pivotSum,
  topN,
} from './filter';

function cellText(v: string | number | boolean | null | undefined): string {
  if (v == null) return '';
  const s = String(v);
  // Excel-friendly: quote if tab/newline/quote present
  if (/[\t\n\r"]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToTsv(
  headers: string[],
  rows: Array<Array<string | number | boolean | null | undefined>>,
): string {
  const lines = [headers.map(cellText).join('\t')];
  for (const row of rows) {
    lines.push(row.map(cellText).join('\t'));
  }
  return lines.join('\n');
}

/**
 * Build clipboard text for a widget: TSV of visible / filtered data (Excel-ready).
 */
export function buildWidgetDataTsv(
  widget: WidgetInstance,
  tabWidgets: WidgetInstance[],
  datasets: Dataset[],
  filters: FilterState,
): string {
  const dataset = datasets.find((d) => d.id === widget.binding.datasetId);
  const rows = filterDatasetRows(dataset, tabWidgets, filters, datasets);
  const type = widget.type;
  const b = widget.binding;

  if (type === 'table') {
    const cols =
      b.columns?.length && b.columns.some(Boolean) ? b.columns : dataset?.columns || [];
    return rowsToTsv(
      cols,
      rows.map((r) => cols.map((c) => r[c])),
    );
  }

  if (type === 'matrix') {
    const rowCol = b.rowColumn || '';
    const colCol = b.colColumn || '';
    const valCol = b.valueColumn || '';
    const pivot = pivotSum(rows, rowCol, colCol, valCol);
    const headers = ['', ...pivot.cols, ...(b.showTotals ? ['Итого'] : [])];
    const body = pivot.rows.map((r) => {
      const vals = pivot.cols.map((c) => pivot.cells[r]?.[c] ?? 0);
      const rowTotal = vals.reduce((a, n) => a + n, 0);
      return [r, ...vals, ...(b.showTotals ? [rowTotal] : [])];
    });
    if (b.showTotals && pivot.rows.length) {
      const colTotals = pivot.cols.map((c) =>
        pivot.rows.reduce((s, r) => s + (pivot.cells[r]?.[c] ?? 0), 0),
      );
      const grand = colTotals.reduce((a, n) => a + n, 0);
      body.push(['Итого', ...colTotals, grand]);
    }
    return rowsToTsv(headers, body);
  }

  if (type === 'kpi' || type === 'kpi-delta') {
    const valueCol = b.valueColumn || '';
    const compareCol = b.compareColumn || '';
    const actual = aggregateNumeric(rows, valueCol);
    if (type === 'kpi' || !compareCol) {
      return rowsToTsv(
        ['Показатель', 'Значение'],
        [[b.label || widget.title, actual]],
      );
    }
    const base = aggregateNumeric(rows, compareCol);
    const delta = actual - base;
    return rowsToTsv(
      ['Показатель', 'Значение', 'База', 'Δ'],
      [[b.label || widget.title, actual, base, delta]],
    );
  }

  if (type === 'top-list' || type === 'hbar') {
    const cat = b.categoryColumn || '';
    const val = b.valueColumn || '';
    const series = topN(
      groupSum(rows, cat, val),
      b.maxItems || (type === 'top-list' ? 5 : 12),
      type === 'hbar',
    );
    return rowsToTsv(
      [cat || 'Категория', val || 'Значение'],
      series.map((s) => [s.name, s.value]),
    );
  }

  if (type === 'stacked-bar') {
    const cat = b.categoryColumn || '';
    const seriesCols =
      b.seriesColumns?.filter(Boolean).length
        ? b.seriesColumns.filter(Boolean)
        : b.valueColumn
          ? [b.valueColumn]
          : [];
    const grouped = groupMultiSum(rows, cat, seriesCols);
    return rowsToTsv(
      [cat || 'Категория', ...seriesCols],
      grouped.map((g) => [g.name, ...seriesCols.map((c) => g.values[c] ?? 0)]),
    );
  }

  if (type === 'combo') {
    const cat = b.categoryColumn || '';
    const val = b.valueColumn || '';
    const line = b.lineColumn || b.compareColumn || '';
    const cols = [val, line].filter(Boolean);
    const grouped = groupMultiSum(rows, cat, cols);
    return rowsToTsv(
      [cat || 'Категория', val || 'Факт', ...(line ? [line] : [])],
      grouped.map((g) => [
        g.name,
        g.values[val] ?? 0,
        ...(line ? [g.values[line] ?? 0] : []),
      ]),
    );
  }

  // bar / line / area / pie / donut / waterfall — category + value series
  if (
    type === 'bar' ||
    type === 'line' ||
    type === 'area' ||
    type === 'pie' ||
    type === 'donut' ||
    type === 'waterfall'
  ) {
    const cat = b.categoryColumn || '';
    const val = b.valueColumn || '';
    const series = groupSum(rows, cat, val);
    return rowsToTsv(
      [cat || 'Категория', val || 'Значение'],
      series.map((s) => [s.name, s.value]),
    );
  }

  // Filters / fallback: dump filtered rows of bound dataset
  const cols = dataset?.columns || [];
  if (!cols.length) return '';
  return rowsToTsv(
    cols,
    rows.map((r) => cols.map((c) => r[c])),
  );
}

import type { Dataset, DatasetRow, FilterState, WidgetInstance } from './types';
import { isFilterWidget } from './blocks';

function rowMatchesFilters(
  row: DatasetRow,
  widgets: WidgetInstance[],
  filters: FilterState,
  datasets: Record<string, Dataset>,
): boolean {
  for (const w of widgets) {
    if (!isFilterWidget(w.type)) continue;
    const col = w.binding.filterColumn;
    if (!col) continue;
    const value = filters[w.id];
    if (value === undefined || value === '' || value === null) continue;

    const cell = row[col];
    const cellStr = cell == null ? '' : String(cell);

    if (w.type === 'filter-select') {
      if (Array.isArray(value)) {
        if (value.length === 0) continue;
        if (!value.map(String).includes(cellStr)) return false;
      } else if (String(value) !== cellStr) {
        return false;
      }
    }

    if (w.type === 'filter-date') {
      const range = value as { from?: string; to?: string };
      const t = Date.parse(cellStr);
      if (Number.isNaN(t)) continue;
      if (range.from) {
        const from = Date.parse(range.from);
        if (!Number.isNaN(from) && t < from) return false;
      }
      if (range.to) {
        const to = Date.parse(range.to);
        if (!Number.isNaN(to) && t > to + 24 * 60 * 60 * 1000 - 1) return false;
      }
    }
  }
  void datasets;
  return true;
}

/** Apply tab filter widgets to a dataset snapshot (client-side). */
export function filterDatasetRows(
  dataset: Dataset | undefined,
  tabWidgets: WidgetInstance[],
  filters: FilterState,
  allDatasets: Dataset[],
): DatasetRow[] {
  if (!dataset) return [];
  const map = Object.fromEntries(allDatasets.map((d) => [d.id, d]));
  return dataset.rows.filter((row) => rowMatchesFilters(row, tabWidgets, filters, map));
}

export function uniqueColumnValues(rows: DatasetRow[], column: string): string[] {
  const set = new Set<string>();
  for (const row of rows) {
    const v = row[column];
    if (v != null && String(v) !== '') set.add(String(v));
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'ru'));
}

export function aggregateNumeric(rows: DatasetRow[], column: string): number {
  let sum = 0;
  let count = 0;
  for (const row of rows) {
    const n = Number(row[column]);
    if (!Number.isNaN(n)) {
      sum += n;
      count += 1;
    }
  }
  return count === 0 ? 0 : sum;
}

export function groupSum(
  rows: DatasetRow[],
  categoryColumn: string,
  valueColumn: string,
): { name: string; value: number }[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = String(row[categoryColumn] ?? '');
    const n = Number(row[valueColumn]);
    const add = Number.isNaN(n) ? 0 : n;
    map.set(key, (map.get(key) ?? 0) + add);
  }
  return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
}

export function groupMultiSum(
  rows: DatasetRow[],
  categoryColumn: string,
  valueColumns: string[],
): { name: string; values: Record<string, number> }[] {
  const map = new Map<string, Record<string, number>>();
  for (const row of rows) {
    const key = String(row[categoryColumn] ?? '');
    const bucket = map.get(key) ?? Object.fromEntries(valueColumns.map((c) => [c, 0]));
    for (const c of valueColumns) {
      const n = Number(row[c]);
      bucket[c] = (bucket[c] ?? 0) + (Number.isNaN(n) ? 0 : n);
    }
    map.set(key, bucket);
  }
  return Array.from(map.entries()).map(([name, values]) => ({ name, values }));
}

export function topN(
  series: { name: string; value: number }[],
  n = 10,
  byAbs = false,
): { name: string; value: number }[] {
  const sorted = [...series].sort((a, b) =>
    byAbs ? Math.abs(b.value) - Math.abs(a.value) : b.value - a.value,
  );
  return sorted.slice(0, Math.max(1, n));
}

export function pivotSum(
  rows: DatasetRow[],
  rowColumn: string,
  colColumn: string,
  valueColumn: string,
): { rows: string[]; cols: string[]; cells: Record<string, Record<string, number>> } {
  const rowSet = new Set<string>();
  const colSet = new Set<string>();
  const cells: Record<string, Record<string, number>> = {};
  for (const row of rows) {
    const r = String(row[rowColumn] ?? '');
    const c = String(row[colColumn] ?? '');
    const n = Number(row[valueColumn]);
    const add = Number.isNaN(n) ? 0 : n;
    rowSet.add(r);
    colSet.add(c);
    if (!cells[r]) cells[r] = {};
    cells[r][c] = (cells[r][c] ?? 0) + add;
  }
  return {
    rows: Array.from(rowSet).sort((a, b) => a.localeCompare(b, 'ru')),
    cols: Array.from(colSet).sort((a, b) => a.localeCompare(b, 'ru')),
    cells,
  };
}

export function formatValue(
  value: number,
  format?: string,
): string {
  if (format === 'pct') {
    return `${(value * (Math.abs(value) <= 1 ? 100 : 1)).toLocaleString('ru-RU', {
      maximumFractionDigits: 1,
    })}%`;
  }
  if (format === 'money') {
    return value.toLocaleString('ru-RU', { maximumFractionDigits: 0 });
  }
  return value.toLocaleString('ru-RU');
}

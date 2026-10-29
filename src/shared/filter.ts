import type {
  DashboardConfig,
  Dataset,
  DatasetRow,
  FilterState,
  PanelFilterConfig,
  WidgetInstance,
} from './types';
import { isFilterWidget } from './blocks';

function applyColumnFilter(
  row: DatasetRow,
  column: string,
  kind: 'select' | 'chips' | 'date',
  value: FilterState[string],
): boolean {
  if (value === undefined || value === '' || value === null) return true;
  const cell = row[column];
  const cellStr = cell == null ? '' : String(cell);

  if (kind === 'select' || kind === 'chips') {
    if (Array.isArray(value)) {
      if (value.length === 0) return true;
      return value.map(String).includes(cellStr);
    }
    return String(value) === cellStr;
  }

  if (kind === 'date') {
    const range = value as { from?: string; to?: string; week?: string };
    const t = Date.parse(cellStr);
    if (Number.isNaN(t)) return true;
    if (range.from) {
      const from = Date.parse(range.from);
      if (!Number.isNaN(from) && t < from) return false;
    }
    if (range.to) {
      const to = Date.parse(range.to);
      if (!Number.isNaN(to) && t > to + 24 * 60 * 60 * 1000 - 1) return false;
    }
  }
  return true;
}

function rowMatchesFilters(
  row: DatasetRow,
  widgets: WidgetInstance[],
  filters: FilterState,
): boolean {
  for (const w of widgets) {
    if (!isFilterWidget(w.type)) continue;
    const col = w.binding.filterColumn;
    if (!col) continue;
    const kind =
      w.type === 'filter-date' ? 'date' : w.type === 'filter-chips' ? 'chips' : 'select';
    if (!applyColumnFilter(row, col, kind, filters[w.id])) return false;
  }
  return true;
}

function rowMatchesPanelFilters(
  row: DatasetRow,
  panelFilters: PanelFilterConfig[],
  filters: FilterState,
): boolean {
  for (const f of panelFilters) {
    if (!f.column) continue;
    const kind = f.kind === 'date' ? 'date' : 'select';
    if (!applyColumnFilter(row, f.column, kind, filters[f.id])) return false;
  }
  return true;
}

/**
 * Resolve which filters apply: when the soft-rail panel is on, panelFilters
 * are the source of truth (canvas filter widgets are ignored).
 */
export function resolveActiveFilters(
  dashboard: Pick<DashboardConfig, 'showFiltersPanel' | 'panelFilters'>,
  tabWidgets: WidgetInstance[],
): { mode: 'panel' | 'canvas'; panelFilters: PanelFilterConfig[]; canvasWidgets: WidgetInstance[] } {
  if (dashboard.showFiltersPanel) {
    return {
      mode: 'panel',
      panelFilters: dashboard.panelFilters || [],
      canvasWidgets: [],
    };
  }
  return {
    mode: 'canvas',
    panelFilters: [],
    canvasWidgets: tabWidgets.filter((w) => isFilterWidget(w.type)),
  };
}

/** Apply active filters to a dataset snapshot (client-side). */
export function filterDatasetRows(
  dataset: Dataset | undefined,
  tabWidgets: WidgetInstance[],
  filters: FilterState,
  allDatasets: Dataset[],
  dashboard?: Pick<DashboardConfig, 'showFiltersPanel' | 'panelFilters'>,
): DatasetRow[] {
  if (!dataset) return [];
  void allDatasets;
  const active = dashboard
    ? resolveActiveFilters(dashboard, tabWidgets)
    : {
        mode: 'canvas' as const,
        panelFilters: [] as PanelFilterConfig[],
        canvasWidgets: tabWidgets.filter((w) => isFilterWidget(w.type)),
      };

  return dataset.rows.filter((row) => {
    if (active.mode === 'panel') {
      return rowMatchesPanelFilters(row, active.panelFilters, filters);
    }
    return rowMatchesFilters(row, active.canvasWidgets, filters);
  });
}

export function uniqueColumnValues(rows: DatasetRow[], column: string): string[] {
  const set = new Set<string>();
  for (const row of rows) {
    const v = row[column];
    if (v != null && String(v) !== '') set.add(String(v));
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'ru'));
}

/** Heuristic: column looks like dates. */
export function isDateLikeColumn(dataset: Dataset, column: string): boolean {
  if (/date|time|день|дата|period|недел|month|месяц/i.test(column)) return true;
  let parsed = 0;
  let checked = 0;
  for (const row of dataset.rows.slice(0, 40)) {
    const v = row[column];
    if (v == null || v === '') continue;
    checked += 1;
    const t = Date.parse(String(v));
    if (!Number.isNaN(t)) parsed += 1;
  }
  return checked > 0 && parsed / checked >= 0.6;
}

export function listDateColumns(dataset: Dataset): string[] {
  return dataset.columns.filter((c) => isDateLikeColumn(dataset, c));
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Monday of the ISO week containing `d`. */
export function startOfIsoWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (x.getDay() + 6) % 7; // Mon=0
  x.setDate(x.getDate() - day);
  return x;
}

export function isoWeekKey(d: Date): string {
  const monday = startOfIsoWeek(d);
  // ISO week year = year of the Thursday of this week
  const thursday = new Date(monday);
  thursday.setDate(monday.getDate() + 3);
  const year = thursday.getFullYear();
  const yearStart = startOfIsoWeek(new Date(year, 0, 4));
  const week = 1 + Math.round((monday.getTime() - yearStart.getTime()) / (7 * 86400000));
  return `${year}-W${pad2(week)}`;
}

export function weekBounds(weekKey: string): { from: string; to: string } | null {
  const m = /^(\d{4})-W(\d{2})$/.exec(weekKey);
  if (!m) return null;
  const year = Number(m[1]);
  const week = Number(m[2]);
  const jan4 = new Date(year, 0, 4);
  const monday = startOfIsoWeek(jan4);
  monday.setDate(monday.getDate() + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { from: toIsoDate(monday), to: toIsoDate(sunday) };
}

export function formatWeekLabel(weekKey: string): string {
  const b = weekBounds(weekKey);
  if (!b) return weekKey;
  const m = /^(\d{4})-W(\d{2})$/.exec(weekKey);
  return m ? `${m[1]}.${m[2]}` : weekKey;
}

/** Unique ISO weeks present in a date column, ascending. */
export function uniqueWeeks(rows: DatasetRow[], column: string): string[] {
  const set = new Set<string>();
  for (const row of rows) {
    const v = row[column];
    if (v == null || v === '') continue;
    const t = Date.parse(String(v));
    if (Number.isNaN(t)) continue;
    set.add(isoWeekKey(new Date(t)));
  }
  return Array.from(set).sort();
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

export function formatValue(value: number, format?: string): string {
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

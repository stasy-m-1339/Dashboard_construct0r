import type {
  CalculatedField,
  Dataset,
  DatasetRow,
  FieldRole,
  FieldRoleMap,
} from './types';
import { isDateLikeColumn, isoWeekKey, startOfIsoWeek } from './filter';

function isMostlyNumeric(dataset: Dataset, column: string): boolean {
  let nums = 0;
  let checked = 0;
  for (const row of dataset.rows.slice(0, 50)) {
    const v = row[column];
    if (v == null || v === '') continue;
    checked += 1;
    if (
      typeof v === 'number' ||
      (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)))
    ) {
      nums += 1;
    }
  }
  return checked > 0 && nums / checked >= 0.7;
}

function uniqueCount(dataset: Dataset, column: string): number {
  const set = new Set<string>();
  for (const row of dataset.rows) {
    const v = row[column];
    if (v != null && String(v) !== '') set.add(String(v));
  }
  return set.size;
}

/** Suggest field roles after schema/rows load. User can override in ETL. */
export function suggestFieldRoles(dataset: Dataset): FieldRoleMap {
  const roles: FieldRoleMap = {};
  const n = Math.max(1, dataset.rows.length);
  for (const col of dataset.columns) {
    if (isDateLikeColumn(dataset, col)) {
      roles[col] = 'date';
      continue;
    }
    if (isMostlyNumeric(dataset, col)) {
      roles[col] = 'measure';
      continue;
    }
    const uniq = uniqueCount(dataset, col);
    if (uniq > 1 && uniq <= Math.min(40, Math.ceil(n * 0.5))) {
      roles[col] = 'filter';
    } else {
      roles[col] = 'dimension';
    }
  }
  return roles;
}

export function mergeFieldRoles(
  columns: string[],
  previous: FieldRoleMap | undefined,
  suggested: FieldRoleMap,
): FieldRoleMap {
  const next: FieldRoleMap = {};
  for (const c of columns) {
    next[c] = previous?.[c] || suggested[c] || 'dimension';
  }
  return next;
}

function cellNum(row: DatasetRow, col?: string): number | null {
  if (!col) return null;
  const raw = row[col];
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number') return Number.isNaN(raw) ? null : raw;
  const n = Number(String(raw).replace(/\s/g, '').replace(',', '.'));
  return Number.isNaN(n) ? null : n;
}

function parseRowDate(row: DatasetRow, col?: string): Date | null {
  if (!col) return null;
  const t = Date.parse(String(row[col] ?? ''));
  if (Number.isNaN(t)) return null;
  return new Date(t);
}

/** ISO week number 1–53 for a Date. */
export function isoWeekNumber(d: Date): number {
  const key = isoWeekKey(d);
  const m = /-W(\d{2})$/.exec(key);
  return m ? Number(m[1]) : 1;
}

/** ISO week-year (year of the Thursday of that week). */
export function isoWeekYear(d: Date): number {
  const monday = startOfIsoWeek(d);
  const thursday = new Date(monday);
  thursday.setDate(monday.getDate() + 3);
  return thursday.getFullYear();
}

/** Standalone-style label `YYYY.WW`. */
export function isoWeekLabel(d: Date): string {
  const y = isoWeekYear(d);
  const w = isoWeekNumber(d);
  return `${y}.${String(w).padStart(2, '0')}`;
}

function sumColumn(rows: DatasetRow[], col?: string): number {
  if (!col) return 0;
  let s = 0;
  for (const row of rows) {
    const n = cellNum(row, col);
    if (n != null) s += n;
  }
  return s;
}

function evalCalc(
  row: DatasetRow,
  calc: CalculatedField,
  ctx: { sumBase: Record<string, number> },
): string | number | null {
  switch (calc.kind) {
    case 'const':
      return calc.value ?? 0;
    case 'sum':
      return cellNum(row, calc.a);
    case 'ratio': {
      const a = cellNum(row, calc.a);
      const b = cellNum(row, calc.b);
      if (a == null || b == null || b === 0) return null;
      return a / b;
    }
    case 'pct': {
      const a = cellNum(row, calc.a);
      const b = cellNum(row, calc.b);
      if (a == null || b == null || b === 0) return null;
      return (a / b) * 100;
    }
    case 'delta': {
      const a = cellNum(row, calc.a);
      const b = cellNum(row, calc.b);
      if (a == null || b == null) return null;
      return a - b;
    }
    case 'growth': {
      // Прирост: (X_report − X_base) / X_base × 100
      const report = cellNum(row, calc.a);
      const base = cellNum(row, calc.b);
      if (report == null || base == null || base === 0) return null;
      return ((report - base) / base) * 100;
    }
    case 'growth_contrib': {
      // Вклад в прирост: (X_report − X_base) / Sum(X_base) × 100
      // (как в standalone: Δ / итог базы)
      const report = cellNum(row, calc.a);
      const base = cellNum(row, calc.b);
      const totalBase = calc.b ? ctx.sumBase[calc.b] : 0;
      if (report == null || base == null || !totalBase) return null;
      return ((report - base) / totalBase) * 100;
    }
    case 'year': {
      const d = parseRowDate(row, calc.a);
      return d ? d.getFullYear() : null;
    }
    case 'month': {
      const d = parseRowDate(row, calc.a);
      return d ? d.getMonth() + 1 : null;
    }
    case 'iso_week': {
      const d = parseRowDate(row, calc.a);
      if (!d) return null;
      if (calc.withYear) return isoWeekLabel(d);
      return isoWeekNumber(d);
    }
    default:
      return null;
  }
}

function defaultRoleForCalc(calc: CalculatedField): FieldRole {
  if (calc.kind === 'year' || calc.kind === 'month') return 'dimension';
  if (calc.kind === 'iso_week') return calc.withYear ? 'filter' : 'dimension';
  return 'measure';
}

/** Materialise calculated fields into columns + rows. */
export function applyCalculatedFields(
  dataset: Dataset,
  calcs: CalculatedField[] | undefined,
): Dataset {
  const list = calcs || [];
  if (!list.length) {
    return { ...dataset, calculatedFields: list };
  }
  const baseCols = dataset.columns.filter((c) => !list.some((f) => f.name === c));
  const columns = [...baseCols, ...list.map((c) => c.name)];

  // Precompute Sum(base) for contribution fields (dataset-level).
  const sumBase: Record<string, number> = {};
  for (const calc of list) {
    if (calc.kind === 'growth_contrib' && calc.b && sumBase[calc.b] === undefined) {
      sumBase[calc.b] = sumColumn(dataset.rows, calc.b);
    }
  }

  const rows = dataset.rows.map((row) => {
    const next: DatasetRow = { ...row };
    for (const calc of list) {
      next[calc.name] = evalCalc(row, calc, { sumBase });
    }
    return next;
  });
  const roles = { ...(dataset.fieldRoles || {}) };
  for (const calc of list) {
    if (!roles[calc.name]) roles[calc.name] = defaultRoleForCalc(calc);
  }
  return {
    ...dataset,
    columns,
    rows,
    calculatedFields: list,
    fieldRoles: roles,
  };
}

/** Enrich freshly refreshed datasets: keep prior roles/calcs, suggest missing roles, apply calcs. */
export function enrichDatasets(fresh: Dataset[], previous: Dataset[]): Dataset[] {
  const prevById = new Map(previous.map((d) => [d.id, d]));
  const prevByName = new Map(previous.map((d) => [d.name, d]));
  return fresh.map((ds) => {
    const prev = prevById.get(ds.id) || prevByName.get(ds.name);
    const suggested = suggestFieldRoles(ds);
    const fieldRoles = mergeFieldRoles(ds.columns, prev?.fieldRoles, suggested);
    const calcs = prev?.calculatedFields || [];
    return applyCalculatedFields({ ...ds, fieldRoles }, calcs);
  });
}

export function columnsByRole(
  dataset: Dataset | undefined,
  roles: FieldRole | FieldRole[],
): string[] {
  if (!dataset) return [];
  const want = new Set(Array.isArray(roles) ? roles : [roles]);
  const map = dataset.fieldRoles || {};
  const matched = dataset.columns.filter((c) => want.has(map[c] || 'dimension'));
  return matched.length ? matched : dataset.columns;
}

export const ROLE_LABELS: Record<FieldRole, string> = {
  dimension: 'Измерение',
  measure: 'Мера',
  filter: 'Фильтр',
  date: 'Дата',
  ignore: 'Скрыть',
};

export const CALC_KIND_LABELS: Record<CalculatedField['kind'], string> = {
  sum: 'Копия / число',
  ratio: 'Отношение (a÷b)',
  pct: 'Процент (a÷b×100)',
  delta: 'Разница (a−b)',
  growth: 'Прирост ((отчёт−база)/база×100)',
  growth_contrib: 'Вклад в прирост (Δ / Σбаза×100)',
  year: 'Год из даты',
  month: 'Месяц из даты',
  iso_week: 'ISO-неделя из даты',
  const: 'Константа',
};

/** Ordered kinds for the ETL dropdown (common BI first). */
export const CALC_KIND_ORDER: CalculatedField['kind'][] = [
  'growth',
  'growth_contrib',
  'delta',
  'ratio',
  'pct',
  'iso_week',
  'year',
  'month',
  'sum',
  'const',
];

import type {
  CalculatedField,
  Dataset,
  DatasetRow,
  FieldRole,
  FieldRoleMap,
} from './types';
import { isDateLikeColumn } from './filter';

function isMostlyNumeric(dataset: Dataset, column: string): boolean {
  let nums = 0;
  let checked = 0;
  for (const row of dataset.rows.slice(0, 50)) {
    const v = row[column];
    if (v == null || v === '') continue;
    checked += 1;
    if (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)))) {
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
    // Low-cardinality categoricals → good filters; else dimensions
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
  const n = Number(row[col]);
  return Number.isNaN(n) ? null : n;
}

function evalCalc(row: DatasetRow, calc: CalculatedField): string | number | null {
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
    case 'year': {
      if (!calc.a) return null;
      const t = Date.parse(String(row[calc.a] ?? ''));
      if (Number.isNaN(t)) return null;
      return new Date(t).getFullYear();
    }
    case 'month': {
      if (!calc.a) return null;
      const t = Date.parse(String(row[calc.a] ?? ''));
      if (Number.isNaN(t)) return null;
      return new Date(t).getMonth() + 1;
    }
    default:
      return null;
  }
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
  const rows = dataset.rows.map((row) => {
    const next: DatasetRow = { ...row };
    for (const calc of list) {
      next[calc.name] = evalCalc(row, calc);
    }
    return next;
  });
  const roles = { ...(dataset.fieldRoles || {}) };
  for (const calc of list) {
    if (!roles[calc.name]) {
      roles[calc.name] =
        calc.kind === 'year' || calc.kind === 'month' ? 'dimension' : 'measure';
    }
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
export function enrichDatasets(
  fresh: Dataset[],
  previous: Dataset[],
): Dataset[] {
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
  year: 'Год из даты',
  month: 'Месяц из даты',
  const: 'Константа',
};

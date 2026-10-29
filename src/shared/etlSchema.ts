import type {
  Dataset,
  DatasetRow,
  FieldDataType,
  FieldFormatKind,
  FieldRole,
  FieldSchemaConfig,
  FieldSchemaMap,
  FilterWidgetKind,
  PanelFilterConfig,
} from './types';
import { isDateLikeColumn } from './filter';
import { suggestFieldRoles } from './fieldMeta';

export const FILTER_WIDGET_OPTIONS: { id: FilterWidgetKind; label: string }[] = [
  { id: 'dropdown', label: 'Выпадающий список' },
  { id: 'multi', label: 'Мультиселект' },
  { id: 'stepper', label: 'Степпер' },
  { id: 'double_stepper', label: 'Двойной степпер' },
  { id: 'toggle', label: 'Переключатель' },
  { id: 'slider_double', label: 'Двойной слайдер' },
  { id: 'none', label: 'Нет' },
];

export const FIELD_FORMAT_OPTIONS: { id: FieldFormatKind; label: string }[] = [
  { id: 'auto', label: 'Авто' },
  { id: 'text', label: 'Текст' },
  { id: 'integer', label: 'Целое' },
  { id: 'number', label: 'Число' },
  { id: 'money', label: 'Деньги' },
  { id: 'pct', label: '%' },
  { id: 'date', label: 'Дата' },
];

export const DATA_TYPE_OPTIONS: FieldDataType[] = [
  'String',
  'Integer',
  'Float',
  'Boolean',
  'Date',
  'DateTime',
];

function sampleValues(rows: DatasetRow[], column: string, limit = 6): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of rows) {
    const raw = row[column];
    if (raw == null || raw === '') continue;
    const s = String(raw);
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= limit) break;
  }
  return out;
}

export function columnSamples(dataset: Dataset, column: string, limit = 6): string[] {
  return sampleValues(dataset.rows, column, limit);
}

export function uniqueColumnValues(dataset: Dataset, column: string, limit = 200): string[] {
  return sampleValues(dataset.rows, column, limit);
}

export function detectFieldDataType(dataset: Dataset, column: string): FieldDataType {
  let nums = 0;
  let floats = 0;
  let bools = 0;
  let checked = 0;
  for (const row of dataset.rows.slice(0, 80)) {
    const v = row[column];
    if (v == null || v === '') continue;
    checked += 1;
    if (typeof v === 'boolean' || /^(true|false|да|нет)$/i.test(String(v).trim())) {
      bools += 1;
      continue;
    }
    if (typeof v === 'number') {
      nums += 1;
      if (!Number.isInteger(v)) floats += 1;
      continue;
    }
    const s = String(v).trim().replace(/\s/g, '').replace(',', '.');
    if (s !== '' && /^-?\d+(\.\d+)?$/.test(s) && !Number.isNaN(Number(s))) {
      nums += 1;
      if (s.includes('.')) floats += 1;
    }
  }
  // Prefer numeric before date heuristics (Date.parse is too greedy on ints).
  if (checked && bools / checked >= 0.8) return 'Boolean';
  if (checked && nums / checked >= 0.7) return floats > 0 ? 'Float' : 'Integer';
  if (isDateLikeColumn(dataset, column)) {
    const sample = dataset.rows.find((r) => r[column] != null && String(r[column]).includes('T'));
    return sample ? 'DateTime' : 'Date';
  }
  return 'String';
}

function defaultWidget(role: FieldRole, dataType: FieldDataType): FilterWidgetKind {
  if (role === 'ignore' || role === 'measure') return 'none';
  if (role === 'date' || dataType === 'Date' || dataType === 'DateTime') return 'double_stepper';
  if (role === 'filter') return 'multi';
  if (dataType === 'Boolean') return 'toggle';
  if (dataType === 'Integer' || dataType === 'Float') return 'slider_double';
  return 'dropdown';
}

function defaultFormat(role: FieldRole, dataType: FieldDataType): FieldFormatKind {
  if (role === 'date' || dataType === 'Date' || dataType === 'DateTime') return 'date';
  if (dataType === 'Integer') return 'integer';
  if (dataType === 'Float') return 'number';
  if (role === 'measure') return 'number';
  return 'auto';
}

/** Build or merge field schema after rows load. */
export function buildFieldSchema(
  dataset: Dataset,
  previous?: FieldSchemaMap,
): FieldSchemaMap {
  const roles = dataset.fieldRoles || suggestFieldRoles(dataset);
  const next: FieldSchemaMap = {};
  for (const col of dataset.columns) {
    const prev = previous?.[col];
    const dataType = prev?.dataType || detectFieldDataType(dataset, col);
    const role = prev?.role || roles[col] || 'dimension';
    next[col] = {
      role,
      dataType,
      widget: prev?.widget ?? defaultWidget(role, dataType),
      format: prev?.format ?? defaultFormat(role, dataType),
    };
  }
  return next;
}

export function fieldRolesFromSchema(schema: FieldSchemaMap): Record<string, FieldRole> {
  const roles: Record<string, FieldRole> = {};
  for (const [col, cfg] of Object.entries(schema)) {
    roles[col] = cfg.role;
  }
  return roles;
}

/** Map ETL widget → panel filter kind used by FiltersPanel. */
export function widgetToPanelKind(
  widget: FilterWidgetKind,
  role: FieldRole,
  dataType?: FieldDataType,
): PanelFilterConfig['kind'] | null {
  if (widget === 'none') return null;
  if (widget === 'double_stepper' || widget === 'stepper') {
    const dateLike =
      role === 'date' || dataType === 'Date' || dataType === 'DateTime';
    return dateLike ? 'date' : 'dropdown';
  }
  if (widget === 'multi') return 'multi';
  if (widget === 'dropdown') return 'dropdown';
  if (widget === 'toggle') return 'toggle';
  if (widget === 'slider_double') return 'slider_double';
  return 'select';
}

/** Build panel filter configs from schema (fields with a widget). */
export function panelFiltersFromSchema(
  dataset: Dataset,
  schema: FieldSchemaMap,
): Omit<PanelFilterConfig, 'id'>[] {
  const out: Omit<PanelFilterConfig, 'id'>[] = [];
  for (const col of dataset.columns) {
    const cfg = schema[col];
    if (!cfg || cfg.role === 'ignore' || cfg.role === 'measure') continue;
    const kind = widgetToPanelKind(cfg.widget, cfg.role, cfg.dataType);
    if (!kind) continue;
    out.push({
      kind,
      datasetId: dataset.id,
      column: col,
      label: col,
    });
  }
  return out;
}

export function patchSchemaField(
  schema: FieldSchemaMap,
  column: string,
  patch: Partial<FieldSchemaConfig>,
): FieldSchemaMap {
  const cur = schema[column];
  if (!cur) return schema;
  const next = { ...cur, ...patch };
  // Keep widget coherent when role flips to measure/ignore
  if (patch.role === 'measure' || patch.role === 'ignore') {
    next.widget = 'none';
  } else if (patch.role && cur.role !== patch.role && (!patch.widget || patch.widget === cur.widget)) {
    next.widget = defaultWidget(patch.role, next.dataType);
  }
  return { ...schema, [column]: next };
}

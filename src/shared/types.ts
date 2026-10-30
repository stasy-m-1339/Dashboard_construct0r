export type WidgetType =
  | 'kpi'
  | 'kpi-delta'
  | 'bar'
  | 'stacked-bar'
  | 'hbar'
  | 'line'
  | 'area'
  | 'combo'
  | 'pie'
  | 'donut'
  | 'waterfall'
  | 'top-list'
  | 'matrix'
  | 'table'
  | 'filter-select'
  | 'filter-chips'
  | 'filter-date';

/** Visual tone from standalone dashboard (fact teal / plan sand). */
export type WidgetTone = 'default' | 'fact' | 'plan' | 'insight';

export type DatasetRow = Record<string, string | number | boolean | null>;

/** Suggested / user-overridden role of a dataset column. */
export type FieldRole = 'dimension' | 'measure' | 'filter' | 'date' | 'ignore';

export interface FieldRoleMap {
  [column: string]: FieldRole;
}

/** Detected / overridden column data type (ETL step 1). */
export type FieldDataType =
  | 'String'
  | 'Integer'
  | 'Float'
  | 'Boolean'
  | 'Date'
  | 'DateTime';

/**
 * Soft-rail / schema widget for a dimension/filter field (ETL step 2).
 * Mirrors Flat Design prototype options.
 */
export type FilterWidgetKind =
  | 'dropdown'
  | 'multi'
  | 'stepper'
  | 'double_stepper'
  | 'toggle'
  | 'slider_double'
  | 'none';

export type FieldFormatKind =
  | 'auto'
  | 'text'
  | 'number'
  | 'money'
  | 'pct'
  | 'date'
  | 'integer';

/** Per-column schema configured in the ETL wizard. */
export interface FieldSchemaConfig {
  role: FieldRole;
  widget: FilterWidgetKind;
  format: FieldFormatKind;
  dataType: FieldDataType;
}

export interface FieldSchemaMap {
  [column: string]: FieldSchemaConfig;
}

/**
 * Named measure toggle group (e.g. «Без НДС» / «С НДС»).
 * Each option maps a button label → measure field on the dataset.
 */
export interface MeasureToggleOption {
  id: string;
  label: string;
  field: string;
}

export interface MeasureToggleGroup {
  id: string;
  name: string;
  options: MeasureToggleOption[];
  defaultOptionId?: string;
}

/** Simple calculated field stored with the dataset. */
export type CalcExprKind =
  | 'sum' // alias / passthrough numeric (or SUM agg intent)
  | 'avg'
  | 'count'
  | 'count_distinct'
  | 'ratio' // a / b
  | 'share' // a / Σa × 100  (доля)
  | 'year' // calendar year(dateCol)
  | 'month' // calendar month(dateCol)
  | 'iso_week' // ISO 8601 week number (or YYYY.WW when withYear)
  | 'delta' // a - b
  | 'pct' // a / b * 100
  | 'growth' // прирост: (report - base) / base * 100
  | 'growth_contrib' // вклад: (report - base) / Sum(base) * 100  ≈ (A−B)/ΣB×100
  | 'if'
  | 'switch'
  | 'const'; // constant number

export type CalcCompareOp =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'lt'
  | 'gte'
  | 'lte'
  | 'between'
  | 'contains';

export interface CalcSwitchCase {
  id: string;
  match: string;
  result: string | number;
}

export interface CalculatedField {
  id: string;
  name: string;
  kind: CalcExprKind;
  /**
   * Primary column:
   * - date for year/month/iso_week
   * - report / actual measure for growth*
   * - numerator / source otherwise
   * - IF/SWITCH subject column
   */
  a?: string;
  /**
   * Secondary column:
   * - base / plan measure for growth*
   * - denominator / subtract otherwise
   * - IF between: upper bound column (optional)
   */
  b?: string;
  /** For kind=const / IF then-else numeric */
  value?: number;
  value2?: number;
  /**
   * iso_week: when true, emit `YYYY.WW` (ISO week-year + week),
   * otherwise just the week number 1–53.
   */
  withYear?: boolean;
  /** IF compare operator */
  op?: CalcCompareOp;
  /** IF then / else results (string or number encoded as string) */
  thenValue?: string | number;
  elseValue?: string | number;
  /** SWITCH cases (+ add case in UI) */
  cases?: CalcSwitchCase[];
  defaultValue?: string | number;
}

export interface Dataset {
  id: string;
  name: string;
  columns: string[];
  rows: DatasetRow[];
  updatedAt?: string;
  /** Field roles (suggested after load, user can override) */
  fieldRoles?: FieldRoleMap;
  /** Full per-field schema from ETL wizard (roles/widgets/formats/types) */
  fieldSchema?: FieldSchemaMap;
  /** Extra computed columns materialised into rows/columns */
  calculatedFields?: CalculatedField[];
  /** Measure toggle groups (button label → measure field) */
  measureToggles?: MeasureToggleGroup[];
}

/** CSV delimiter override for parse / refresh. */
export type CsvDelimiter = 'auto' | ',' | ';' | '\t';

export interface SourceCsv {
  id: string;
  type: 'csv';
  name: string;
  /** Original filename for display */
  fileName: string;
  /** Raw CSV text stored in studio (not published) */
  content: string;
  /**
   * Delimiter used when parsing on refresh.
   * `auto` detects `;` / `,` / tab from the first lines.
   */
  delimiter?: CsvDelimiter;
}

export interface SourceMssql {
  id: string;
  type: 'mssql';
  name: string;
  server: string;
  database: string;
  user: string;
  /** Password kept only in studio memory/local settings — never exported */
  password: string;
  port?: number;
  encrypt?: boolean;
  trustServerCertificate?: boolean;
}

export type DataSource = SourceCsv | SourceMssql;

export type PipelineStep =
  | { id: string; type: 'select-columns'; columns: string[] }
  | { id: string; type: 'filter-rows'; column: string; op: 'eq' | 'neq' | 'contains' | 'gt' | 'lt'; value: string }
  | {
      id: string;
      type: 'join';
      /** Other CSV/MSSQL source id (resolved during «Обновить данные») */
      rightSourceId: string;
      leftKey: string;
      rightKey: string;
      how: 'left' | 'inner';
    }
  | {
      id: string;
      type: 'aggregate';
      groupBy: string[];
      metrics: { column: string; fn: 'sum' | 'avg' | 'count' | 'min' | 'max'; as: string }[];
    }
  | { id: string; type: 'sql'; query: string };

export interface Pipeline {
  id: string;
  name: string;
  sourceId: string;
  steps: PipelineStep[];
  datasetId: string;
}

export interface WidgetBinding {
  datasetId?: string;
  /** For KPI / charts / table */
  valueColumn?: string;
  categoryColumn?: string;
  columns?: string[];
  /** Compare / plan column (kpi-delta, combo, waterfall) */
  compareColumn?: string;
  /** Extra numeric series for stacked-bar / combo line */
  seriesColumns?: string[];
  lineColumn?: string;
  /** Matrix pivot */
  rowColumn?: string;
  colColumn?: string;
  /** Top-list / hbar limit */
  maxItems?: number;
  /** For filters */
  filterColumn?: string;
  label?: string;
  format?: 'number' | 'money' | 'pct' | string;
  tone?: WidgetTone;
  badge?: string;
  /** Matrix/pivot: show row & column totals */
  showTotals?: boolean;
}

export interface WidgetInstance {
  id: string;
  type: WidgetType;
  title: string;
  binding: WidgetBinding;
  /** react-grid-layout position */
  layout: { x: number; y: number; w: number; h: number };
}

export interface DashboardTab {
  id: string;
  title: string;
  widgets: WidgetInstance[];
}

export interface ThemeConfig {
  id: string;
  name: string;
  /** Short Russian blurb for Styles modal */
  description?: string;
  background: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  border: string;
  chartPalette: string[];
  fontFamily: string;
  /** Card corner radius (px); flat/swiss often smaller */
  radius?: number;
  /** Card border width (px); neo-brutalism uses thick borders */
  borderWidth?: number;
  /** Card box-shadow; empty/none for flat & swiss */
  shadow?: string;
  /** Optional header/title accent bar (e.g. Tableau blue) */
  headerBg?: string;
  /** Suggested chart palette id when this theme is picked */
  preferredPaletteId?: string;
}

/** Independent chart series palette (Styles modal presets). */
export interface ChartPalettePreset {
  id: string;
  name: string;
  description?: string;
  colors: string[];
  /** Optional accent to apply when palette is selected */
  accentHint?: string;
}

/** Soft-rail panel filter (independent of canvas widgets). */
export type PanelFilterKind =
  | 'select'
  | 'date'
  | 'dropdown'
  | 'multi'
  | 'stepper'
  | 'double_stepper'
  | 'toggle'
  | 'slider_double';

export interface PanelFilterConfig {
  id: string;
  kind: PanelFilterKind;
  datasetId: string;
  /** Column to filter (for dates: which date column) */
  column: string;
  label?: string;
}

export interface DashboardConfig {
  id: string;
  title: string;
  themeId: string;
  /**
   * Optional override for chart series colors (and accent hint).
   * Independent of theme; Tableau theme prefers tableau-10.
   */
  chartPaletteId?: string;
  tabs: DashboardTab[];
  activeTabId: string;
  /** Soft-rail filters panel (~320px), like standalone dashboard */
  showFiltersPanel?: boolean;
  /** Start collapsed when panel is enabled */
  filtersPanelCollapsed?: boolean;
  /**
   * Panel filter fields — source of truth when showFiltersPanel is on.
   * Independent from canvas filter widgets (deleting a grid filter does not
   * remove these).
   */
  panelFilters?: PanelFilterConfig[];
}

export interface StudioProject {
  dashboard: DashboardConfig;
  sources: DataSource[];
  pipelines: Pipeline[];
  datasets: Dataset[];
}

export interface BlockPreset {
  id: string;
  type: WidgetType;
  title: string;
  description: string;
  defaultBinding: WidgetBinding;
  defaultLayout: { w: number; h: number };
  /** Full JSON schema hint for AI import */
  schemaHint?: string;
}

export interface PublishedPayload {
  version: 1;
  dashboard: DashboardConfig;
  datasets: Dataset[];
  theme: ThemeConfig;
}

export interface FilterState {
  /** filter id (panel or canvas widget) -> selected value(s) */
  [filterId: string]:
    | string
    | string[]
    | { from?: string; to?: string; week?: string }
    | { min?: number; max?: number }
    | undefined;
}

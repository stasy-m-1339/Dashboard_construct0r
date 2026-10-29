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

/** Simple calculated field stored with the dataset. */
export type CalcExprKind =
  | 'sum' // alias / passthrough numeric
  | 'ratio' // a / b
  | 'year' // year(dateCol)
  | 'month' // month(dateCol)
  | 'delta' // a - b
  | 'pct' // a / b * 100
  | 'const'; // constant number

export interface CalculatedField {
  id: string;
  name: string;
  kind: CalcExprKind;
  /** Primary column (numerator / date / source) */
  a?: string;
  /** Secondary column (denominator / subtract) */
  b?: string;
  /** For kind=const */
  value?: number;
}

export interface Dataset {
  id: string;
  name: string;
  columns: string[];
  rows: DatasetRow[];
  updatedAt?: string;
  /** Field roles (suggested after load, user can override) */
  fieldRoles?: FieldRoleMap;
  /** Extra computed columns materialised into rows/columns */
  calculatedFields?: CalculatedField[];
}

export interface SourceCsv {
  id: string;
  type: 'csv';
  name: string;
  /** Original filename for display */
  fileName: string;
  /** Raw CSV text stored in studio (not published) */
  content: string;
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
export type PanelFilterKind = 'select' | 'date';

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
    | undefined;
}

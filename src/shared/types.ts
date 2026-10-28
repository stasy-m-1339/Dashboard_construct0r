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

export interface Dataset {
  id: string;
  name: string;
  columns: string[];
  rows: DatasetRow[];
  updatedAt?: string;
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
  background: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  border: string;
  chartPalette: string[];
  fontFamily: string;
}

export interface DashboardConfig {
  id: string;
  title: string;
  themeId: string;
  tabs: DashboardTab[];
  activeTabId: string;
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
  /** widgetId -> selected value(s) */
  [widgetId: string]: string | string[] | { from?: string; to?: string } | undefined;
}

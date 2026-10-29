import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { BLOCK_LIBRARY, createWidgetFromPreset, parseImportedBlock } from '../shared/blocks';
import {
  DEFAULT_THEME_ID,
  getTheme,
  normalizeChartPaletteId,
  normalizeThemeId,
} from '../shared/themes';
import type {
  BlockPreset,
  DashboardTab,
  DataSource,
  Dataset,
  PanelFilterConfig,
  Pipeline,
  SourceCsv,
  SourceMssql,
  StudioProject,
  WidgetInstance,
} from '../shared/types';
import { enrichDatasets } from '../shared/fieldMeta';

function uid(prefix = 'id'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function emptyTab(title = 'Вкладка 1'): DashboardTab {
  return { id: uid('tab'), title, widgets: [] };
}

function createDefaultProject(): StudioProject {
  const tab = emptyTab('Обзор');
  return {
    dashboard: {
      id: uid('dash'),
      title: 'Новый дашборд',
      themeId: DEFAULT_THEME_ID,
      tabs: [tab],
      activeTabId: tab.id,
      showFiltersPanel: false,
      filtersPanelCollapsed: false,
      panelFilters: [],
    },
    sources: [],
    pipelines: [],
    datasets: [],
  };
}

export type ViewportMode = 'fluid' | '1024x768';

interface StudioState extends StudioProject {
  customBlocks: BlockPreset[];
  previewMode: boolean;
  viewportMode: ViewportMode;
  lastError: string | null;
  refreshing: boolean;

  setTitle: (title: string) => void;
  setThemeId: (themeId: string) => void;
  setChartPaletteId: (paletteId: string | undefined) => void;
  setShowFiltersPanel: (v: boolean) => void;
  setFiltersPanelCollapsed: (v: boolean) => void;
  addPanelFilters: (filters: Omit<PanelFilterConfig, 'id'>[]) => void;
  removePanelFilter: (filterId: string) => void;
  updatePanelFilter: (filterId: string, patch: Partial<PanelFilterConfig>) => void;
  setViewportMode: (v: ViewportMode) => void;
  setActiveTab: (tabId: string) => void;
  addTab: () => void;
  renameTab: (tabId: string, title: string) => void;
  removeTab: (tabId: string) => void;

  addWidgetFromLibrary: (presetId: string) => void;
  updateWidget: (widgetId: string, patch: Partial<WidgetInstance>) => void;
  removeWidget: (widgetId: string) => void;
  updateLayouts: (layouts: { i: string; x: number; y: number; w: number; h: number }[]) => void;

  importBlockJson: (raw: unknown) => string | null;
  addCustomBlock: (preset: BlockPreset) => void;

  addCsvSource: (name: string, fileName: string, content: string) => void;
  addMssqlSource: (source: Omit<SourceMssql, 'id' | 'type'>) => void;
  updateSource: (id: string, patch: Partial<DataSource>) => void;
  removeSource: (id: string) => void;

  addPipeline: (partial?: Partial<Pipeline>) => void;
  updatePipeline: (id: string, patch: Partial<Pipeline>) => void;
  removePipeline: (id: string) => void;

  setDatasets: (datasets: Dataset[]) => void;
  updateDatasetMeta: (
    datasetId: string,
    patch: Partial<
      Pick<Dataset, 'fieldRoles' | 'calculatedFields' | 'columns' | 'rows' | 'name'>
    >,
  ) => void;
  setPreviewMode: (v: boolean) => void;
  setLastError: (msg: string | null) => void;
  setRefreshing: (v: boolean) => void;
  resetProject: () => void;
  loadDemo: () => void;
}

const activeTab = (s: StudioState): DashboardTab | undefined =>
  s.dashboard.tabs.find((t) => t.id === s.dashboard.activeTabId);

export const useStudioStore = create<StudioState>()(
  persist(
    (set, get) => ({
      ...createDefaultProject(),
      customBlocks: [],
      previewMode: false,
      viewportMode: 'fluid',
      lastError: null,
      refreshing: false,

      setTitle: (title) =>
        set((s) => ({ dashboard: { ...s.dashboard, title } })),

      setThemeId: (themeId) =>
        set((s) => {
          const nextId = normalizeThemeId(themeId);
          const preferred = getTheme(nextId).preferredPaletteId;
          return {
            dashboard: {
              ...s.dashboard,
              themeId: nextId,
              // Tableau (etc.) syncs its preferred palette; other themes keep
              // any independently chosen chartPaletteId.
              ...(preferred ? { chartPaletteId: preferred } : {}),
            },
          };
        }),

      setChartPaletteId: (paletteId) =>
        set((s) => ({
          dashboard: {
            ...s.dashboard,
            chartPaletteId: normalizeChartPaletteId(paletteId),
          },
        })),

      setShowFiltersPanel: (showFiltersPanel) =>
        set((s) => ({ dashboard: { ...s.dashboard, showFiltersPanel } })),

      setFiltersPanelCollapsed: (filtersPanelCollapsed) =>
        set((s) => ({ dashboard: { ...s.dashboard, filtersPanelCollapsed } })),

      addPanelFilters: (filters) =>
        set((s) => {
          const existing = s.dashboard.panelFilters || [];
          const existingKeys = new Set(existing.map((f) => `${f.datasetId}::${f.column}`));
          const next: PanelFilterConfig[] = [...existing];
          for (const f of filters) {
            const key = `${f.datasetId}::${f.column}`;
            if (existingKeys.has(key)) continue;
            existingKeys.add(key);
            next.push({ ...f, id: uid('pf') });
          }
          return {
            dashboard: {
              ...s.dashboard,
              showFiltersPanel: true,
              panelFilters: next,
            },
          };
        }),

      removePanelFilter: (filterId) =>
        set((s) => ({
          dashboard: {
            ...s.dashboard,
            panelFilters: (s.dashboard.panelFilters || []).filter((f) => f.id !== filterId),
          },
        })),

      updatePanelFilter: (filterId, patch) =>
        set((s) => ({
          dashboard: {
            ...s.dashboard,
            panelFilters: (s.dashboard.panelFilters || []).map((f) =>
              f.id === filterId ? { ...f, ...patch, id: f.id } : f,
            ),
          },
        })),

      setViewportMode: (viewportMode) => set({ viewportMode }),

      setActiveTab: (tabId) =>
        set((s) => ({ dashboard: { ...s.dashboard, activeTabId: tabId } })),

      addTab: () =>
        set((s) => {
          const tab = emptyTab(`Вкладка ${s.dashboard.tabs.length + 1}`);
          return {
            dashboard: {
              ...s.dashboard,
              tabs: [...s.dashboard.tabs, tab],
              activeTabId: tab.id,
            },
          };
        }),

      renameTab: (tabId, title) =>
        set((s) => ({
          dashboard: {
            ...s.dashboard,
            tabs: s.dashboard.tabs.map((t) => (t.id === tabId ? { ...t, title } : t)),
          },
        })),

      removeTab: (tabId) =>
        set((s) => {
          if (s.dashboard.tabs.length <= 1) return s;
          const tabs = s.dashboard.tabs.filter((t) => t.id !== tabId);
          return {
            dashboard: {
              ...s.dashboard,
              tabs,
              activeTabId:
                s.dashboard.activeTabId === tabId ? tabs[0].id : s.dashboard.activeTabId,
            },
          };
        }),

      addWidgetFromLibrary: (presetId) => {
        const all = [...BLOCK_LIBRARY, ...get().customBlocks];
        const preset = all.find((p) => p.id === presetId);
        if (!preset) return;
        set((s) => {
          const tab = activeTab(s);
          if (!tab) return s;
          const maxY = tab.widgets.reduce((m, w) => Math.max(m, w.layout.y + w.layout.h), 0);
          const widget = createWidgetFromPreset(preset, uid('w'), {
            x: 0,
            y: maxY,
            w: preset.defaultLayout.w,
            h: preset.defaultLayout.h,
          });
          // auto-bind first dataset if any
          if (s.datasets[0] && !widget.binding.datasetId) {
            widget.binding = {
              ...widget.binding,
              datasetId: s.datasets[0].id,
              valueColumn: widget.binding.valueColumn || s.datasets[0].columns[1] || s.datasets[0].columns[0],
              categoryColumn:
                widget.binding.categoryColumn || s.datasets[0].columns[0],
              filterColumn: widget.binding.filterColumn || s.datasets[0].columns[0],
              columns: widget.binding.columns?.length
                ? widget.binding.columns
                : s.datasets[0].columns,
            };
          }
          return {
            dashboard: {
              ...s.dashboard,
              tabs: s.dashboard.tabs.map((t) =>
                t.id === tab.id ? { ...t, widgets: [...t.widgets, widget] } : t,
              ),
            },
          };
        });
      },

      updateWidget: (widgetId, patch) =>
        set((s) => ({
          dashboard: {
            ...s.dashboard,
            tabs: s.dashboard.tabs.map((t) => ({
              ...t,
              widgets: t.widgets.map((w) =>
                w.id === widgetId
                  ? {
                      ...w,
                      ...patch,
                      binding: patch.binding ? { ...w.binding, ...patch.binding } : w.binding,
                      layout: patch.layout ? { ...w.layout, ...patch.layout } : w.layout,
                    }
                  : w,
              ),
            })),
          },
        })),

      removeWidget: (widgetId) =>
        set((s) => ({
          dashboard: {
            ...s.dashboard,
            tabs: s.dashboard.tabs.map((t) => ({
              ...t,
              widgets: t.widgets.filter((w) => w.id !== widgetId),
            })),
          },
        })),

      updateLayouts: (layouts) =>
        set((s) => {
          const map = Object.fromEntries(layouts.map((l) => [l.i, l]));
          return {
            dashboard: {
              ...s.dashboard,
              tabs: s.dashboard.tabs.map((t) =>
                t.id === s.dashboard.activeTabId
                  ? {
                      ...t,
                      widgets: t.widgets.map((w) => {
                        const l = map[w.id];
                        return l ? { ...w, layout: { x: l.x, y: l.y, w: l.w, h: l.h } } : w;
                      }),
                    }
                  : t,
              ),
            },
          };
        }),

      importBlockJson: (raw) => {
        const parsed = parseImportedBlock(raw);
        if ('error' in parsed) return parsed.error;
        get().addCustomBlock(parsed);
        return null;
      },

      addCustomBlock: (preset) =>
        set((s) => ({
          customBlocks: [...s.customBlocks.filter((b) => b.id !== preset.id), preset],
        })),

      addCsvSource: (name, fileName, content) =>
        set((s) => {
          const source: SourceCsv = {
            id: uid('src'),
            type: 'csv',
            name,
            fileName,
            content,
          };
          const datasetId = uid('ds');
          const pipeline: Pipeline = {
            id: uid('pipe'),
            name: `Датасет: ${name}`,
            sourceId: source.id,
            steps: [],
            datasetId,
          };
          return {
            sources: [...s.sources, source],
            pipelines: [...s.pipelines, pipeline],
          };
        }),

      addMssqlSource: (partial) =>
        set((s) => {
          const source: SourceMssql = { id: uid('src'), type: 'mssql', ...partial };
          const datasetId = uid('ds');
          const pipeline: Pipeline = {
            id: uid('pipe'),
            name: `Датасет: ${partial.name}`,
            sourceId: source.id,
            steps: [
              {
                id: uid('step'),
                type: 'sql',
                query: 'SELECT TOP 100 * FROM dbo.YourTable',
              },
            ],
            datasetId,
          };
          return {
            sources: [...s.sources, source],
            pipelines: [...s.pipelines, pipeline],
          };
        }),

      updateSource: (id, patch) =>
        set((s) => ({
          sources: s.sources.map((src) =>
            src.id === id ? ({ ...src, ...patch } as DataSource) : src,
          ),
        })),

      removeSource: (id) =>
        set((s) => ({
          sources: s.sources.filter((x) => x.id !== id),
          pipelines: s.pipelines.filter((p) => p.sourceId !== id),
        })),

      addPipeline: (partial) =>
        set((s) => {
          const sourceId = partial?.sourceId || s.sources[0]?.id;
          if (!sourceId) return s;
          const pipeline: Pipeline = {
            id: uid('pipe'),
            name: partial?.name || 'Новый пайплайн',
            sourceId,
            steps: partial?.steps || [],
            datasetId: partial?.datasetId || uid('ds'),
          };
          return { pipelines: [...s.pipelines, pipeline] };
        }),

      updatePipeline: (id, patch) =>
        set((s) => ({
          pipelines: s.pipelines.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        })),

      removePipeline: (id) =>
        set((s) => ({ pipelines: s.pipelines.filter((p) => p.id !== id) })),

      setDatasets: (datasets) =>
        set((s) => ({ datasets: enrichDatasets(datasets, s.datasets) })),

      updateDatasetMeta: (datasetId, patch) =>
        set((s) => ({
          datasets: s.datasets.map((d) => (d.id === datasetId ? { ...d, ...patch } : d)),
        })),

      setPreviewMode: (previewMode) => set({ previewMode }),
      setLastError: (lastError) => set({ lastError }),
      setRefreshing: (refreshing) => set({ refreshing }),

      resetProject: () => set({ ...createDefaultProject(), customBlocks: get().customBlocks }),

      loadDemo: () => {
        // Demo is loaded via samples/sales.csv through UI; here set a starter layout after datasets exist
        const s = get();
        if (!s.datasets.length) return;
        const ds = s.datasets[0];
        const tab = activeTab(s);
        if (!tab) return;
        const widgets: WidgetInstance[] = [
          {
            id: uid('w'),
            type: 'kpi',
            title: 'Выручка',
            binding: { datasetId: ds.id, valueColumn: 'amount', label: 'Сумма продаж' },
            layout: { x: 0, y: 0, w: 3, h: 2 },
          },
          {
            id: uid('w'),
            type: 'bar',
            title: 'Продажи по регионам',
            binding: {
              datasetId: ds.id,
              categoryColumn: 'region',
              valueColumn: 'amount',
            },
            layout: { x: 0, y: 2, w: 6, h: 4 },
          },
          {
            id: uid('w'),
            type: 'pie',
            title: 'По категориям',
            binding: {
              datasetId: ds.id,
              categoryColumn: 'category',
              valueColumn: 'amount',
            },
            layout: { x: 6, y: 2, w: 6, h: 4 },
          },
          {
            id: uid('w'),
            type: 'line',
            title: 'По дням',
            binding: {
              datasetId: ds.id,
              categoryColumn: 'date',
              valueColumn: 'amount',
            },
            layout: { x: 0, y: 6, w: 8, h: 4 },
          },
          {
            id: uid('w'),
            type: 'table',
            title: 'Детализация',
            binding: { datasetId: ds.id, columns: ds.columns },
            layout: { x: 0, y: 10, w: 12, h: 5 },
          },
        ];
        const panelFilters: PanelFilterConfig[] = [
          {
            id: uid('pf'),
            kind: 'select',
            datasetId: ds.id,
            column: 'region',
            label: 'Регион',
          },
          {
            id: uid('pf'),
            kind: 'select',
            datasetId: ds.id,
            column: 'category',
            label: 'Категория',
          },
          {
            id: uid('pf'),
            kind: 'date',
            datasetId: ds.id,
            column: 'date',
            label: 'Период',
          },
        ];
        set({
          dashboard: {
            ...s.dashboard,
            title: 'Демо: продажи',
            showFiltersPanel: true,
            panelFilters,
            tabs: s.dashboard.tabs.map((t) =>
              t.id === tab.id ? { ...t, title: 'Обзор', widgets } : t,
            ),
          },
        });
      },
    }),
    {
      name: 'dashboard-construct0r-studio',
      partialize: (s) => ({
        dashboard: {
          ...s.dashboard,
          themeId: normalizeThemeId(s.dashboard.themeId),
          chartPaletteId: normalizeChartPaletteId(s.dashboard.chartPaletteId),
        },
        // Keep secrets in localStorage for UX only — never export to HTML.
        sources: s.sources,
        pipelines: s.pipelines,
        datasets: s.datasets,
        customBlocks: s.customBlocks,
      }),
      merge: (persisted, current) => {
        const p = (persisted || {}) as Partial<StudioState>;
        const merged = { ...current, ...p } as StudioState;
        if (merged.dashboard) {
          merged.dashboard = {
            ...merged.dashboard,
            themeId: normalizeThemeId(merged.dashboard.themeId),
            chartPaletteId: normalizeChartPaletteId(merged.dashboard.chartPaletteId),
          };
        }
        return merged;
      },
    },
  ),
);

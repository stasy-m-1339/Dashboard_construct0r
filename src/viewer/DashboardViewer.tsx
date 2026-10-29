import { useEffect, useMemo, useState } from 'react';
import GridLayout from 'react-grid-layout/legacy';
import type { Layout } from 'react-grid-layout/legacy';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import type { FilterState, PublishedPayload } from '../shared/types';
import { resolveTheme, themeToCssVars } from '../shared/themes';
import { WidgetRenderer } from './WidgetRenderer';
import { FiltersPanel, partitionFilterWidgets } from './FiltersPanel';

interface Props {
  payload: PublishedPayload;
  /** When true, show tab switcher and filters work; layout is static */
  editable?: boolean;
  width?: number;
}

export function DashboardViewer({ payload, editable = false, width = 1200 }: Props) {
  const theme =
    payload.theme ||
    resolveTheme(payload.dashboard.themeId, payload.dashboard.chartPaletteId);
  const themeVars = themeToCssVars(theme);
  const [activeTabId, setActiveTabId] = useState(payload.dashboard.activeTabId);
  const [filters, setFilters] = useState<FilterState>({});
  const [panelCollapsed, setPanelCollapsed] = useState(
    !!payload.dashboard.filtersPanelCollapsed,
  );
  const showFiltersPanel = !!payload.dashboard.showFiltersPanel;

  const tab =
    payload.dashboard.tabs.find((t) => t.id === activeTabId) || payload.dashboard.tabs[0];

  const { rest: gridWidgets } = useMemo(
    () =>
      showFiltersPanel
        ? partitionFilterWidgets(tab?.widgets || [])
        : { filters: [], rest: tab?.widgets || [] },
    [tab, showFiltersPanel],
  );

  const layout: Layout = useMemo(
    () =>
      gridWidgets.map((w) => ({
        i: w.id,
        x: w.layout.x,
        y: w.layout.y,
        w: w.layout.w,
        h: w.layout.h,
        static: !editable,
      })),
    [gridWidgets, editable],
  );

  const panelWidth = showFiltersPanel ? (panelCollapsed ? 34 : 320) : 0;
  const gridWidth = Math.max(320, width - panelWidth - 8);

  useEffect(() => {
    // Remeasure charts after panel toggle / tab change.
    const id = window.setTimeout(() => window.dispatchEvent(new Event('resize')), 80);
    return () => window.clearTimeout(id);
  }, [panelCollapsed, showFiltersPanel, activeTabId, gridWidth]);

  return (
    <div
      style={{
        minHeight: '100%',
        height: '100%',
        background: theme.background,
        color: theme.text,
        fontFamily: theme.fontFamily,
        padding: '16px 20px 40px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        ...themeVars,
      }}
    >
      <header
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'baseline',
          gap: 16,
          marginBottom: 14,
          flexShrink: 0,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em' }}>
          {payload.dashboard.title}
        </h1>
        <nav style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {payload.dashboard.tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setActiveTabId(t.id);
                setFilters({});
              }}
              style={{
                border: `1px solid ${t.id === tab?.id ? theme.accent : theme.border}`,
                background: t.id === tab?.id ? theme.accent : theme.surface,
                color: t.id === tab?.id ? '#ffffff' : theme.text,
                borderRadius: 999,
                padding: '6px 14px',
                cursor: 'pointer',
                fontSize: 13,
                boxShadow: t.id === tab?.id ? '0 0 0 3px rgba(2,102,94,.25)' : 'none',
              }}
            >
              {t.title}
            </button>
          ))}
        </nav>
      </header>

      {tab && (
        <div className="dashboard-with-filters" style={{ flex: 1, minHeight: 480 }}>
          {showFiltersPanel && (
            <FiltersPanel
              widgets={tab.widgets}
              tabWidgets={tab.widgets}
              datasets={payload.datasets}
              filters={filters}
              onFilterChange={(id, value) => setFilters((prev) => ({ ...prev, [id]: value }))}
              theme={theme}
              collapsed={panelCollapsed}
              onCollapsedChange={setPanelCollapsed}
              onClearAll={() => setFilters({})}
            />
          )}
          <div className="dashboard-main">
            <GridLayout
              className="layout"
              layout={layout}
              cols={12}
              rowHeight={48}
              width={gridWidth}
              isDraggable={editable}
              isResizable={editable}
              compactType="vertical"
              margin={[12, 12]}
              onLayoutChange={() => {
                requestAnimationFrame(() => {
                  window.dispatchEvent(new Event('resize'));
                });
              }}
            >
              {gridWidgets.map((w) => (
                <div
                  key={w.id}
                  className={[
                    'widget-shell',
                    w.binding.tone === 'fact'
                      ? 'tone-fact'
                      : w.binding.tone === 'plan'
                        ? 'tone-plan'
                        : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <div className="widget-body">
                    <WidgetRenderer
                      widget={w}
                      tabWidgets={tab.widgets}
                      datasets={payload.datasets}
                      filters={filters}
                      onFilterChange={(id, value) =>
                        setFilters((prev) => ({ ...prev, [id]: value }))
                      }
                      theme={theme}
                      interactive
                    />
                  </div>
                </div>
              ))}
            </GridLayout>
          </div>
        </div>
      )}
    </div>
  );
}

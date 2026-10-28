import { useMemo, useState } from 'react';
import GridLayout from 'react-grid-layout/legacy';
import type { Layout } from 'react-grid-layout/legacy';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import type { FilterState, PublishedPayload } from '../shared/types';
import { getTheme } from '../shared/themes';
import { WidgetRenderer } from './WidgetRenderer';

interface Props {
  payload: PublishedPayload;
  /** When true, show tab switcher and filters work; layout is static */
  editable?: boolean;
  width?: number;
}

export function DashboardViewer({ payload, editable = false, width = 1200 }: Props) {
  const theme = payload.theme || getTheme(payload.dashboard.themeId);
  const [activeTabId, setActiveTabId] = useState(payload.dashboard.activeTabId);
  const [filters, setFilters] = useState<FilterState>({});

  const tab =
    payload.dashboard.tabs.find((t) => t.id === activeTabId) || payload.dashboard.tabs[0];

  const layout: Layout = useMemo(
    () =>
      (tab?.widgets || []).map((w) => ({
        i: w.id,
        x: w.layout.x,
        y: w.layout.y,
        w: w.layout.w,
        h: w.layout.h,
        static: !editable,
      })),
    [tab, editable],
  );

  return (
    <div
      style={{
        minHeight: '100%',
        background: theme.background,
        color: theme.text,
        fontFamily: theme.fontFamily,
        padding: '20px 24px 48px',
        boxSizing: 'border-box',
      }}
    >
      <header
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'baseline',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em' }}>
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
                boxShadow:
                  t.id === tab?.id ? '0 0 0 3px rgba(2,102,94,.25)' : 'none',
              }}
            >
              {t.title}
            </button>
          ))}
        </nav>
      </header>

      {tab && (
        <GridLayout
          className="layout"
          layout={layout}
          cols={12}
          rowHeight={48}
          width={width}
          isDraggable={editable}
          isResizable={editable}
          compactType="vertical"
          margin={[12, 12]}
        >
          {tab.widgets.map((w) => (
            <div key={w.id}>
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
          ))}
        </GridLayout>
      )}
    </div>
  );
}

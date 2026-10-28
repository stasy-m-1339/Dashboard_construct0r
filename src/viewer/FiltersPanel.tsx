import { useMemo, useState, type CSSProperties } from 'react';
import { isFilterWidget } from '../shared/blocks';
import type {
  Dataset,
  FilterState,
  ThemeConfig,
  WidgetInstance,
} from '../shared/types';
import { WidgetRenderer } from './WidgetRenderer';
import './filters-panel.css';

interface Props {
  widgets: WidgetInstance[];
  tabWidgets: WidgetInstance[];
  datasets: Dataset[];
  filters: FilterState;
  onFilterChange: (widgetId: string, value: FilterState[string]) => void;
  theme: ThemeConfig;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  selectedId?: string | null;
  onSelectWidget?: (id: string) => void;
  /** Clear all active filter values */
  onClearAll?: () => void;
}

export function FiltersPanel({
  widgets,
  tabWidgets,
  datasets,
  filters,
  onFilterChange,
  theme,
  collapsed: collapsedProp,
  onCollapsedChange,
  selectedId,
  onSelectWidget,
  onClearAll,
}: Props) {
  const [localCollapsed, setLocalCollapsed] = useState(false);
  const collapsed = collapsedProp ?? localCollapsed;
  const setCollapsed = (v: boolean) => {
    onCollapsedChange?.(v);
    if (collapsedProp === undefined) setLocalCollapsed(v);
  };

  const filterWidgets = useMemo(
    () => widgets.filter((w) => isFilterWidget(w.type)),
    [widgets],
  );

  const activeChips = useMemo(() => {
    const chips: { id: string; label: string; text: string }[] = [];
    for (const w of filterWidgets) {
      const v = filters[w.id];
      if (v === undefined || v === '' || v === null) continue;
      const label = w.binding.label || w.title;
      if (Array.isArray(v)) {
        if (!v.length) continue;
        chips.push({ id: w.id, label, text: v.join(', ') });
      } else if (typeof v === 'object' && v && ('from' in v || 'to' in v)) {
        const range = v as { from?: string; to?: string };
        if (!range.from && !range.to) continue;
        chips.push({
          id: w.id,
          label,
          text: `${range.from || '…'} — ${range.to || '…'}`,
        });
      } else {
        chips.push({ id: w.id, label, text: String(v) });
      }
    }
    return chips;
  }, [filterWidgets, filters]);

  return (
    <aside
      className={`filters-panel${collapsed ? ' collapsed' : ''}`}
      style={
        {
          '--fp-bg': theme.surface,
          '--fp-text': theme.text,
          '--fp-muted': theme.muted,
          '--fp-border': theme.border,
          '--fp-accent': theme.accent,
          '--fp-font': theme.fontFamily,
        } as CSSProperties
      }
    >
      <div className="filters-panel-header">
        {!collapsed && <h2 className="filters-title">Фильтры</h2>}
        {!collapsed && activeChips.length > 0 && (
          <button
            type="button"
            className="btn-mini"
            title="Сбросить все"
            onClick={() => onClearAll?.()}
          >
            ⌫
          </button>
        )}
        <button
          type="button"
          className="filters-toggle-btn"
          title={collapsed ? 'Развернуть панель' : 'Свернуть панель'}
          aria-label={collapsed ? 'Развернуть' : 'Свернуть'}
          onClick={() => setCollapsed(!collapsed)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points={collapsed ? '9 6 15 12 9 18' : '15 6 9 12 15 18'} />
          </svg>
        </button>
      </div>

      {!collapsed && (
        <div className="filters-panel-body">
          {activeChips.length > 0 && (
            <div className="filter-chips has-chips">
              {activeChips.map((c) => (
                <div key={c.id} className="filter-chip-row">
                  <span className="filter-chip-label">{c.label}</span>
                  <button
                    type="button"
                    className="filter-chip"
                    onClick={() => onFilterChange(c.id, undefined)}
                    title="Сбросить"
                  >
                    <span className="filter-chip-text">{c.text}</span>
                    <span className="filter-chip-close">×</span>
                  </button>
                </div>
              ))}
            </div>
          )}

          {!filterWidgets.length && (
            <p className="filters-empty">
              Добавьте блоки фильтра (список, чипы, период) на вкладку — они появятся здесь.
            </p>
          )}

          {filterWidgets.map((w) => (
            <div
              key={w.id}
              className={`filters-widget${selectedId === w.id ? ' selected' : ''}`}
              onClick={() => onSelectWidget?.(w.id)}
            >
              <WidgetRenderer
                widget={w}
                tabWidgets={tabWidgets}
                datasets={datasets}
                filters={filters}
                onFilterChange={onFilterChange}
                theme={theme}
                interactive
              />
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}

export function partitionFilterWidgets(widgets: WidgetInstance[]): {
  filters: WidgetInstance[];
  rest: WidgetInstance[];
} {
  const filters: WidgetInstance[] = [];
  const rest: WidgetInstance[] = [];
  for (const w of widgets) {
    if (isFilterWidget(w.type)) filters.push(w);
    else rest.push(w);
  }
  return { filters, rest };
}

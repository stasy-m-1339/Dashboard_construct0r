import { useEffect, useMemo, useState } from 'react';
import GridLayout from 'react-grid-layout/legacy';
import type { Layout } from 'react-grid-layout/legacy';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { useStudioStore } from '../store/useStudioStore';
import { getTheme } from '../shared/themes';
import { WidgetRenderer } from '../viewer/WidgetRenderer';
import { FiltersPanel, partitionFilterWidgets } from '../viewer/FiltersPanel';
import type { FilterState } from '../shared/types';

export function GridEditor() {
  const dashboard = useStudioStore((s) => s.dashboard);
  const datasets = useStudioStore((s) => s.datasets);
  const previewMode = useStudioStore((s) => s.previewMode);
  const viewportMode = useStudioStore((s) => s.viewportMode);
  const updateLayouts = useStudioStore((s) => s.updateLayouts);
  const removeWidget = useStudioStore((s) => s.removeWidget);
  const updateWidget = useStudioStore((s) => s.updateWidget);
  const setFiltersPanelCollapsed = useStudioStore((s) => s.setFiltersPanelCollapsed);
  const setLastError = useStudioStore((s) => s.setLastError);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({});
  const [width, setWidth] = useState(900);
  const [copyFlash, setCopyFlash] = useState<string | null>(null);

  const tab = dashboard.tabs.find((t) => t.id === dashboard.activeTabId);
  const theme = getTheme(dashboard.themeId);
  const showFiltersPanel = !!dashboard.showFiltersPanel;
  /** In preview (and when panel on): filters live in the rail; hide duplicates on grid. */
  const panelActive = showFiltersPanel;
  const hideFiltersOnGrid = panelActive && previewMode;

  useEffect(() => {
    const el = document.getElementById('grid-host');
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, [panelActive, dashboard.filtersPanelCollapsed]);

  useEffect(() => {
    setFilters({});
  }, [dashboard.activeTabId]);

  useEffect(() => {
    const id = window.setTimeout(() => window.dispatchEvent(new Event('resize')), 80);
    return () => window.clearTimeout(id);
  }, [panelActive, dashboard.filtersPanelCollapsed, width, previewMode]);

  const gridWidgets = useMemo(() => {
    if (!tab) return [];
    if (hideFiltersOnGrid) return partitionFilterWidgets(tab.widgets).rest;
    return tab.widgets;
  }, [tab, hideFiltersOnGrid]);

  const layout: Layout = useMemo(
    () =>
      gridWidgets.map((w) => ({
        i: w.id,
        x: w.layout.x,
        y: w.layout.y,
        w: w.layout.w,
        h: w.layout.h,
        static: previewMode,
      })),
    [gridWidgets, previewMode],
  );

  const copyWidget = async (widgetId: string) => {
    const w = tab?.widgets.find((x) => x.id === widgetId);
    if (!w) return;
    const payload = {
      id: `copy-${w.type}`,
      type: w.type,
      title: w.title,
      description: `Копия: ${w.title}`,
      defaultBinding: { ...w.binding, datasetId: undefined },
      defaultLayout: { w: w.layout.w, h: w.layout.h },
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopyFlash(widgetId);
      window.setTimeout(() => setCopyFlash(null), 1200);
    } catch {
      setLastError('Не удалось скопировать в буфер обмена');
    }
  };

  if (!tab) return null;

  const frameClass =
    viewportMode === '1024x768' ? 'viewport-frame viewport-1024' : 'viewport-frame fluid';

  return (
    <div className="grid-wrap">
      <div className="viewport-scroll">
        <div className={frameClass}>
          <div className="dashboard-with-filters studio-canvas">
            {panelActive && (
              <FiltersPanel
                widgets={tab.widgets}
                tabWidgets={tab.widgets}
                datasets={datasets}
                filters={filters}
                onFilterChange={(id, value) => setFilters((p) => ({ ...p, [id]: value }))}
                theme={theme}
                collapsed={!!dashboard.filtersPanelCollapsed}
                onCollapsedChange={setFiltersPanelCollapsed}
                selectedId={selectedId}
                onSelectWidget={setSelectedId}
                onClearAll={() => setFilters({})}
              />
            )}
            <div
              id="grid-host"
              className={`grid-host dashboard-main${!previewMode ? ' show-grid' : ''}`}
              style={{
                background: theme.background,
                color: theme.text,
                fontFamily: theme.fontFamily,
              }}
            >
              <GridLayout
                className="layout"
                layout={layout}
                cols={12}
                rowHeight={48}
                width={Math.max(width, 320)}
                isDraggable={!previewMode}
                isResizable={!previewMode}
                onLayoutChange={(l) => {
                  if (!previewMode) {
                    updateLayouts(
                      l.map((item) => ({
                        i: item.i,
                        x: item.x,
                        y: item.y,
                        w: item.w,
                        h: item.h,
                      })),
                    );
                  }
                  requestAnimationFrame(() => {
                    window.dispatchEvent(new Event('resize'));
                  });
                }}
                margin={[12, 12]}
                compactType="vertical"
              >
                {gridWidgets.map((w) => (
                  <div
                    key={w.id}
                    className={`widget-shell ${selectedId === w.id ? 'selected' : ''}`}
                    onClick={() => setSelectedId(w.id)}
                  >
                    {!previewMode && (
                      <div className="widget-chrome">
                        <span>{w.title}</span>
                        <div className="widget-chrome-actions">
                          <button
                            type="button"
                            className="icon-btn"
                            title="Скопировать в буфер"
                            aria-label="Скопировать в буфер"
                            onClick={(e) => {
                              e.stopPropagation();
                              void copyWidget(w.id);
                            }}
                          >
                            {copyFlash === w.id ? (
                              <span className="copy-ok">✓</span>
                            ) : (
                              <svg
                                viewBox="0 0 24 24"
                                width="14"
                                height="14"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                              >
                                <rect x="9" y="9" width="13" height="13" rx="2" />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                              </svg>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeWidget(w.id);
                            }}
                            aria-label="Удалить"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="widget-body">
                      <WidgetRenderer
                        widget={w}
                        tabWidgets={tab.widgets}
                        datasets={datasets}
                        filters={filters}
                        onFilterChange={(id, value) => setFilters((p) => ({ ...p, [id]: value }))}
                        theme={theme}
                        interactive={previewMode || isFilterType(w.type)}
                      />
                    </div>
                  </div>
                ))}
              </GridLayout>
              {!tab.widgets.length && (
                <div className="empty-grid">
                  Нажмите «Добавить виджет…» на панели сверху
                </div>
              )}
            </div>
          </div>
          {viewportMode === '1024x768' && (
            <div className="viewport-badge">1024×768</div>
          )}
        </div>
      </div>

      {!previewMode && selectedId && (
        <PropertiesInline
          widgetId={selectedId}
          onClose={() => setSelectedId(null)}
          updateWidget={updateWidget}
        />
      )}
    </div>
  );
}

function isFilterType(type: string): boolean {
  return type === 'filter-select' || type === 'filter-date' || type === 'filter-chips';
}

function PropertiesInline({
  widgetId,
  onClose,
  updateWidget,
}: {
  widgetId: string;
  onClose: () => void;
  updateWidget: (
    id: string,
    patch: Parameters<ReturnType<typeof useStudioStore.getState>['updateWidget']>[1],
  ) => void;
}) {
  const widget = useStudioStore((s) =>
    s.dashboard.tabs.flatMap((t) => t.widgets).find((w) => w.id === widgetId),
  );
  const datasets = useStudioStore((s) => s.datasets);
  if (!widget) return null;
  const ds = datasets.find((d) => d.id === widget.binding.datasetId);
  const cols = ds?.columns || [];

  return (
    <aside className="panel props">
      <div className="props-head">
        <h2>Свойства</h2>
        <button type="button" className="btn ghost" onClick={onClose}>
          Закрыть
        </button>
      </div>
      <label>
        Заголовок
        <input
          value={widget.title}
          onChange={(e) => updateWidget(widget.id, { title: e.target.value })}
        />
      </label>
      <label>
        Датасет
        <select
          value={widget.binding.datasetId || ''}
          onChange={(e) => updateWidget(widget.id, { binding: { datasetId: e.target.value } })}
        >
          <option value="">—</option>
          {datasets.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </label>
      {[
        'kpi',
        'kpi-delta',
        'bar',
        'stacked-bar',
        'hbar',
        'line',
        'area',
        'combo',
        'pie',
        'donut',
        'waterfall',
        'top-list',
      ].includes(widget.type) && (
        <>
          {!['kpi', 'kpi-delta'].includes(widget.type) && (
            <label>
              Категория
              <select
                value={widget.binding.categoryColumn || ''}
                onChange={(e) =>
                  updateWidget(widget.id, { binding: { categoryColumn: e.target.value } })
                }
              >
                <option value="">—</option>
                {cols.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Значение
            <select
              value={widget.binding.valueColumn || ''}
              onChange={(e) =>
                updateWidget(widget.id, { binding: { valueColumn: e.target.value } })
              }
            >
              <option value="">—</option>
              {cols.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      {(widget.type === 'kpi-delta' || widget.type === 'combo' || widget.type === 'waterfall') && (
        <label>
          {widget.type === 'combo' ? 'Линия (план)' : 'Сравнение / база'}
          <select
            value={
              widget.type === 'combo'
                ? widget.binding.lineColumn || widget.binding.compareColumn || ''
                : widget.binding.compareColumn || ''
            }
            onChange={(e) =>
              updateWidget(widget.id, {
                binding:
                  widget.type === 'combo'
                    ? { lineColumn: e.target.value }
                    : { compareColumn: e.target.value },
              })
            }
          >
            <option value="">—</option>
            {cols.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      )}
      {widget.type === 'stacked-bar' && (
        <label>
          Серии (колонки через запятую)
          <input
            value={(widget.binding.seriesColumns || []).join(', ')}
            onChange={(e) =>
              updateWidget(widget.id, {
                binding: {
                  seriesColumns: e.target.value
                    .split(',')
                    .map((x) => x.trim())
                    .filter(Boolean),
                },
              })
            }
          />
        </label>
      )}
      {(widget.type === 'top-list' || widget.type === 'hbar') && (
        <label>
          Макс. пунктов
          <input
            type="number"
            min={3}
            max={30}
            value={widget.binding.maxItems || (widget.type === 'top-list' ? 5 : 12)}
            onChange={(e) =>
              updateWidget(widget.id, {
                binding: { maxItems: Number(e.target.value) || 5 },
              })
            }
          />
        </label>
      )}
      {widget.type === 'matrix' && (
        <>
          <label>
            Строки
            <select
              value={widget.binding.rowColumn || ''}
              onChange={(e) =>
                updateWidget(widget.id, { binding: { rowColumn: e.target.value } })
              }
            >
              <option value="">—</option>
              {cols.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label>
            Колонки
            <select
              value={widget.binding.colColumn || ''}
              onChange={(e) =>
                updateWidget(widget.id, { binding: { colColumn: e.target.value } })
              }
            >
              <option value="">—</option>
              {cols.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label>
            Значение
            <select
              value={widget.binding.valueColumn || ''}
              onChange={(e) =>
                updateWidget(widget.id, { binding: { valueColumn: e.target.value } })
              }
            >
              <option value="">—</option>
              {cols.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="field-inline">
            <input
              type="checkbox"
              checked={!!widget.binding.showTotals}
              onChange={(e) =>
                updateWidget(widget.id, { binding: { showTotals: e.target.checked } })
              }
            />
            Показывать итоги
          </label>
        </>
      )}
      {(widget.type === 'filter-select' ||
        widget.type === 'filter-date' ||
        widget.type === 'filter-chips') && (
        <label>
          Колонка фильтра
          <select
            value={widget.binding.filterColumn || ''}
            onChange={(e) =>
              updateWidget(widget.id, { binding: { filterColumn: e.target.value } })
            }
          >
            <option value="">—</option>
            {cols.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      )}
      {widget.type === 'table' && (
        <label>
          Колонки (через запятую)
          <input
            value={(widget.binding.columns || []).join(', ')}
            onChange={(e) =>
              updateWidget(widget.id, {
                binding: {
                  columns: e.target.value
                    .split(',')
                    .map((x) => x.trim())
                    .filter(Boolean),
                },
              })
            }
          />
        </label>
      )}
    </aside>
  );
}

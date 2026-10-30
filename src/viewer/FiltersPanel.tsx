import { useMemo, useState, type CSSProperties } from 'react';
import { isFilterWidget } from '../shared/blocks';
import {
  formatWeekLabel,
  listDateColumns,
  uniqueColumnValues,
  uniqueWeeks,
  weekBounds,
} from '../shared/filter';
import type {
  Dataset,
  FilterState,
  PanelFilterConfig,
  ThemeConfig,
  WidgetInstance,
} from '../shared/types';
import './filters-panel.css';

interface Props {
  panelFilters: PanelFilterConfig[];
  datasets: Dataset[];
  filters: FilterState;
  onFilterChange: (filterId: string, value: FilterState[string]) => void;
  theme: ThemeConfig;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  onClearAll?: () => void;
  /** Studio: remove a panel filter field */
  onRemoveFilter?: (filterId: string) => void;
  /** Studio: change date column when multiple date cols exist */
  onUpdateFilter?: (filterId: string, patch: Partial<PanelFilterConfig>) => void;
  /** Studio: open add-fields UI */
  onAddFields?: () => void;
  editable?: boolean;
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`fp-chevron${open ? ' open' : ''}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function WeekScrubber({
  weeks,
  value,
  onChange,
  disabled,
}: {
  weeks: string[];
  value?: string;
  onChange: (weekKey: string | undefined) => void;
  disabled?: boolean;
}) {
  const idx = value ? weeks.indexOf(value) : -1;
  const current = idx >= 0 ? weeks[idx] : weeks[weeks.length - 1];
  const prev = idx > 0 ? weeks[idx - 1] : weeks.length > 1 && idx < 0 ? weeks[weeks.length - 2] : null;

  if (!weeks.length) {
    return <p className="fp-hint">Нет дат в колонке</p>;
  }

  const go = (i: number) => {
    if (i < 0 || i >= weeks.length) return;
    onChange(weeks[i]);
  };

  const activeIdx = idx >= 0 ? idx : weeks.length - 1;

  return (
    <div className="selector-block">
      <span className="selector-title">Неделя</span>
      <div className="selector-row">
        <button
          type="button"
          className="wk-nav-btn"
          disabled={disabled || activeIdx <= 0}
          title="Первая"
          onClick={() => go(0)}
        >
          «
        </button>
        <button
          type="button"
          className="wk-nav-btn"
          disabled={disabled || activeIdx <= 0}
          title="Предыдущая"
          onClick={() => go(activeIdx - 1)}
        >
          ‹
        </button>
        {prev && <span className="prev">{formatWeekLabel(prev)}</span>}
        {prev && <span className="arrow">→</span>}
        <select
          className="wk-select"
          disabled={disabled}
          value={current || ''}
          onChange={(e) => onChange(e.target.value || undefined)}
          title="Выбор недели"
        >
          {weeks.map((w) => (
            <option key={w} value={w}>
              {formatWeekLabel(w)}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="wk-nav-btn"
          disabled={disabled || activeIdx >= weeks.length - 1}
          title="Следующая"
          onClick={() => go(activeIdx + 1)}
        >
          ›
        </button>
        <button
          type="button"
          className="wk-nav-btn"
          disabled={disabled || activeIdx >= weeks.length - 1}
          title="Последняя"
          onClick={() => go(weeks.length - 1)}
        >
          »
        </button>
      </div>
      <button
        type="button"
        className="fp-link-btn"
        disabled={disabled || !value}
        onClick={() => onChange(undefined)}
      >
        Все недели
      </button>
    </div>
  );
}

function SelectFilterBody({
  options,
  selected,
  onChange,
  disabled,
}: {
  options: string[];
  selected: string[];
  onChange: (next: string[] | undefined) => void;
  disabled?: boolean;
}) {
  const set = new Set(selected);
  const toggle = (opt: string) => {
    if (disabled) return;
    const next = new Set(set);
    if (next.has(opt)) next.delete(opt);
    else next.add(opt);
    onChange(next.size ? Array.from(next) : undefined);
  };
  return (
    <div className="fp-options">
      {options.map((o) => {
        const on = set.has(o);
        return (
          <label key={o} className={`fp-option${on ? ' on' : ''}`}>
            <input
              type="checkbox"
              checked={on}
              disabled={disabled}
              onChange={() => toggle(o)}
            />
            <span>{o}</span>
          </label>
        );
      })}
      {!options.length && <span className="fp-hint">Нет значений</span>}
    </div>
  );
}

function DateFilterBody({
  filter,
  dataset,
  value,
  onChange,
  onUpdateFilter,
  editable,
}: {
  filter: PanelFilterConfig;
  dataset: Dataset | undefined;
  value: { from?: string; to?: string; week?: string } | undefined;
  onChange: (v: FilterState[string]) => void;
  onUpdateFilter?: (filterId: string, patch: Partial<PanelFilterConfig>) => void;
  editable?: boolean;
}) {
  const dateCols = dataset ? listDateColumns(dataset) : [];
  const column = filter.column || dateCols[0] || '';
  const rows = dataset?.rows || [];
  const weeks = useMemo(() => (column ? uniqueWeeks(rows, column) : []), [rows, column]);
  const [mode, setMode] = useState<'week' | 'range'>('week');

  const setWeek = (weekKey: string | undefined) => {
    if (!weekKey) {
      onChange(undefined);
      return;
    }
    const b = weekBounds(weekKey);
    if (!b) {
      onChange(undefined);
      return;
    }
    onChange({ ...b, week: weekKey });
  };

  return (
    <div className="fp-date-body">
      {dateCols.length > 1 && (
        <label className="fp-field-label">
          Колонка даты
          <select
            value={column}
            disabled={!editable && !onUpdateFilter}
            onChange={(e) => onUpdateFilter?.(filter.id, { column: e.target.value })}
          >
            {dateCols.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="fp-mode-toggle">
        <button
          type="button"
          className={mode === 'week' ? 'active' : ''}
          onClick={() => setMode('week')}
        >
          Недели
        </button>
        <button
          type="button"
          className={mode === 'range' ? 'active' : ''}
          onClick={() => setMode('range')}
        >
          Календарь
        </button>
      </div>
      {mode === 'week' ? (
        <WeekScrubber
          weeks={weeks}
          value={value?.week}
          onChange={setWeek}
        />
      ) : (
        <div className="fp-date-range">
          <input
            type="date"
            value={value?.from || ''}
            onChange={(e) =>
              onChange({
                from: e.target.value || undefined,
                to: value?.to,
              })
            }
          />
          <span className="arrow">—</span>
          <input
            type="date"
            value={value?.to || ''}
            onChange={(e) =>
              onChange({
                from: value?.from,
                to: e.target.value || undefined,
              })
            }
          />
        </div>
      )}
    </div>
  );
}

export function FiltersPanel({
  panelFilters,
  datasets,
  filters,
  onFilterChange,
  theme,
  collapsed: collapsedProp,
  onCollapsedChange,
  onClearAll,
  onRemoveFilter,
  onUpdateFilter,
  onAddFields,
  editable,
}: Props) {
  const [localCollapsed, setLocalCollapsed] = useState(false);
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});
  const collapsed = collapsedProp ?? localCollapsed;
  const setCollapsed = (v: boolean) => {
    onCollapsedChange?.(v);
    if (collapsedProp === undefined) setLocalCollapsed(v);
  };

  const activeChips = useMemo(() => {
    const chips: { id: string; label: string; text: string }[] = [];
    for (const f of panelFilters) {
      const v = filters[f.id];
      if (v === undefined || v === '' || v === null) continue;
      const label = f.label || f.column;
      if (Array.isArray(v)) {
        if (!v.length) continue;
        chips.push({ id: f.id, label, text: v.join(', ') });
      } else if (typeof v === 'object' && v && ('from' in v || 'to' in v || 'week' in v)) {
        const range = v as { from?: string; to?: string; week?: string };
        if (range.week) {
          chips.push({ id: f.id, label, text: formatWeekLabel(range.week) });
        } else if (range.from || range.to) {
          chips.push({
            id: f.id,
            label,
            text: `${range.from || '…'} — ${range.to || '…'}`,
          });
        }
      } else {
        chips.push({ id: f.id, label, text: String(v) });
      }
    }
    return chips;
  }, [panelFilters, filters]);

  const toggleOpen = (id: string) =>
    setOpenIds((p) => ({ ...p, [id]: !(p[id] ?? true) }));

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

          {!panelFilters.length && (
            <p className="filters-empty">
              {editable
                ? 'Нажмите «Добавить фильтр…» и отметьте поля датасета — они появятся в этой панели.'
                : 'Фильтры панели не заданы.'}
            </p>
          )}

          {panelFilters.map((f) => {
            const ds = datasets.find((d) => d.id === f.datasetId) || datasets[0];
            const open = openIds[f.id] ?? true;
            const v = filters[f.id];
            const active =
              v !== undefined &&
              v !== '' &&
              !(Array.isArray(v) && !v.length) &&
              !(typeof v === 'object' && v && !('week' in v && (v as { week?: string }).week) && !(v as { from?: string }).from && !(v as { to?: string }).to);
            const label = f.label || f.column;
            let summary = 'Все';
            if (Array.isArray(v) && v.length) summary = String(v.length);
            else if (typeof v === 'object' && v && (v as { week?: string }).week)
              summary = formatWeekLabel((v as { week: string }).week);
            else if (typeof v === 'object' && v && ((v as { from?: string }).from || (v as { to?: string }).to))
              summary = 'Период';
            else if (typeof v === 'string' && v) summary = v;

            return (
              <div
                key={f.id}
                className={`filter-group${open ? ' open' : ''}${active ? ' active-filter' : ''}`}
              >
                <div
                  className={`filter-header${active ? ' active-filter' : ''}`}
                  onClick={() => toggleOpen(f.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleOpen(f.id);
                    }
                  }}
                >
                  <span className="filter-title">{label}</span>
                  <span className="filter-summary">{summary}</span>
                  {editable && onRemoveFilter && (
                    <button
                      type="button"
                      className="reset-single"
                      title="Убрать из панели"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveFilter(f.id);
                      }}
                    >
                      ×
                    </button>
                  )}
                  <Chevron open={open} />
                </div>
                {open && (
                  <div className="filter-body">
                    {f.kind === 'date' ||
                    f.kind === 'stepper' ||
                    f.kind === 'double_stepper' ? (
                      <DateFilterBody
                        filter={f}
                        dataset={ds}
                        value={
                          typeof v === 'object' && v && !Array.isArray(v)
                            ? (v as { from?: string; to?: string; week?: string })
                            : undefined
                        }
                        onChange={(nv) => onFilterChange(f.id, nv)}
                        onUpdateFilter={onUpdateFilter}
                        editable={editable}
                      />
                    ) : f.kind === 'dropdown' || f.kind === 'toggle' ? (
                      <select
                        value={typeof v === 'string' ? v : ''}
                        onChange={(e) =>
                          onFilterChange(
                            f.id,
                            e.target.value ? e.target.value : undefined,
                          )
                        }
                      >
                        <option value="">Все</option>
                        {(ds && f.column
                          ? uniqueColumnValues(ds.rows, f.column)
                          : []
                        ).map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    ) : f.kind === 'slider_double' ? (
                      <div className="fp-date-range">
                        <input
                          type="number"
                          placeholder="от"
                          value={
                            typeof v === 'object' && v && !Array.isArray(v)
                              ? String((v as { min?: number }).min ?? '')
                              : ''
                          }
                          onChange={(e) => {
                            const min = e.target.value === '' ? undefined : Number(e.target.value);
                            const max =
                              typeof v === 'object' && v && !Array.isArray(v)
                                ? (v as { max?: number }).max
                                : undefined;
                            onFilterChange(
                              f.id,
                              min == null && max == null ? undefined : { min, max },
                            );
                          }}
                        />
                        <span className="arrow">—</span>
                        <input
                          type="number"
                          placeholder="до"
                          value={
                            typeof v === 'object' && v && !Array.isArray(v)
                              ? String((v as { max?: number }).max ?? '')
                              : ''
                          }
                          onChange={(e) => {
                            const max = e.target.value === '' ? undefined : Number(e.target.value);
                            const min =
                              typeof v === 'object' && v && !Array.isArray(v)
                                ? (v as { min?: number }).min
                                : undefined;
                            onFilterChange(
                              f.id,
                              min == null && max == null ? undefined : { min, max },
                            );
                          }}
                        />
                      </div>
                    ) : (
                      <SelectFilterBody
                        options={
                          ds && f.column
                            ? uniqueColumnValues(ds.rows, f.column)
                            : []
                        }
                        selected={
                          Array.isArray(v)
                            ? (v as string[])
                            : v
                              ? [String(v)]
                              : []
                        }
                        onChange={(next) => onFilterChange(f.id, next)}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {editable && onAddFields && (
            <button type="button" className="fp-add-btn" onClick={onAddFields}>
              + Поля…
            </button>
          )}
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

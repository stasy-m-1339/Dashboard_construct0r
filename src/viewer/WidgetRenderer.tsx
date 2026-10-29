import type { CSSProperties, ReactNode } from 'react';
import type {
  Dataset,
  FilterState,
  ThemeConfig,
  WidgetInstance,
  WidgetTone,
} from '../shared/types';
import {
  aggregateNumeric,
  filterDatasetRows,
  formatValue,
  groupMultiSum,
  groupSum,
  pivotSum,
  topN,
  uniqueColumnValues,
} from '../shared/filter';
import { ChartHost } from './ChartHost';

interface Props {
  widget: WidgetInstance;
  tabWidgets: WidgetInstance[];
  datasets: Dataset[];
  filters: FilterState;
  onFilterChange: (widgetId: string, value: FilterState[string]) => void;
  theme: ThemeConfig;
  interactive?: boolean;
}

function toneAccent(theme: ThemeConfig, tone?: WidgetTone): string {
  if (tone === 'plan') return '#bbac9b';
  if (tone === 'insight') return theme.accent;
  return theme.accent;
}

function cardStyleFor(theme: ThemeConfig, tone?: WidgetTone): CSSProperties {
  const radius = theme.radius ?? 10;
  const bw = theme.borderWidth ?? 1;
  const shadow = theme.shadow ?? '0 1px 2px rgba(45, 42, 42, 0.04)';
  const headerBar = theme.headerBg;
  const topBw = Math.max(bw, tone === 'fact' || tone === 'plan' || headerBar ? 3 : bw);
  const topColor =
    tone === 'fact'
      ? theme.accent
      : tone === 'plan'
        ? '#bbac9b'
        : headerBar || theme.border;
  return {
    background: theme.surface,
    border: `${bw}px solid ${theme.border}`,
    borderTop: `${topBw}px solid ${topColor}`,
    borderRadius: radius,
    color: theme.text,
    height: '100%',
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box',
    overflow: 'hidden',
    boxShadow: shadow === 'none' ? 'none' : shadow,
    fontFamily: theme.fontFamily,
  };
}

export function WidgetRenderer({
  widget,
  tabWidgets,
  datasets,
  filters,
  onFilterChange,
  theme,
  interactive = true,
}: Props) {
  const dataset = datasets.find((d) => d.id === widget.binding.datasetId);
  const rows = filterDatasetRows(dataset, tabWidgets, filters, datasets);
  const cardStyle = cardStyleFor(theme, widget.binding.tone);
  const accent = toneAccent(theme, widget.binding.tone);
  const wine = '#b26164';

  const titleRow = (extra?: ReactNode) => (
    <div
      style={{
        fontSize: 12,
        fontWeight: 600,
        marginBottom: 6,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
        color: theme.text,
      }}
    >
      <span>{widget.title}</span>
      {widget.binding.badge && (
        <span
          style={{
            fontSize: 10,
            padding: '1px 6px',
            borderRadius: 10,
            background: '#F3F1F0',
            color: theme.muted,
            fontWeight: 500,
          }}
        >
          {widget.binding.badge}
        </span>
      )}
      {extra}
    </div>
  );

  if (widget.type === 'filter-select') {
    const col = widget.binding.filterColumn || '';
    const options = dataset ? uniqueColumnValues(dataset.rows, col) : [];
    const value = (filters[widget.id] as string) || '';
    return (
      <div className="widget-card" style={cardStyle}>
        <label style={{ fontSize: 12, color: theme.muted, marginBottom: 8 }}>
          {widget.binding.label || widget.title}
        </label>
        <select
          disabled={!interactive}
          value={value}
          onChange={(e) => onFilterChange(widget.id, e.target.value || undefined)}
          style={{
            background: '#fff',
            color: theme.text,
            border: `1px solid ${theme.border}`,
            borderRadius: 8,
            padding: '8px 10px',
            fontSize: 13,
          }}
        >
          <option value="">Все</option>
          {options.map((o) => (
            <option key={o} value={o} style={{ color: theme.text }}>
              {o}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (widget.type === 'filter-chips') {
    const col = widget.binding.filterColumn || '';
    const options = dataset ? uniqueColumnValues(dataset.rows, col) : [];
    const selected = new Set(
      Array.isArray(filters[widget.id])
        ? (filters[widget.id] as string[])
        : filters[widget.id]
          ? [String(filters[widget.id])]
          : [],
    );
    const toggle = (opt: string) => {
      if (!interactive) return;
      const next = new Set(selected);
      if (next.has(opt)) next.delete(opt);
      else next.add(opt);
      onFilterChange(widget.id, next.size ? Array.from(next) : undefined);
    };
    return (
      <div className="widget-card" style={cardStyle}>
        {titleRow()}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, overflow: 'auto' }}>
          {options.map((o) => {
            const on = selected.has(o);
            return (
              <button
                key={o}
                type="button"
                disabled={!interactive}
                onClick={() => toggle(o)}
                style={{
                  border: `1px solid ${on ? accent : theme.border}`,
                  background: on ? 'rgba(2,102,94,0.12)' : '#F3F1F0',
                  color: on ? accent : theme.text,
                  borderRadius: 999,
                  padding: '4px 10px',
                  fontSize: 12,
                  cursor: interactive ? 'pointer' : 'default',
                }}
              >
                {o}
                {on ? ' ×' : ''}
              </button>
            );
          })}
          {!options.length && <span style={{ color: theme.muted, fontSize: 12 }}>Нет значений</span>}
        </div>
      </div>
    );
  }

  if (widget.type === 'filter-date') {
    const range = (filters[widget.id] as { from?: string; to?: string }) || {};
    return (
      <div className="widget-card" style={cardStyle}>
        <div style={{ fontSize: 12, color: theme.muted, marginBottom: 8 }}>
          {widget.binding.label || widget.title}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            type="date"
            disabled={!interactive}
            value={range.from || ''}
            onChange={(e) =>
              onFilterChange(widget.id, { ...range, from: e.target.value || undefined })
            }
            style={{
              background: '#fff',
              color: theme.text,
              border: `1px solid ${theme.border}`,
              borderRadius: 8,
              padding: '6px 8px',
            }}
          />
          <input
            type="date"
            disabled={!interactive}
            value={range.to || ''}
            onChange={(e) =>
              onFilterChange(widget.id, { ...range, to: e.target.value || undefined })
            }
            style={{
              background: '#fff',
              color: theme.text,
              border: `1px solid ${theme.border}`,
              borderRadius: 8,
              padding: '6px 8px',
            }}
          />
        </div>
      </div>
    );
  }

  if (widget.type === 'kpi') {
    const col = widget.binding.valueColumn || '';
    const total = aggregateNumeric(rows, col);
    return (
      <div className="widget-card" style={cardStyle}>
        <div style={{ fontSize: 12, color: theme.muted }}>
          {widget.binding.label || widget.title}
        </div>
        <div
          style={{
            fontSize: 32,
            fontWeight: 700,
            marginTop: 'auto',
            color: accent,
            letterSpacing: '-0.02em',
          }}
        >
          {formatValue(total, widget.binding.format)}
        </div>
      </div>
    );
  }

  if (widget.type === 'kpi-delta') {
    const valueCol = widget.binding.valueColumn || '';
    const compareCol = widget.binding.compareColumn || '';
    const actual = aggregateNumeric(rows, valueCol);
    const base = compareCol ? aggregateNumeric(rows, compareCol) : 0;
    const delta = actual - base;
    const pct = base !== 0 ? delta / Math.abs(base) : 0;
    const pos = delta >= 0;
    return (
      <div className="widget-card" style={cardStyle}>
        {titleRow(
          <span style={{ fontSize: 11, color: theme.muted, marginLeft: 'auto' }}>
            {widget.binding.label}
          </span>,
        )}
        <div
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: accent,
            letterSpacing: '-0.02em',
            marginTop: 4,
          }}
        >
          {formatValue(actual, widget.binding.format)}
        </div>
        {compareCol && (
          <div
            style={{
              marginTop: 'auto',
              fontSize: 12,
              color: pos ? accent : wine,
              display: 'flex',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <span>
              Δ {pos ? '+' : ''}
              {formatValue(delta, widget.binding.format)}
            </span>
            <span style={{ color: theme.muted }}>
              {pos ? '+' : ''}
              {(pct * 100).toLocaleString('ru-RU', { maximumFractionDigits: 1 })}%
            </span>
            <span style={{ color: theme.muted }}>
              vs {formatValue(base, widget.binding.format)}
            </span>
          </div>
        )}
      </div>
    );
  }

  if (widget.type === 'top-list') {
    const cat = widget.binding.categoryColumn || '';
    const val = widget.binding.valueColumn || '';
    const maxItems = widget.binding.maxItems || 5;
    const series = topN(groupSum(rows, cat, val), maxItems);
    const scale = Math.max(...series.map((s) => Math.abs(s.value)), 1);
    return (
      <div className="widget-card" style={cardStyle}>
        {titleRow()}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, overflow: 'auto', flex: 1 }}>
          {series.map((s, i) => (
            <div
              key={s.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 11,
                minWidth: 0,
              }}
            >
              <span
                style={{
                  width: 17,
                  height: 17,
                  borderRadius: '50%',
                  background: '#F3F1F0',
                  color: theme.muted,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  fontWeight: 600,
                  flex: '0 0 auto',
                }}
              >
                {i + 1}
              </span>
              <span
                style={{
                  flex: 1,
                  minWidth: 48,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={s.name}
              >
                {s.name}
              </span>
              <span
                style={{
                  flex: '0 1 100px',
                  height: 12,
                  background: '#F3F1F0',
                  borderRadius: 3,
                  overflow: 'hidden',
                }}
              >
                <span
                  style={{
                    display: 'block',
                    height: '100%',
                    width: `${Math.min(100, (Math.abs(s.value) / scale) * 100)}%`,
                    background: s.value < 0 ? wine : accent,
                    opacity: 0.85,
                  }}
                />
              </span>
              <span
                style={{
                  flex: '0 0 auto',
                  minWidth: 64,
                  textAlign: 'right',
                  fontVariantNumeric: 'tabular-nums',
                  color: s.value < 0 ? wine : theme.text,
                }}
              >
                {formatValue(s.value, widget.binding.format)}
              </span>
            </div>
          ))}
          {!series.length && <div style={{ color: theme.muted }}>Нет данных</div>}
        </div>
      </div>
    );
  }

  if (widget.type === 'matrix') {
    const rowCol = widget.binding.rowColumn || '';
    const colCol = widget.binding.colColumn || '';
    const valCol = widget.binding.valueColumn || '';
    const pivot = pivotSum(rows, rowCol, colCol, valCol);
    const showTotals = !!widget.binding.showTotals;
    const rowTotals = Object.fromEntries(
      pivot.rows.map((r) => [
        r,
        pivot.cols.reduce((s, c) => s + (pivot.cells[r]?.[c] ?? 0), 0),
      ]),
    );
    const colTotals = Object.fromEntries(
      pivot.cols.map((c) => [
        c,
        pivot.rows.reduce((s, r) => s + (pivot.cells[r]?.[c] ?? 0), 0),
      ]),
    );
    const grand = Object.values(rowTotals).reduce((a, b) => a + b, 0);
    const cell = (v: number, strong = false) => {
      const bg =
        v > 0 ? 'rgba(2,102,94,0.12)' : v < 0 ? 'rgba(178,97,100,0.12)' : 'transparent';
      return {
        padding: '4px 6px',
        borderBottom: `1px solid ${theme.border}`,
        textAlign: 'right' as const,
        background: bg,
        color: v < 0 ? wine : theme.text,
        fontWeight: strong ? 650 : 400,
      };
    };
    return (
      <div className="widget-card" style={cardStyle}>
        {titleRow()}
        <div style={{ overflow: 'auto', flex: 1 }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 11,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <thead>
              <tr>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '4px 6px',
                    borderBottom: `1px solid ${theme.border}`,
                    color: theme.muted,
                    position: 'sticky',
                    left: 0,
                    background: theme.surface,
                  }}
                />
                {pivot.cols.map((c) => (
                  <th
                    key={c}
                    style={{
                      textAlign: 'right',
                      padding: '4px 6px',
                      borderBottom: `1px solid ${theme.border}`,
                      color: theme.muted,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {c}
                  </th>
                ))}
                {showTotals && (
                  <th
                    style={{
                      textAlign: 'right',
                      padding: '4px 6px',
                      borderBottom: `1px solid ${theme.border}`,
                      color: theme.accent,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Итого
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {pivot.rows.map((r) => (
                <tr key={r}>
                  <td
                    style={{
                      padding: '4px 6px',
                      borderBottom: `1px solid ${theme.border}`,
                      position: 'sticky',
                      left: 0,
                      background: theme.surface,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {r}
                  </td>
                  {pivot.cols.map((c) => {
                    const v = pivot.cells[r]?.[c] ?? 0;
                    return (
                      <td key={c} style={cell(v)}>
                        {v === 0 ? '—' : formatValue(v, widget.binding.format)}
                      </td>
                    );
                  })}
                  {showTotals && (
                    <td style={cell(rowTotals[r] || 0, true)}>
                      {formatValue(rowTotals[r] || 0, widget.binding.format)}
                    </td>
                  )}
                </tr>
              ))}
              {showTotals && pivot.rows.length > 0 && (
                <tr>
                  <td
                    style={{
                      padding: '4px 6px',
                      borderTop: `2px solid ${theme.border}`,
                      position: 'sticky',
                      left: 0,
                      background: theme.surface,
                      fontWeight: 650,
                      color: theme.accent,
                    }}
                  >
                    Итого
                  </td>
                  {pivot.cols.map((c) => (
                    <td key={c} style={{ ...cell(colTotals[c] || 0, true), borderTop: `2px solid ${theme.border}` }}>
                      {formatValue(colTotals[c] || 0, widget.binding.format)}
                    </td>
                  ))}
                  <td style={{ ...cell(grand, true), borderTop: `2px solid ${theme.border}` }}>
                    {formatValue(grand, widget.binding.format)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {!pivot.rows.length && <div style={{ color: theme.muted, padding: 8 }}>Нет данных</div>}
        </div>
      </div>
    );
  }

  if (widget.type === 'table') {
    const cols =
      widget.binding.columns?.length && widget.binding.columns.some(Boolean)
        ? widget.binding.columns
        : dataset?.columns || [];
    const compact = widget.binding.tone === 'fact' || widget.binding.tone === 'plan';
    return (
      <div className="widget-card" style={cardStyle}>
        {titleRow()}
        <div style={{ overflow: 'auto', flex: 1 }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: compact ? 11 : 12,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <thead>
              <tr>
                {cols.map((c) => (
                  <th
                    key={c}
                    style={{
                      textAlign: 'left',
                      padding: compact ? '4px 6px' : '6px 8px',
                      borderBottom: `1px solid ${theme.border}`,
                      color: theme.muted,
                      position: 'sticky',
                      top: 0,
                      background: theme.surface,
                      fontWeight: 600,
                    }}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 200).map((row, i) => (
                <tr key={i} style={{ background: i % 2 ? '#F8F6F5' : 'transparent' }}>
                  {cols.map((c) => {
                    const raw = row[c];
                    const num = typeof raw === 'number' ? raw : Number(raw);
                    const isNum = raw !== '' && raw != null && !Number.isNaN(num);
                    return (
                      <td
                        key={c}
                        style={{
                          padding: compact ? '3px 6px' : '5px 8px',
                          borderBottom: `1px solid ${theme.border}`,
                          textAlign: isNum ? 'right' : 'left',
                          color: isNum && num < 0 ? wine : isNum && num > 0 && compact ? accent : theme.text,
                        }}
                      >
                        {raw == null
                          ? ''
                          : isNum
                            ? formatValue(num, widget.binding.format)
                            : String(raw)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <div style={{ color: theme.muted, padding: 12 }}>Нет данных</div>}
        </div>
      </div>
    );
  }

  // —— charts (ECharts) ——
  const cat = widget.binding.categoryColumn || '';
  const val = widget.binding.valueColumn || '';
  const axisCommon = {
    axisLabel: { color: theme.muted, fontSize: 10 },
    axisLine: { lineStyle: { color: theme.border } },
    splitLine: { lineStyle: { color: 'rgba(0,0,0,0.08)' } },
  };

  let option: Record<string, unknown> = {
    color: theme.chartPalette,
    textStyle: { color: theme.text, fontFamily: theme.fontFamily, fontSize: 11 },
    tooltip: { trigger: 'axis' },
    grid: { left: 44, right: 16, top: 28, bottom: 36, containLabel: true },
  };

  if (widget.type === 'pie' || widget.type === 'donut') {
    const series = groupSum(rows, cat, val);
    option = {
      ...option,
      tooltip: { trigger: 'item' },
      series: [
        {
          type: 'pie',
          radius: widget.type === 'donut' ? ['42%', '68%'] : ['28%', '68%'],
          data: series.map((s) => ({ name: s.name, value: s.value })),
          label: { color: theme.text, fontSize: 10 },
        },
      ],
    };
  } else if (widget.type === 'hbar') {
    const series = topN(groupSum(rows, cat, val), widget.binding.maxItems || 12, true).reverse();
    option = {
      ...option,
      grid: { left: 8, right: 28, top: 8, bottom: 8, containLabel: true },
      xAxis: { type: 'value', ...axisCommon },
      yAxis: {
        type: 'category',
        data: series.map((s) => s.name),
        axisLabel: { color: theme.muted, fontSize: 10, width: 90, overflow: 'truncate' },
      },
      series: [
        {
          type: 'bar',
          data: series.map((s) => ({
            value: s.value,
            itemStyle: { color: s.value < 0 ? wine : accent },
          })),
          barMaxWidth: 14,
        },
      ],
    };
  } else if (widget.type === 'stacked-bar') {
    const seriesCols =
      widget.binding.seriesColumns?.filter(Boolean).length
        ? widget.binding.seriesColumns.filter(Boolean)
        : val
          ? [val]
          : [];
    const grouped = groupMultiSum(rows, cat, seriesCols);
    option = {
      ...option,
      legend: { top: 0, textStyle: { color: theme.muted, fontSize: 10 } },
      xAxis: {
        type: 'category',
        data: grouped.map((g) => g.name),
        axisLabel: { color: theme.muted, fontSize: 10, rotate: grouped.length > 8 ? 30 : 0 },
      },
      yAxis: { type: 'value', ...axisCommon },
      series: seriesCols.map((c) => ({
        name: c,
        type: 'bar',
        stack: 'total',
        data: grouped.map((g) => g.values[c] ?? 0),
        barMaxWidth: 28,
      })),
    };
  } else if (widget.type === 'combo') {
    const lineCol = widget.binding.lineColumn || widget.binding.compareColumn || '';
    const cols = [val, lineCol].filter(Boolean);
    const grouped = groupMultiSum(rows, cat, cols);
    option = {
      ...option,
      legend: { top: 0, textStyle: { color: theme.muted, fontSize: 10 } },
      xAxis: {
        type: 'category',
        data: grouped.map((g) => g.name),
        axisLabel: { color: theme.muted, fontSize: 10, rotate: grouped.length > 8 ? 30 : 0 },
      },
      yAxis: { type: 'value', ...axisCommon },
      series: [
        {
          name: val || 'Факт',
          type: 'bar',
          data: grouped.map((g) => g.values[val] ?? 0),
          itemStyle: { color: accent },
          barMaxWidth: 28,
        },
        ...(lineCol
          ? [
              {
                name: lineCol || 'План',
                type: 'line',
                data: grouped.map((g) => g.values[lineCol] ?? 0),
                smooth: true,
                itemStyle: { color: '#bbac9b' },
                lineStyle: { width: 2, type: 'dashed' as const },
              },
            ]
          : []),
      ],
    };
  } else if (widget.type === 'waterfall') {
    const series = groupSum(rows, cat, val);
    let run = 0;
    const helpers: (number | string)[] = [];
    const values: (number | string)[] = [];
    series.forEach((s, idx) => {
      if (idx === 0) {
        helpers.push(0);
        values.push(s.value);
        run = s.value;
      } else {
        const start = s.value >= 0 ? run : run + s.value;
        helpers.push(start);
        values.push(Math.abs(s.value));
        run += s.value;
      }
    });
    option = {
      ...option,
      xAxis: {
        type: 'category',
        data: series.map((s) => s.name),
        axisLabel: { color: theme.muted, fontSize: 10, rotate: series.length > 6 ? 30 : 0 },
      },
      yAxis: { type: 'value', ...axisCommon },
      series: [
        { type: 'bar', stack: 'wf', data: helpers, itemStyle: { color: 'transparent' }, tooltip: { show: false } },
        {
          type: 'bar',
          stack: 'wf',
          data: series.map((s, i) => ({
            value: values[i],
            itemStyle: { color: i === 0 ? accent : s.value >= 0 ? accent : wine },
          })),
          barMaxWidth: 32,
        },
      ],
    };
  } else if (widget.type === 'area' || widget.type === 'line' || widget.type === 'bar') {
    const series = groupSum(rows, cat, val);
    option = {
      ...option,
      xAxis: {
        type: 'category',
        data: series.map((s) => s.name),
        axisLabel: { color: theme.muted, fontSize: 10, rotate: series.length > 8 ? 30 : 0 },
      },
      yAxis: { type: 'value', ...axisCommon },
      series: [
        {
          type: widget.type === 'bar' ? 'bar' : 'line',
          data: series.map((s) => s.value),
          smooth: widget.type !== 'bar',
          areaStyle:
            widget.type === 'area'
              ? { opacity: 0.18, color: accent }
              : widget.type === 'line'
                ? { opacity: 0.08 }
                : undefined,
          itemStyle: { color: accent },
          lineStyle: widget.type !== 'bar' ? { width: 2, color: accent } : undefined,
          barMaxWidth: 28,
        },
      ],
    };
  }

  const hasChartData =
    widget.type === 'stacked-bar'
      ? (widget.binding.seriesColumns?.length || 0) > 0 || !!val
      : rows.length > 0;

  return (
    <div className="widget-card" style={cardStyle}>
      {titleRow()}
      <div className="chart-slot" style={{ flex: 1, minHeight: 0, width: '100%', position: 'relative' }}>
        {hasChartData ? (
          <ChartHost option={option} notMerge style={{ height: '100%', width: '100%' }} />
        ) : (
          <div style={{ color: theme.muted, padding: 12 }}>Нет данных для графика</div>
        )}
      </div>
    </div>
  );
}

import type { CSSProperties } from 'react';
import ReactECharts from 'echarts-for-react';
import type { Dataset, FilterState, ThemeConfig, WidgetInstance } from '../shared/types';
import {
  aggregateNumeric,
  filterDatasetRows,
  groupSum,
  uniqueColumnValues,
} from '../shared/filter';

interface Props {
  widget: WidgetInstance;
  tabWidgets: WidgetInstance[];
  datasets: Dataset[];
  filters: FilterState;
  onFilterChange: (widgetId: string, value: FilterState[string]) => void;
  theme: ThemeConfig;
  interactive?: boolean;
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

  const cardStyle: CSSProperties = {
    background: theme.surface,
    border: `1px solid ${theme.border}`,
    borderRadius: 12,
    color: theme.text,
    height: '100%',
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box',
    overflow: 'hidden',
    boxShadow: '0 1px 2px rgba(45, 42, 42, 0.04)',
  };

  if (widget.type === 'filter-select') {
    const col = widget.binding.filterColumn || '';
    const options = dataset ? uniqueColumnValues(dataset.rows, col) : [];
    const value = (filters[widget.id] as string) || '';
    return (
      <div style={cardStyle}>
        <label style={{ fontSize: 13, color: theme.muted, marginBottom: 8 }}>
          {widget.binding.label || widget.title}
        </label>
        <select
          disabled={!interactive}
          value={value}
          onChange={(e) => onFilterChange(widget.id, e.target.value || undefined)}
          style={{
            background: 'transparent',
            color: theme.text,
            border: `1px solid ${theme.border}`,
            borderRadius: 8,
            padding: '8px 10px',
            fontSize: 14,
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

  if (widget.type === 'filter-date') {
    const range = (filters[widget.id] as { from?: string; to?: string }) || {};
    return (
      <div style={cardStyle}>
        <div style={{ fontSize: 13, color: theme.muted, marginBottom: 8 }}>
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
              background: 'transparent',
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
              background: 'transparent',
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
      <div style={cardStyle}>
        <div style={{ fontSize: 13, color: theme.muted }}>
          {widget.binding.label || widget.title}
        </div>
        <div
          style={{
            fontSize: 36,
            fontWeight: 700,
            marginTop: 'auto',
            color: theme.accent,
            letterSpacing: '-0.02em',
          }}
        >
          {total.toLocaleString('ru-RU')}
        </div>
      </div>
    );
  }

  if (widget.type === 'table') {
    const cols =
      widget.binding.columns?.length && widget.binding.columns.some(Boolean)
        ? widget.binding.columns
        : dataset?.columns || [];
    return (
      <div style={cardStyle}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{widget.title}</div>
        <div style={{ overflow: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {cols.map((c) => (
                  <th
                    key={c}
                    style={{
                      textAlign: 'left',
                      padding: '6px 8px',
                      borderBottom: `1px solid ${theme.border}`,
                      color: theme.muted,
                      position: 'sticky',
                      top: 0,
                      background: theme.surface,
                    }}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 200).map((row, i) => (
                <tr key={i}>
                  {cols.map((c) => (
                    <td
                      key={c}
                      style={{
                        padding: '5px 8px',
                        borderBottom: `1px solid ${theme.border}`,
                      }}
                    >
                      {row[c] == null ? '' : String(row[c])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && (
            <div style={{ color: theme.muted, padding: 12 }}>Нет данных</div>
          )}
        </div>
      </div>
    );
  }

  // charts
  const cat = widget.binding.categoryColumn || '';
  const val = widget.binding.valueColumn || '';
  const series = groupSum(rows, cat, val);
  const option = {
    color: theme.chartPalette,
    textStyle: { color: theme.text, fontFamily: theme.fontFamily },
    tooltip: { trigger: widget.type === 'pie' ? 'item' : 'axis' },
    grid: { left: 40, right: 16, top: 28, bottom: 40 },
    ...(widget.type === 'pie'
      ? {
          series: [
            {
              type: 'pie',
              radius: ['35%', '65%'],
              data: series.map((s) => ({ name: s.name, value: s.value })),
              label: { color: theme.text },
            },
          ],
        }
      : {
          xAxis: {
            type: 'category',
            data: series.map((s) => s.name),
            axisLabel: { color: theme.muted, rotate: series.length > 8 ? 30 : 0 },
          },
          yAxis: { type: 'value', axisLabel: { color: theme.muted }, splitLine: { lineStyle: { color: theme.border } } },
          series: [
            {
              type: widget.type === 'line' ? 'line' : 'bar',
              data: series.map((s) => s.value),
              smooth: widget.type === 'line',
              areaStyle: widget.type === 'line' ? { opacity: 0.12 } : undefined,
            },
          ],
        }),
  };

  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{widget.title}</div>
      <div style={{ flex: 1, minHeight: 0 }}>
        {series.length ? (
          <ReactECharts option={option} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'canvas' }} />
        ) : (
          <div style={{ color: theme.muted, padding: 12 }}>Нет данных для графика</div>
        )}
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { useStudioStore } from '../store/useStudioStore';
import type {
  CalculatedField,
  CalcCompareOp,
  CalcExprKind,
  CsvDelimiter,
  Dataset,
  FieldDataType,
  FieldFormatKind,
  FieldRole,
  FieldSchemaMap,
  FilterWidgetKind,
  MeasureToggleGroup,
  SourceCsv,
  SourceMssql,
} from '../shared/types';
import {
  CALC_KIND_FORMULA,
  CALC_KIND_LABELS,
  applyCalculatedFields,
  suggestFieldRoles,
} from '../shared/fieldMeta';
import {
  DATA_TYPE_OPTIONS,
  FIELD_FORMAT_OPTIONS,
  FILTER_WIDGET_OPTIONS,
  buildFieldSchema,
  columnSamples,
  fieldRolesFromSchema,
  panelFiltersFromSchema,
  patchSchemaField,
  uniqueColumnValues,
} from '../shared/etlSchema';
import { detectCsvDelimiter } from '../shared/pipelineRunner';
import { formatWeekLabel, uniqueWeeks } from '../shared/filter';
import { fetchSemicolonSampleCsv, refreshDatasets } from './api';
import { ROLE_LABELS } from '../shared/fieldMeta';
import './etl/etl-wizard.css';

const DELIM_OPTIONS: { id: CsvDelimiter; label: string }[] = [
  { id: 'auto', label: 'Авто' },
  { id: ';', label: ';' },
  { id: ',', label: ',' },
  { id: '\t', label: 'Tab' },
];

const MEASURE_TEMPLATES: { kind: CalcExprKind; title: string; formula: string }[] = [
  { kind: 'growth_contrib', title: 'Вклад', formula: '(A − B) / ΣB × 100' },
  { kind: 'growth', title: 'Прирост', formula: '(A − B) / B × 100' },
  { kind: 'delta', title: 'Разница', formula: 'A − B' },
  { kind: 'share', title: 'Доля', formula: 'A / ΣA × 100' },
  { kind: 'sum', title: 'SUM', formula: 'SUM(A)' },
  { kind: 'avg', title: 'AVG', formula: 'AVG(A)' },
  { kind: 'count', title: 'COUNT', formula: 'COUNT(A)' },
  { kind: 'count_distinct', title: 'COUNT DISTINCT', formula: 'COUNT DISTINCT(A)' },
  { kind: 'if', title: 'IF', formula: 'IF(cond, then, else)' },
  { kind: 'switch', title: 'SWITCH', formula: 'SWITCH(A, …)' },
];

type WizardStep = 1 | 2;
type SchemaTab = 'dims' | 'measures' | 'toggles';

interface Props {
  onClose: () => void;
}

function uid(prefix = 'id'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Live preview widgets for schema table. */
function FieldPreview({
  dataset,
  column,
  widget,
}: {
  dataset: Dataset;
  column: string;
  widget: FilterWidgetKind;
}) {
  const values = useMemo(() => uniqueColumnValues(dataset, column, 80), [dataset, column]);
  const weeks = useMemo(() => uniqueWeeks(dataset.rows, column), [dataset, column]);
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [single, setSingle] = useState(values[0] || '');
  const [weekIdx, setWeekIdx] = useState(Math.max(0, weeks.length - 1));
  const [weekIdx2, setWeekIdx2] = useState(0);
  const [toggleOn, setToggleOn] = useState(false);
  const nums = useMemo(() => {
    const arr: number[] = [];
    for (const v of values) {
      const n = Number(String(v).replace(/\s/g, '').replace(',', '.'));
      if (!Number.isNaN(n)) arr.push(n);
    }
    return arr;
  }, [values]);
  const min = nums.length ? Math.min(...nums) : 0;
  const max = nums.length ? Math.max(...nums) : 100;
  const [range, setRange] = useState<[number, number]>([min, max]);

  if (widget === 'none') {
    return <span className="empty-hint" style={{ padding: 0 }}>—</span>;
  }

  if (widget === 'multi') {
    const filtered = values.filter((v) => v.toLowerCase().includes(q.toLowerCase()));
    return (
      <div className="preview-multi">
        <div className="multi-toolbar">
          <input
            className="multi-search"
            placeholder="Поиск…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button
            type="button"
            className="multi-reset"
            title="Сбросить"
            onClick={() => {
              setPicked([]);
              setQ('');
            }}
          >
            ↺
          </button>
        </div>
        <div className="multi-list">
          {filtered.map((v) => {
            const on = picked.includes(v);
            return (
              <label key={v} className={`multi-opt${on ? ' on' : ''}`}>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() =>
                    setPicked((prev) =>
                      on ? prev.filter((x) => x !== v) : [...prev, v],
                    )
                  }
                />
                <span>{v}</span>
              </label>
            );
          })}
          {!filtered.length && <span className="empty-hint" style={{ padding: 8 }}>Нет значений</span>}
        </div>
      </div>
    );
  }

  if (widget === 'dropdown') {
    return (
      <select value={single} onChange={(e) => setSingle(e.target.value)}>
        {values.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
    );
  }

  if (widget === 'stepper' || widget === 'double_stepper') {
    const list = weeks.length ? weeks : values;
    if (!list.length) return <span className="empty-hint" style={{ padding: 0 }}>Нет значений</span>;
    const idx = Math.min(weekIdx, list.length - 1);
    const label = weeks.length ? formatWeekLabel(list[idx]) : list[idx];
    const idx2 = Math.min(weekIdx2, list.length - 1);
    const label2 = weeks.length ? formatWeekLabel(list[idx2]) : list[idx2];
    return (
      <div className="preview-box">
        <div className="stepper-row">
          <button type="button" onClick={() => setWeekIdx((i) => Math.max(0, i - 1))}>
            ‹
          </button>
          <span className="stepper-val">{label}</span>
          <button
            type="button"
            onClick={() => setWeekIdx((i) => Math.min(list.length - 1, i + 1))}
          >
            ›
          </button>
        </div>
        {widget === 'double_stepper' && (
          <div className="stepper-row">
            <button type="button" onClick={() => setWeekIdx2((i) => Math.max(0, i - 1))}>
              ‹
            </button>
            <span className="stepper-val">{label2}</span>
            <button
              type="button"
              onClick={() => setWeekIdx2((i) => Math.min(list.length - 1, i + 1))}
            >
              ›
            </button>
          </div>
        )}
      </div>
    );
  }

  if (widget === 'toggle') {
    const a = values[0] || 'Выкл';
    const b = values[1] || 'Вкл';
    return (
      <div className="preview-toggle">
        <button type="button" className={!toggleOn ? 'on' : ''} onClick={() => setToggleOn(false)}>
          {a}
        </button>
        <button type="button" className={toggleOn ? 'on' : ''} onClick={() => setToggleOn(true)}>
          {b}
        </button>
      </div>
    );
  }

  if (widget === 'slider_double') {
    return (
      <div className="preview-slider">
        <span>
          {range[0]} — {range[1]}
        </span>
        <input
          type="range"
          min={min}
          max={max}
          value={range[0]}
          onChange={(e) => setRange(([_, hi]) => [Number(e.target.value), hi])}
        />
        <input
          type="range"
          min={min}
          max={max}
          value={range[1]}
          onChange={(e) => setRange(([lo]) => [lo, Number(e.target.value)])}
        />
      </div>
    );
  }

  return null;
}

function DropSlot({
  label,
  value,
  onDropField,
}: {
  label: string;
  value?: string;
  onDropField: (field: string) => void;
}) {
  const [over, setOver] = useState(false);
  return (
    <div
      className={`calc-slot${value ? ' filled' : ''}${over ? ' drag-over' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const field = e.dataTransfer.getData('text/etl-field');
        if (field) onDropField(field);
      }}
      title="Перетащите поле из пула"
    >
      {value || label}
    </div>
  );
}

export function EtlModal({ onClose }: Props) {
  const sources = useStudioStore((s) => s.sources);
  const pipelines = useStudioStore((s) => s.pipelines);
  const datasets = useStudioStore((s) => s.datasets);
  const addCsvSource = useStudioStore((s) => s.addCsvSource);
  const addMssqlSource = useStudioStore((s) => s.addMssqlSource);
  const updateSource = useStudioStore((s) => s.updateSource);
  const removeSource = useStudioStore((s) => s.removeSource);
  const setDatasets = useStudioStore((s) => s.setDatasets);
  const updateDatasetMeta = useStudioStore((s) => s.updateDatasetMeta);
  const setLastError = useStudioStore((s) => s.setLastError);
  const setRefreshing = useStudioStore((s) => s.setRefreshing);
  const refreshing = useStudioStore((s) => s.refreshing);
  const replaceDatasetPanelFilters = useStudioStore((s) => s.replaceDatasetPanelFilters);

  const csvRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<WizardStep>(1);
  const [tab, setTab] = useState<SchemaTab>('dims');
  const [csvDelim, setCsvDelim] = useState<CsvDelimiter>(';');
  const [activeSourceId, setActiveSourceId] = useState<string>('');
  const [datasetId, setDatasetId] = useState(datasets[0]?.id || '');
  const [schema, setSchema] = useState<FieldSchemaMap>({});
  const [calcs, setCalcs] = useState<CalculatedField[]>([]);
  const [toggles, setToggles] = useState<MeasureToggleGroup[]>([]);
  const [showSql, setShowSql] = useState(false);
  const [sqlForm, setSqlForm] = useState({
    name: 'MSSQL',
    server: '',
    database: '',
    user: '',
    password: '',
    port: 1433,
  });

  const activeSource = sources.find((s) => s.id === activeSourceId) || sources[0];
  const ds = useMemo(() => {
    if (!datasets.length) return undefined;
    const bySource = pipelines.find((p) => p.sourceId === (activeSource?.id || ''));
    if (bySource) {
      const matched = datasets.find((d) => d.id === bySource.datasetId);
      if (matched) return matched;
    }
    return datasets.find((d) => d.id === datasetId) || datasets[0];
  }, [datasets, datasetId, pipelines, activeSource?.id]);

  // Sync local schema draft when dataset / active source changes
  useEffect(() => {
    if (!ds) {
      setSchema({});
      setCalcs([]);
      setToggles([]);
      return;
    }
    setDatasetId(ds.id);
    const roles = ds.fieldRoles || suggestFieldRoles(ds);
    const built = buildFieldSchema({ ...ds, fieldRoles: roles }, ds.fieldSchema);
    setSchema(built);
    setCalcs(ds.calculatedFields || []);
    setToggles(ds.measureToggles || []);
  }, [ds?.id, ds?.updatedAt, ds?.columns?.join('|')]);

  useEffect(() => {
    if (!activeSourceId && sources[0]) setActiveSourceId(sources[0].id);
  }, [sources, activeSourceId]);

  // When user picks another source, jump dataset binding with it
  useEffect(() => {
    if (!activeSource) return;
    const pipe = pipelines.find((p) => p.sourceId === activeSource.id);
    if (pipe) setDatasetId(pipe.datasetId);
  }, [activeSource?.id, pipelines]);

  const dimFields = useMemo(() => {
    if (!ds) return [] as string[];
    return ds.columns.filter((c) => {
      const r = schema[c]?.role || ds.fieldRoles?.[c];
      return r === 'dimension' || r === 'filter' || r === 'date';
    });
  }, [ds, schema]);

  const measureFields = useMemo(() => {
    if (!ds) return [] as string[];
    return ds.columns.filter((c) => (schema[c]?.role || ds.fieldRoles?.[c]) === 'measure');
  }, [ds, schema]);

  const onRefresh = async () => {
    setRefreshing(true);
    setLastError(null);
    try {
      const state = useStudioStore.getState();
      const { datasets: next, warnings } = await refreshDatasets(
        state.sources,
        state.pipelines,
      );
      setDatasets(next);
      if (warnings?.length) setLastError(warnings.join('\n'));
      const first = next[0];
      if (first) setDatasetId(first.id);
    } catch (e) {
      setLastError(e instanceof Error ? e.message : String(e));
    } finally {
      setRefreshing(false);
    }
  };

  const ingestText = async (name: string, fileName: string, text: string, delim: CsvDelimiter) => {
    const detected = detectCsvDelimiter(text);
    const d: CsvDelimiter = delim !== 'auto' ? delim : detected === ',' ? 'auto' : detected;
    addCsvSource(name, fileName, text, d);
    await onRefresh();
    const state = useStudioStore.getState();
    const last = state.sources[state.sources.length - 1];
    if (last) setActiveSourceId(last.id);
  };

  const uploadCsv = async (file: File) => {
    const text = await file.text();
    await ingestText(file.name.replace(/\.csv$/i, ''), file.name, text, csvDelim);
  };

  const loadSemicolonDemo = async () => {
    const text = await fetchSemicolonSampleCsv();
    await ingestText('пфп44', 'pfp44.csv', text, ';');
  };

  const finishSetup = () => {
    if (!ds) return;
    const roles = fieldRolesFromSchema(schema);
    const applied = applyCalculatedFields(
      {
        ...ds,
        fieldRoles: roles,
        fieldSchema: schema,
        calculatedFields: calcs,
        measureToggles: toggles,
      },
      calcs,
    );
    updateDatasetMeta(ds.id, {
      fieldRoles: applied.fieldRoles,
      fieldSchema: schema,
      calculatedFields: calcs,
      measureToggles: toggles,
      columns: applied.columns,
      rows: applied.rows,
    });

    // Replace panel filters for this dataset from schema widgets
    const nextFilters = panelFiltersFromSchema(applied, schema);
    replaceDatasetPanelFilters(ds.id, nextFilters);

    onClose();
  };

  const addCalcTemplate = (kind: CalcExprKind) => {
    const nameBase =
      kind === 'growth_contrib'
        ? 'vklad_pct'
        : kind === 'growth'
          ? 'prirost_pct'
          : kind === 'share'
            ? 'dolya_pct'
            : kind === 'delta'
              ? 'raznica'
              : String(kind);
    let name = nameBase;
    let i = 2;
    const existing = new Set([...(ds?.columns || []), ...calcs.map((c) => c.name)]);
    while (existing.has(name)) {
      name = `${nameBase}_${i++}`;
    }
    const draft: CalculatedField = {
      id: uid('calc'),
      name,
      kind,
      // Leave slots empty for Flat Design DnD parity (drag from var-pool).
      a: '',
      b: '',
      op: kind === 'if' ? 'between' : undefined,
      value: kind === 'if' ? 0 : undefined,
      value2: kind === 'if' ? 100 : undefined,
      thenValue: kind === 'if' ? 1 : undefined,
      elseValue: kind === 'if' ? 0 : undefined,
      cases:
        kind === 'switch'
          ? [
              { id: uid('case'), match: '', result: '' },
              { id: uid('case'), match: '', result: '' },
            ]
          : undefined,
      defaultValue: kind === 'switch' ? '' : undefined,
    };
    setCalcs((list) => [...list, draft]);
  };

  const patchCalc = (id: string, patch: Partial<CalculatedField>) => {
    setCalcs((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const removeCalc = (id: string) => setCalcs((list) => list.filter((c) => c.id !== id));

  const addToggleGroup = () => {
    setToggles((list) => [
      ...list,
      {
        id: uid('tg'),
        name: 'НДС',
        options: [
          { id: uid('opt'), label: 'Без НДС', field: measureFields[0] || '' },
          { id: uid('opt'), label: 'С НДС', field: measureFields[1] || measureFields[0] || '' },
        ],
      },
    ]);
  };

  return (
    <div className="etl-modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="etl-modal" onClick={(e) => e.stopPropagation()}>
        <header className="etl-header">
          <div className="etl-header-left">
            <h2 className="etl-title">ETL Конструктор</h2>
            <span className="step-indicator">
              Шаг {step} из 2: {step === 1 ? 'Типы данных' : 'Настройка схемы'}
            </span>
          </div>
          <div className="etl-header-actions">
            <button
              type="button"
              className="btn"
              disabled={refreshing || !sources.length}
              onClick={() => void onRefresh()}
            >
              {refreshing ? 'Обновление…' : 'Обновить данные'}
            </button>
            <button type="button" className="etl-close" title="Закрыть" aria-label="Закрыть" onClick={onClose}>
              ×
            </button>
          </div>
        </header>

        {step === 1 ? (
          <div className="etl-body">
            <aside className="etl-sidebar">
              <h3 className="sidebar-title">Источники</h3>
              <ul className="file-list">
                {sources.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      className={`file-item${(activeSource?.id || '') === s.id ? ' active' : ''}`}
                      onClick={() => setActiveSourceId(s.id)}
                    >
                      <span className="file-name">
                        {s.type === 'csv' ? 'CSV' : 'SQL'}: {s.name}
                      </span>
                      <span className="file-meta">
                        {s.type === 'csv'
                          ? `${(s as SourceCsv).fileName} · ${(s as SourceCsv).delimiter || 'auto'}`
                          : `${s.server}/${s.database}`}
                      </span>
                    </button>
                    {s.type === 'csv' && (activeSource?.id || '') === s.id && (
                      <div className="delim-row">
                        Разделитель
                        <select
                          value={(s as SourceCsv).delimiter || 'auto'}
                          onChange={(e) =>
                            updateSource(s.id, {
                              delimiter: e.target.value as CsvDelimiter,
                            })
                          }
                        >
                          {DELIM_OPTIONS.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={() => removeSource(s.id)}
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </li>
                ))}
                {!sources.length && <li className="empty-hint">Загрузите CSV или SQL</li>}
              </ul>

              <div className="delim-row">
                Для новых файлов
                <select
                  value={csvDelim}
                  onChange={(e) => setCsvDelim(e.target.value as CsvDelimiter)}
                >
                  {DELIM_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="source-actions">
                <button type="button" className="btn btn-source" onClick={() => csvRef.current?.click()}>
                  + CSV
                </button>
                <button
                  type="button"
                  className="btn btn-source is-disabled"
                  disabled
                  title="Excel пока не поддерживается — сохраните лист как CSV (;)"
                >
                  + XLSX
                </button>
                <div className="hint-xlsx">пока только CSV</div>
                <button type="button" className="btn btn-source" onClick={() => setShowSql((v) => !v)}>
                  + SQL
                </button>
                <button
                  type="button"
                  className="btn btn-source ghost"
                  title="Демо: semicolon RU CSV"
                  onClick={() => void loadSemicolonDemo()}
                >
                  Демо ;
                </button>
                <input
                  ref={csvRef}
                  type="file"
                  accept=".csv,text/csv"
                  hidden
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) await uploadCsv(f);
                    e.target.value = '';
                  }}
                />
              </div>

              {showSql && (
                <div className="etl-mssql-form">
                  {(
                    [
                      ['name', 'Имя'],
                      ['server', 'Сервер'],
                      ['database', 'БД'],
                      ['user', 'Логин'],
                      ['password', 'Пароль'],
                    ] as const
                  ).map(([k, lab]) => (
                    <label key={k}>
                      {lab}
                      <input
                        type={k === 'password' ? 'password' : 'text'}
                        value={sqlForm[k]}
                        onChange={(e) => setSqlForm((f) => ({ ...f, [k]: e.target.value }))}
                      />
                    </label>
                  ))}
                  <label>
                    Порт
                    <input
                      type="number"
                      value={sqlForm.port}
                      onChange={(e) =>
                        setSqlForm((f) => ({ ...f, port: Number(e.target.value) || 1433 }))
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="btn primary"
                    onClick={() => {
                      const payload: Omit<SourceMssql, 'id' | 'type'> = {
                        ...sqlForm,
                        trustServerCertificate: true,
                      };
                      addMssqlSource(payload);
                      setShowSql(false);
                    }}
                  >
                    Добавить SQL
                  </button>
                </div>
              )}
            </aside>

            <div className="etl-main">
              <div className="etl-main-scroll">
                {!ds ? (
                  <p className="empty-hint">
                    Загрузите источник с разделителем «;» для RU/Excel CSV, затем данные появятся
                    здесь.
                  </p>
                ) : (
                  <table className="schema-table">
                    <thead>
                      <tr>
                        <th>Поле</th>
                        <th>Примеры</th>
                        <th>Тип данных</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ds.columns.map((col) => {
                        const samples = columnSamples(ds, col);
                        const cfg = schema[col];
                        return (
                          <tr key={col}>
                            <td>
                              <strong>{col}</strong>
                            </td>
                            <td>
                              <div className="sample-chips">
                                {samples.map((s) => (
                                  <span key={s} className="chip" title={s}>
                                    {s}
                                  </span>
                                ))}
                                {!samples.length && <span className="chip">—</span>}
                              </div>
                            </td>
                            <td>
                              <select
                                className="type-select"
                                value={cfg?.dataType || 'String'}
                                onChange={(e) =>
                                  setSchema((prev) =>
                                    patchSchemaField(prev, col, {
                                      dataType: e.target.value as FieldDataType,
                                    }),
                                  )
                                }
                              >
                                {DATA_TYPE_OPTIONS.map((t) => (
                                  <option key={t} value={t}>
                                    {t}
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
              <footer className="etl-footer">
                <span className="etl-footer-meta">
                  {ds
                    ? `${ds.rows.length} строк · ${ds.columns.length} колонок`
                    : 'Нет датасета'}
                </span>
                <button
                  type="button"
                  className="btn primary"
                  disabled={!ds}
                  onClick={() => setStep(2)}
                >
                  Далее: Настройка схемы
                </button>
              </footer>
            </div>
          </div>
        ) : (
          <div className="etl-step2">
            <nav className="etl-tabs">
              {(
                [
                  ['dims', 'Измерения и Фильтры'],
                  ['measures', 'Меры и Вычисления'],
                  ['toggles', 'Переключатели'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`etl-tab${tab === id ? ' active' : ''}`}
                  onClick={() => setTab(id)}
                >
                  {label}
                </button>
              ))}
            </nav>

            <div className="etl-main-scroll">
              {tab === 'dims' && ds && (
                <table className="schema-table">
                  <thead>
                    <tr>
                      <th>Поле</th>
                      <th>Роль</th>
                      <th>Виджет / Фильтр</th>
                      <th>Формат</th>
                      <th>Превью</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ds.columns.map((col) => {
                      const cfg = schema[col] || {
                        role: 'dimension' as FieldRole,
                        widget: 'none' as FilterWidgetKind,
                        format: 'auto' as FieldFormatKind,
                        dataType: 'String' as FieldDataType,
                      };
                      return (
                        <tr key={col}>
                          <td>
                            <strong>{col}</strong>
                          </td>
                          <td>
                            <select
                              value={cfg.role}
                              onChange={(e) =>
                                setSchema((prev) =>
                                  patchSchemaField(prev, col, {
                                    role: e.target.value as FieldRole,
                                  }),
                                )
                              }
                            >
                              {(Object.keys(ROLE_LABELS) as FieldRole[]).map((r) => (
                                <option key={r} value={r}>
                                  {ROLE_LABELS[r]}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <select
                              value={cfg.widget}
                              disabled={cfg.role === 'measure' || cfg.role === 'ignore'}
                              onChange={(e) =>
                                setSchema((prev) =>
                                  patchSchemaField(prev, col, {
                                    widget: e.target.value as FilterWidgetKind,
                                  }),
                                )
                              }
                            >
                              {FILTER_WIDGET_OPTIONS.map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <select
                              value={cfg.format}
                              onChange={(e) =>
                                setSchema((prev) =>
                                  patchSchemaField(prev, col, {
                                    format: e.target.value as FieldFormatKind,
                                  }),
                                )
                              }
                            >
                              {FIELD_FORMAT_OPTIONS.map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <FieldPreview dataset={ds} column={col} widget={cfg.widget} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              {tab === 'measures' && ds && (
                <div className="measures-layout">
                  <aside className="var-pool">
                    <h4 className="var-section">Измерения</h4>
                    {dimFields.map((f) => (
                      <button
                        key={f}
                        type="button"
                        className="var-chip dim"
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData('text/etl-field', f)}
                      >
                        {f}
                      </button>
                    ))}
                    <h4 className="var-section" style={{ marginTop: 12 }}>
                      Меры
                    </h4>
                    {measureFields.map((f) => (
                      <button
                        key={f}
                        type="button"
                        className="var-chip meas"
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData('text/etl-field', f)}
                      >
                        {f}
                      </button>
                    ))}
                    {!dimFields.length && !measureFields.length && (
                      <p className="empty-hint">Задайте роли на вкладке «Измерения»</p>
                    )}
                  </aside>

                  <div>
                    <div className="formula-templates">
                      {MEASURE_TEMPLATES.map((tpl) => (
                        <button
                          key={tpl.kind}
                          type="button"
                          className="formula-tpl"
                          onClick={() => addCalcTemplate(tpl.kind)}
                        >
                          <strong>{tpl.title}</strong>
                          <span>{tpl.formula}</span>
                        </button>
                      ))}
                    </div>

                    {calcs.map((calc) => (
                      <div key={calc.id} className="calc-block">
                        <div className="calc-block-head">
                          <input
                            value={calc.name}
                            onChange={(e) => patchCalc(calc.id, { name: e.target.value })}
                            placeholder="Имя поля"
                          />
                          <strong style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                            {CALC_KIND_LABELS[calc.kind]}
                          </strong>
                          <button
                            type="button"
                            className="btn ghost"
                            onClick={() => removeCalc(calc.id)}
                          >
                            ×
                          </button>
                        </div>

                        {(calc.kind === 'growth' ||
                          calc.kind === 'growth_contrib' ||
                          calc.kind === 'delta' ||
                          calc.kind === 'ratio' ||
                          calc.kind === 'pct') && (
                          <div className="calc-slots">
                            <DropSlot
                              label="A"
                              value={calc.a}
                              onDropField={(f) => patchCalc(calc.id, { a: f })}
                            />
                            <span>
                              {calc.kind === 'delta'
                                ? '−'
                                : calc.kind === 'ratio' || calc.kind === 'pct'
                                  ? '÷'
                                  : 'vs'}
                            </span>
                            <DropSlot
                              label="B"
                              value={calc.b}
                              onDropField={(f) => patchCalc(calc.id, { b: f })}
                            />
                            <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                              {CALC_KIND_FORMULA[calc.kind]}
                            </span>
                          </div>
                        )}

                        {(calc.kind === 'sum' ||
                          calc.kind === 'avg' ||
                          calc.kind === 'count' ||
                          calc.kind === 'count_distinct' ||
                          calc.kind === 'share') && (
                          <div className="calc-slots">
                            <span>{CALC_KIND_LABELS[calc.kind]}(</span>
                            <DropSlot
                              label="поле"
                              value={calc.a}
                              onDropField={(f) => patchCalc(calc.id, { a: f })}
                            />
                            <span>)</span>
                          </div>
                        )}

                        {calc.kind === 'if' && (
                          <div>
                            <div className="calc-slots">
                              <span>IF</span>
                              <DropSlot
                                label="поле"
                                value={calc.a}
                                onDropField={(f) => patchCalc(calc.id, { a: f })}
                              />
                              <select
                                value={calc.op || 'between'}
                                onChange={(e) =>
                                  patchCalc(calc.id, { op: e.target.value as CalcCompareOp })
                                }
                              >
                                <option value="between">between</option>
                                <option value="eq">=</option>
                                <option value="neq">≠</option>
                                <option value="gt">&gt;</option>
                                <option value="lt">&lt;</option>
                                <option value="gte">≥</option>
                                <option value="lte">≤</option>
                                <option value="contains">contains</option>
                              </select>
                              {calc.op === 'between' ? (
                                <>
                                  <input
                                    type="number"
                                    value={calc.value ?? 0}
                                    onChange={(e) =>
                                      patchCalc(calc.id, { value: Number(e.target.value) })
                                    }
                                    style={{ width: 72 }}
                                  />
                                  <span>и</span>
                                  <input
                                    type="number"
                                    value={calc.value2 ?? 0}
                                    onChange={(e) =>
                                      patchCalc(calc.id, { value2: Number(e.target.value) })
                                    }
                                    style={{ width: 72 }}
                                  />
                                </>
                              ) : (
                                <input
                                  value={calc.b ?? ''}
                                  placeholder="значение / поле"
                                  onChange={(e) => patchCalc(calc.id, { b: e.target.value })}
                                  style={{ width: 120 }}
                                />
                              )}
                            </div>
                            <div className="case-row">
                              <span>then</span>
                              <input
                                value={String(calc.thenValue ?? '')}
                                onChange={(e) => patchCalc(calc.id, { thenValue: e.target.value })}
                              />
                              <span>else</span>
                              <input
                                value={String(calc.elseValue ?? '')}
                                onChange={(e) => patchCalc(calc.id, { elseValue: e.target.value })}
                              />
                            </div>
                          </div>
                        )}

                        {calc.kind === 'switch' && (
                          <div>
                            <div className="calc-slots">
                              <span>SWITCH</span>
                              <DropSlot
                                label="поле"
                                value={calc.a}
                                onDropField={(f) => patchCalc(calc.id, { a: f })}
                              />
                            </div>
                            {(calc.cases || []).map((c) => (
                              <div key={c.id} className="case-row">
                                <input
                                  placeholder="когда"
                                  value={c.match}
                                  onChange={(e) =>
                                    patchCalc(calc.id, {
                                      cases: (calc.cases || []).map((x) =>
                                        x.id === c.id ? { ...x, match: e.target.value } : x,
                                      ),
                                    })
                                  }
                                />
                                <span>→</span>
                                <input
                                  placeholder="результат"
                                  value={String(c.result)}
                                  onChange={(e) =>
                                    patchCalc(calc.id, {
                                      cases: (calc.cases || []).map((x) =>
                                        x.id === c.id ? { ...x, result: e.target.value } : x,
                                      ),
                                    })
                                  }
                                />
                                <button
                                  type="button"
                                  className="btn ghost"
                                  onClick={() =>
                                    patchCalc(calc.id, {
                                      cases: (calc.cases || []).filter((x) => x.id !== c.id),
                                    })
                                  }
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                            <div className="case-row">
                              <button
                                type="button"
                                className="btn"
                                onClick={() =>
                                  patchCalc(calc.id, {
                                    cases: [
                                      ...(calc.cases || []),
                                      { id: uid('case'), match: '', result: '' },
                                    ],
                                  })
                                }
                              >
                                + case
                              </button>
                              <span>default</span>
                              <input
                                value={String(calc.defaultValue ?? '')}
                                onChange={(e) =>
                                  patchCalc(calc.id, { defaultValue: e.target.value })
                                }
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    {!calcs.length && (
                      <p className="empty-hint">Выберите шаблон формулы или перетащите поля в слоты</p>
                    )}
                  </div>
                </div>
              )}

              {tab === 'toggles' && (
                <div className="toggle-groups">
                  <p className="empty-hint" style={{ textAlign: 'left', padding: '0 0 8px' }}>
                    Именованные группы: метка кнопки → поле меры (например «Без НДС» / «С НДС»).
                  </p>
                  <button type="button" className="btn" onClick={addToggleGroup}>
                    + Группа переключателей
                  </button>
                  {toggles.map((g) => (
                    <div key={g.id} className="toggle-group">
                      <div className="case-row">
                        <input
                          value={g.name}
                          onChange={(e) =>
                            setToggles((list) =>
                              list.map((x) =>
                                x.id === g.id ? { ...x, name: e.target.value } : x,
                              ),
                            )
                          }
                          placeholder="Имя группы"
                        />
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={() => setToggles((list) => list.filter((x) => x.id !== g.id))}
                        >
                          Удалить группу
                        </button>
                      </div>
                      <div className="toggle-opts">
                        {g.options.map((opt) => (
                          <div key={opt.id} className="toggle-state-row">
                            <input
                              value={opt.label}
                              placeholder="Метка кнопки"
                              onChange={(e) =>
                                setToggles((list) =>
                                  list.map((x) =>
                                    x.id !== g.id
                                      ? x
                                      : {
                                          ...x,
                                          options: x.options.map((o) =>
                                            o.id === opt.id
                                              ? { ...o, label: e.target.value }
                                              : o,
                                          ),
                                        },
                                  ),
                                )
                              }
                            />
                            <select
                              value={opt.field}
                              onChange={(e) =>
                                setToggles((list) =>
                                  list.map((x) =>
                                    x.id !== g.id
                                      ? x
                                      : {
                                          ...x,
                                          options: x.options.map((o) =>
                                            o.id === opt.id
                                              ? { ...o, field: e.target.value }
                                              : o,
                                          ),
                                        },
                                  ),
                                )
                              }
                            >
                              <option value="">— мера —</option>
                              {(measureFields.length ? measureFields : ds?.columns || []).map(
                                (c) => (
                                  <option key={c} value={c}>
                                    {c}
                                  </option>
                                ),
                              )}
                            </select>
                            <button
                              type="button"
                              className="btn ghost"
                              onClick={() =>
                                setToggles((list) =>
                                  list.map((x) =>
                                    x.id !== g.id
                                      ? x
                                      : {
                                          ...x,
                                          options: x.options.filter((o) => o.id !== opt.id),
                                        },
                                  ),
                                )
                              }
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          className="btn"
                          onClick={() =>
                            setToggles((list) =>
                              list.map((x) =>
                                x.id !== g.id
                                  ? x
                                  : {
                                      ...x,
                                      options: [
                                        ...x.options,
                                        {
                                          id: uid('opt'),
                                          label: 'Новая',
                                          field: measureFields[0] || '',
                                        },
                                      ],
                                    },
                              ),
                            )
                          }
                        >
                          + вариант
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!ds && <p className="empty-hint">Нет датасета — вернитесь к шагу 1</p>}
            </div>

            <footer className="etl-footer">
              <button type="button" className="btn" onClick={() => setStep(1)}>
                Назад
              </button>
              <button
                type="button"
                className="btn primary"
                disabled={!ds}
                onClick={finishSetup}
              >
                Завершить настройку
              </button>
            </footer>
          </div>
        )}
      </div>
    </div>
  );
}

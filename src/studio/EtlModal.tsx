import { useMemo, useRef, useState } from 'react';
import { useStudioStore } from '../store/useStudioStore';
import type {
  CalculatedField,
  CsvDelimiter,
  FieldRole,
  SourceCsv,
  SourceMssql,
} from '../shared/types';
import {
  CALC_KIND_LABELS,
  CALC_KIND_ORDER,
  ROLE_LABELS,
  applyCalculatedFields,
  suggestFieldRoles,
} from '../shared/fieldMeta';
import { detectCsvDelimiter } from '../shared/pipelineRunner';
import { refreshDatasets } from './api';
import { FieldSelect } from './FieldSelect';

const DELIM_OPTIONS: { id: CsvDelimiter; label: string }[] = [
  { id: 'auto', label: 'Авто' },
  { id: ';', label: 'Точка с запятой (;)' },
  { id: ',', label: 'Запятая (,)' },
  { id: '\t', label: 'Таб' },
];

interface Props {
  onClose: () => void;
}

function uid(prefix = 'id'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function EtlModal({ onClose }: Props) {
  const sources = useStudioStore((s) => s.sources);
  const pipelines = useStudioStore((s) => s.pipelines);
  const datasets = useStudioStore((s) => s.datasets);
  const addCsvSource = useStudioStore((s) => s.addCsvSource);
  const addMssqlSource = useStudioStore((s) => s.addMssqlSource);
  const addPipeline = useStudioStore((s) => s.addPipeline);
  const updateSource = useStudioStore((s) => s.updateSource);
  const removeSource = useStudioStore((s) => s.removeSource);
  const updatePipeline = useStudioStore((s) => s.updatePipeline);
  const removePipeline = useStudioStore((s) => s.removePipeline);
  const setDatasets = useStudioStore((s) => s.setDatasets);
  const setLastError = useStudioStore((s) => s.setLastError);
  const setRefreshing = useStudioStore((s) => s.setRefreshing);
  const refreshing = useStudioStore((s) => s.refreshing);
  const updateDatasetMeta = useStudioStore((s) => s.updateDatasetMeta);

  const fileRef = useRef<HTMLInputElement>(null);
  const [datasetId, setDatasetId] = useState(datasets[0]?.id || '');
  const [csvDelim, setCsvDelim] = useState<CsvDelimiter>('auto');
  const [showMssql, setShowMssql] = useState(false);
  const [mssqlForm, setMssqlForm] = useState({
    name: 'MSSQL',
    server: '',
    database: '',
    user: '',
    password: '',
    port: 1433,
  });
  const [calcDraft, setCalcDraft] = useState<Omit<CalculatedField, 'id'>>({
    name: '',
    kind: 'growth',
    a: '',
    b: '',
    withYear: false,
  });

  const isDateKind =
    calcDraft.kind === 'year' ||
    calcDraft.kind === 'month' ||
    calcDraft.kind === 'iso_week';
  const needsBase =
    calcDraft.kind === 'ratio' ||
    calcDraft.kind === 'pct' ||
    calcDraft.kind === 'delta' ||
    calcDraft.kind === 'growth' ||
    calcDraft.kind === 'growth_contrib';
  const fieldALabel =
    calcDraft.kind === 'growth' || calcDraft.kind === 'growth_contrib'
      ? 'Отчёт / факт (X_report)'
      : isDateKind
        ? 'Колонка даты'
        : 'Поле A';
  const fieldBLabel =
    calcDraft.kind === 'growth' || calcDraft.kind === 'growth_contrib'
      ? 'База / план (X_base)'
      : 'Поле B';

  const ds = useMemo(
    () => datasets.find((d) => d.id === datasetId) || datasets[0],
    [datasets, datasetId],
  );

  const onRefresh = async () => {
    setRefreshing(true);
    setLastError(null);
    try {
      // Always read latest sources (incl. delimiter) so «Обновить» re-parses CSV.
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

  const uploadCsv = async (file: File) => {
    const text = await file.text();
    const detected = detectCsvDelimiter(text);
    // Prefer UI override; pin detected `;`/`tab` so refresh is stable across API restarts.
    const delim: CsvDelimiter =
      csvDelim !== 'auto' ? csvDelim : detected === ',' ? 'auto' : detected;
    addCsvSource(file.name.replace(/\.csv$/i, ''), file.name, text, delim);
    await onRefresh();
  };

  const setRole = (column: string, role: FieldRole) => {
    if (!ds) return;
    updateDatasetMeta(ds.id, {
      fieldRoles: { ...(ds.fieldRoles || {}), [column]: role },
    });
  };

  const resuggest = () => {
    if (!ds) return;
    updateDatasetMeta(ds.id, { fieldRoles: suggestFieldRoles(ds) });
  };

  const addCalc = () => {
    if (!ds || !calcDraft.name.trim()) return;
    const name = calcDraft.name.trim();
    if (ds.columns.includes(name) && !(ds.calculatedFields || []).some((c) => c.name === name)) {
      setLastError(`Колонка «${name}» уже есть`);
      return;
    }
    const nextCalcs = [
      ...(ds.calculatedFields || []).filter((c) => c.name !== name),
      { ...calcDraft, id: uid('calc'), name },
    ];
    const applied = applyCalculatedFields(
      { ...ds, calculatedFields: nextCalcs },
      nextCalcs,
    );
    updateDatasetMeta(ds.id, {
      calculatedFields: nextCalcs,
      columns: applied.columns,
      rows: applied.rows,
      fieldRoles: applied.fieldRoles,
    });
    setCalcDraft({ name: '', kind: 'growth', a: '', b: '', withYear: false });
  };

  const removeCalc = (id: string) => {
    if (!ds) return;
    const nextCalcs = (ds.calculatedFields || []).filter((c) => c.id !== id);
    // Drop calc column from rows
    const dropNames = new Set(
      (ds.calculatedFields || []).filter((c) => c.id === id).map((c) => c.name),
    );
    const columns = ds.columns.filter((c) => !dropNames.has(c));
    const rows = ds.rows.map((r) => {
      const next = { ...r };
      for (const n of dropNames) delete next[n];
      return next;
    });
    const roles = { ...(ds.fieldRoles || {}) };
    for (const n of dropNames) delete roles[n];
    const applied = applyCalculatedFields(
      { ...ds, columns, rows, fieldRoles: roles, calculatedFields: nextCalcs },
      nextCalcs,
    );
    updateDatasetMeta(ds.id, {
      calculatedFields: nextCalcs,
      columns: applied.columns,
      rows: applied.rows,
      fieldRoles: applied.fieldRoles,
    });
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-card etl-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Данные / ETL</h2>
          <div className="row-actions">
            <button type="button" className="btn" disabled={refreshing} onClick={() => void onRefresh()}>
              {refreshing ? 'Обновление…' : 'Обновить данные'}
            </button>
            <button type="button" className="btn ghost" onClick={onClose}>
              Закрыть
            </button>
          </div>
        </div>

        <div className="etl-grid">
          <section className="etl-section">
            <h3>Источники</h3>
            <div className="row-actions" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
              <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
                + CSV
              </button>
              <button type="button" className="btn ghost" onClick={() => setShowMssql((v) => !v)}>
                + MSSQL
              </button>
              <label className="field-inline" title="Разделитель для новых CSV">
                Разделитель
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
              </label>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                hidden
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  await uploadCsv(file);
                  e.target.value = '';
                }}
              />
            </div>
            <p className="hint">
              Для Excel/RU CSV обычно «;». После загрузки данные перечитываются сразу. Если колонка
              одна — смените разделитель у источника и нажмите «Обновить данные».
            </p>
            {showMssql && (
              <div className="mssql-form">
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
                      value={mssqlForm[k]}
                      onChange={(e) => setMssqlForm((f) => ({ ...f, [k]: e.target.value }))}
                    />
                  </label>
                ))}
                <label>
                  Порт
                  <input
                    type="number"
                    value={mssqlForm.port}
                    onChange={(e) =>
                      setMssqlForm((f) => ({ ...f, port: Number(e.target.value) || 1433 }))
                    }
                  />
                </label>
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => {
                    const payload: Omit<SourceMssql, 'id' | 'type'> = { ...mssqlForm };
                    addMssqlSource(payload);
                    setShowMssql(false);
                  }}
                >
                  Добавить MSSQL
                </button>
              </div>
            )}
            <ul className="source-list">
              {sources.map((s) => (
                <li key={s.id}>
                  <div className="source-head">
                    <strong>
                      {s.type.toUpperCase()}: {s.name}
                    </strong>
                    <button type="button" className="btn ghost" onClick={() => removeSource(s.id)}>
                      ×
                    </button>
                  </div>
                  {s.type === 'csv' && (
                    <>
                      <div className="muted">{(s as SourceCsv).fileName}</div>
                      <label>
                        Разделитель CSV
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
                      </label>
                    </>
                  )}
                  {s.type === 'mssql' && (
                    <label>
                      Имя
                      <input
                        value={s.name}
                        onChange={(e) => updateSource(s.id, { name: e.target.value })}
                      />
                    </label>
                  )}
                </li>
              ))}
              {!sources.length && <li className="muted">Пока нет источников</li>}
            </ul>

            <h3>Конвейеры</h3>
            <button type="button" className="btn" onClick={() => addPipeline()}>
              + Конвейер
            </button>
            <ul className="source-list">
              {pipelines.map((p) => (
                <li key={p.id}>
                  <div className="source-head">
                    <input
                      value={p.name}
                      onChange={(e) => updatePipeline(p.id, { name: e.target.value })}
                    />
                    <button type="button" className="btn ghost" onClick={() => removePipeline(p.id)}>
                      ×
                    </button>
                  </div>
                  <label>
                    Источник
                    <select
                      value={p.sourceId}
                      onChange={(e) => updatePipeline(p.id, { sourceId: e.target.value })}
                    >
                      <option value="">—</option>
                      {sources.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="muted">Шагов: {p.steps.length} (редактор — в боковой панели)</div>
                </li>
              ))}
            </ul>
          </section>

          <section className="etl-section">
            <h3>Роли полей</h3>
            <p className="hint">
              После «Обновить данные» роли предлагаются автоматически. Можно переопределить.
            </p>
            <label>
              Датасет
              <select
                value={ds?.id || ''}
                onChange={(e) => setDatasetId(e.target.value)}
              >
                {!datasets.length && <option value="">—</option>}
                {datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            {ds && (
              <>
                <div className="row-actions" style={{ marginBottom: 8 }}>
                  <button type="button" className="btn ghost" onClick={resuggest}>
                    Предложить снова
                  </button>
                  <span className="muted">
                    {ds.rows.length} строк · {ds.columns.length} колонок
                  </span>
                </div>
                <table className="etl-roles-table">
                  <thead>
                    <tr>
                      <th>Поле</th>
                      <th>Роль</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ds.columns.map((c) => (
                      <tr key={c}>
                        <td>{c}</td>
                        <td>
                          <select
                            value={ds.fieldRoles?.[c] || 'dimension'}
                            onChange={(e) => setRole(c, e.target.value as FieldRole)}
                          >
                            {(Object.keys(ROLE_LABELS) as FieldRole[]).map((r) => (
                              <option key={r} value={r}>
                                {ROLE_LABELS[r]}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
            {!ds && <p className="warn">Сначала загрузите данные и нажмите «Обновить данные».</p>}
          </section>

          <section className="etl-section">
            <h3>Вычисляемые поля</h3>
            <p className="hint">
              Прирост / вклад (как в standalone), ISO-неделя, отношение, год/месяц. Считаются при
              обновлении и доступны как меры/измерения.
            </p>
            {ds && (
              <>
                <label>
                  Имя поля
                  <input
                    value={calcDraft.name}
                    onChange={(e) => setCalcDraft((d) => ({ ...d, name: e.target.value }))}
                    placeholder={
                      calcDraft.kind === 'growth'
                        ? 'prirost_pct'
                        : calcDraft.kind === 'growth_contrib'
                          ? 'vklad_pct'
                          : calcDraft.kind === 'iso_week'
                            ? 'iso_week'
                            : 'calc_field'
                    }
                  />
                </label>
                <label>
                  Тип
                  <select
                    value={calcDraft.kind}
                    onChange={(e) =>
                      setCalcDraft((d) => ({
                        ...d,
                        kind: e.target.value as CalculatedField['kind'],
                        withYear:
                          e.target.value === 'iso_week' ? d.withYear : false,
                      }))
                    }
                  >
                    {CALC_KIND_ORDER.map((k) => (
                      <option key={k} value={k}>
                        {CALC_KIND_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </label>
                {calcDraft.kind === 'growth' && (
                  <p className="hint">Формула: (X_отчёт − X_база) / X_база × 100</p>
                )}
                {calcDraft.kind === 'growth_contrib' && (
                  <p className="hint">
                    Формула: (X_отчёт − X_база) / Σ(X_база) × 100 — вклад строки в общий прирост
                  </p>
                )}
                {calcDraft.kind !== 'const' && (
                  <FieldSelect
                    label={fieldALabel}
                    dataset={ds}
                    value={calcDraft.a || ''}
                    onChange={(a) => setCalcDraft((d) => ({ ...d, a }))}
                    roles={isDateKind ? 'date' : 'measure'}
                  />
                )}
                {needsBase && (
                  <FieldSelect
                    label={fieldBLabel}
                    dataset={ds}
                    value={calcDraft.b || ''}
                    onChange={(b) => setCalcDraft((d) => ({ ...d, b }))}
                    roles="measure"
                  />
                )}
                {calcDraft.kind === 'iso_week' && (
                  <label className="field-inline">
                    <input
                      type="checkbox"
                      checked={!!calcDraft.withYear}
                      onChange={(e) =>
                        setCalcDraft((d) => ({ ...d, withYear: e.target.checked }))
                      }
                    />
                    С ISO-годом (формат YYYY.WW, как в standalone)
                  </label>
                )}
                {calcDraft.kind === 'const' && (
                  <label>
                    Значение
                    <input
                      type="number"
                      value={calcDraft.value ?? 0}
                      onChange={(e) =>
                        setCalcDraft((d) => ({ ...d, value: Number(e.target.value) }))
                      }
                    />
                  </label>
                )}
                <button type="button" className="btn primary" onClick={addCalc}>
                  Добавить поле
                </button>
                <ul className="source-list" style={{ marginTop: 12 }}>
                  {(ds.calculatedFields || []).map((c) => (
                    <li key={c.id}>
                      <div className="source-head">
                        <strong>
                          {c.name}{' '}
                          <span className="muted">
                            ({CALC_KIND_LABELS[c.kind]}
                            {c.kind === 'iso_week' && c.withYear ? ', YYYY.WW' : ''}
                            {c.kind === 'growth' || c.kind === 'growth_contrib'
                              ? `: ${c.a || '?'} vs ${c.b || '?'}`
                              : ''}
                            )
                          </span>
                        </strong>
                        <button type="button" className="btn ghost" onClick={() => removeCalc(c.id)}>
                          ×
                        </button>
                      </div>
                    </li>
                  ))}
                  {!(ds.calculatedFields || []).length && (
                    <li className="muted">Пока нет вычисляемых полей</li>
                  )}
                </ul>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

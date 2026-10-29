import { useMemo, useRef, useState } from 'react';
import { useStudioStore } from '../store/useStudioStore';
import type { CalculatedField, FieldRole, SourceMssql } from '../shared/types';
import {
  CALC_KIND_LABELS,
  ROLE_LABELS,
  applyCalculatedFields,
  suggestFieldRoles,
} from '../shared/fieldMeta';
import { refreshDatasets } from './api';
import { FieldSelect } from './FieldSelect';

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
    kind: 'ratio',
    a: '',
    b: '',
  });

  const ds = useMemo(
    () => datasets.find((d) => d.id === datasetId) || datasets[0],
    [datasets, datasetId],
  );

  const onRefresh = async () => {
    setRefreshing(true);
    setLastError(null);
    try {
      const { datasets: next, warnings } = await refreshDatasets(sources, pipelines);
      setDatasets(next);
      if (warnings?.length) setLastError(warnings.join('\n'));
      if (next[0] && !datasetId) setDatasetId(next[0].id);
    } catch (e) {
      setLastError(e instanceof Error ? e.message : String(e));
    } finally {
      setRefreshing(false);
    }
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
    setCalcDraft({ name: '', kind: 'ratio', a: '', b: '' });
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
            <div className="row-actions">
              <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
                + CSV
              </button>
              <button type="button" className="btn ghost" onClick={() => setShowMssql((v) => !v)}>
                + MSSQL
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                hidden
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const text = await file.text();
                  addCsvSource(file.name.replace(/\.csv$/i, ''), file.name, text);
                  e.target.value = '';
                }}
              />
            </div>
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
                    <div className="muted">{(s as { fileName?: string }).fileName}</div>
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
              Простые выражения: отношение, разница, год/месяц из даты. Сохраняются с датасетом.
            </p>
            {ds && (
              <>
                <label>
                  Имя поля
                  <input
                    value={calcDraft.name}
                    onChange={(e) => setCalcDraft((d) => ({ ...d, name: e.target.value }))}
                    placeholder="margin_pct"
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
                      }))
                    }
                  >
                    {(Object.keys(CALC_KIND_LABELS) as CalculatedField['kind'][]).map((k) => (
                      <option key={k} value={k}>
                        {CALC_KIND_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </label>
                {calcDraft.kind !== 'const' && (
                  <FieldSelect
                    label={calcDraft.kind === 'year' || calcDraft.kind === 'month' ? 'Дата' : 'Поле A'}
                    dataset={ds}
                    value={calcDraft.a || ''}
                    onChange={(a) => setCalcDraft((d) => ({ ...d, a }))}
                    roles={
                      calcDraft.kind === 'year' || calcDraft.kind === 'month'
                        ? 'date'
                        : ['measure', 'dimension']
                    }
                  />
                )}
                {(calcDraft.kind === 'ratio' ||
                  calcDraft.kind === 'pct' ||
                  calcDraft.kind === 'delta') && (
                  <FieldSelect
                    label="Поле B"
                    dataset={ds}
                    value={calcDraft.b || ''}
                    onChange={(b) => setCalcDraft((d) => ({ ...d, b }))}
                    roles={['measure', 'dimension']}
                  />
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
                          <span className="muted">({CALC_KIND_LABELS[c.kind]})</span>
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

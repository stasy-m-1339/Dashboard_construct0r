import { useRef, useState } from 'react';
import { useStudioStore } from '../store/useStudioStore';
import type { PipelineStep, SourceMssql } from '../shared/types';

function uid(prefix = 'step'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function DataPanel() {
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
  const fileRef = useRef<HTMLInputElement>(null);
  const [showMssql, setShowMssql] = useState(false);
  const [mssqlForm, setMssqlForm] = useState({
    name: 'MSSQL',
    server: '',
    database: '',
    user: '',
    password: '',
    port: 1433,
  });

  const patchStep = (pipelineId: string, stepId: string, patch: Partial<PipelineStep>) => {
    const pipeline = pipelines.find((p) => p.id === pipelineId);
    if (!pipeline) return;
    updatePipeline(pipelineId, {
      steps: pipeline.steps.map((st) =>
        st.id === stepId ? ({ ...st, ...patch } as PipelineStep) : st,
      ),
    });
  };

  const addStep = (pipelineId: string, type: PipelineStep['type']) => {
    const pipeline = pipelines.find((p) => p.id === pipelineId);
    if (!pipeline) return;
    let step: PipelineStep;
    switch (type) {
      case 'select-columns':
        step = { id: uid(), type, columns: [] };
        break;
      case 'filter-rows':
        step = { id: uid(), type, column: '', op: 'eq', value: '' };
        break;
      case 'join':
        step = {
          id: uid(),
          type,
          rightSourceId: sources.find((s) => s.id !== pipeline.sourceId)?.id || '',
          leftKey: '',
          rightKey: '',
          how: 'left',
        };
        break;
      case 'aggregate':
        step = {
          id: uid(),
          type,
          groupBy: [],
          metrics: [{ column: '', fn: 'sum', as: 'sum_value' }],
        };
        break;
      case 'sql':
        step = { id: uid(), type, query: 'SELECT TOP 100 * FROM dbo.YourTable' };
        break;
    }
    updatePipeline(pipelineId, { steps: [...pipeline.steps, step] });
  };

  const removeStep = (pipelineId: string, stepId: string) => {
    const pipeline = pipelines.find((p) => p.id === pipelineId);
    if (!pipeline) return;
    updatePipeline(pipelineId, { steps: pipeline.steps.filter((s) => s.id !== stepId) });
  };

  return (
    <aside className="panel data-panel">
      <h2>Данные</h2>
      <p className="hint">
        Источники и пайплайны. Секреты MSSQL остаются только в студии и не попадают в HTML.
      </p>

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
              ['name', 'Название'],
              ['server', 'Сервер'],
              ['database', 'База'],
              ['user', 'Логин'],
              ['password', 'Пароль'],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                type={key === 'password' ? 'password' : 'text'}
                value={mssqlForm[key]}
                onChange={(e) => setMssqlForm((f) => ({ ...f, [key]: e.target.value }))}
                autoComplete="off"
              />
            </label>
          ))}
          <label>
            Порт
            <input
              type="number"
              value={mssqlForm.port}
              onChange={(e) => setMssqlForm((f) => ({ ...f, port: Number(e.target.value) || 1433 }))}
            />
          </label>
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              if (!mssqlForm.server || !mssqlForm.database) return;
              addMssqlSource({
                name: mssqlForm.name,
                server: mssqlForm.server,
                database: mssqlForm.database,
                user: mssqlForm.user,
                password: mssqlForm.password,
                port: mssqlForm.port,
                trustServerCertificate: true,
              });
              setShowMssql(false);
              setMssqlForm({
                name: 'MSSQL',
                server: '',
                database: '',
                user: '',
                password: '',
                port: 1433,
              });
            }}
          >
            Сохранить подключение
          </button>
        </div>
      )}

      <h3>Источники</h3>
      <ul className="source-list">
        {sources.map((s) => (
          <li key={s.id}>
            <div className="source-head">
              <strong>
                {s.type === 'csv' ? 'CSV' : 'MSSQL'}: {s.name}
              </strong>
              <button type="button" className="btn ghost" onClick={() => removeSource(s.id)}>
                Удалить
              </button>
            </div>
            {s.type === 'mssql' && (
              <details>
                <summary>Параметры (пароль не экспортируется)</summary>
                <label>
                  Сервер
                  <input
                    value={s.server}
                    onChange={(e) => updateSource(s.id, { server: e.target.value })}
                  />
                </label>
                <label>
                  База
                  <input
                    value={s.database}
                    onChange={(e) => updateSource(s.id, { database: e.target.value })}
                  />
                </label>
                <label>
                  Логин
                  <input
                    value={s.user}
                    onChange={(e) => updateSource(s.id, { user: e.target.value })}
                  />
                </label>
                <label>
                  Пароль
                  <input
                    type="password"
                    value={(s as SourceMssql).password}
                    onChange={(e) => updateSource(s.id, { password: e.target.value })}
                    autoComplete="off"
                  />
                </label>
              </details>
            )}
            {s.type === 'csv' && <div className="muted">{s.fileName}</div>}
          </li>
        ))}
        {!sources.length && <li className="muted">Пока нет источников</li>}
      </ul>

      <h3>Пайплайны → датасеты</h3>
      <div className="row-actions">
        <button
          type="button"
          className="btn ghost"
          disabled={!sources.length}
          onClick={() => addPipeline()}
        >
          + Пайплайн
        </button>
      </div>
      <ul className="source-list">
        {pipelines.map((p) => {
          const source = sources.find((s) => s.id === p.sourceId);
          return (
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
                  {sources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.type.toUpperCase()}: {s.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="steps">
                <div className="muted" style={{ marginBottom: 6 }}>
                  Шаги (колонки → фильтр → join → агрегация
                  {source?.type === 'mssql' ? ' / SQL' : ''})
                </div>
                {p.steps.map((st, idx) => (
                  <div key={st.id} className="step-card">
                    <div className="source-head">
                      <strong>
                        {idx + 1}.{' '}
                        {st.type === 'select-columns'
                          ? 'Колонки'
                          : st.type === 'filter-rows'
                            ? 'Фильтр строк'
                            : st.type === 'join'
                              ? 'Join'
                              : st.type === 'aggregate'
                                ? 'Агрегация'
                                : 'SQL'}
                      </strong>
                      <button
                        type="button"
                        className="btn ghost"
                        onClick={() => removeStep(p.id, st.id)}
                      >
                        ×
                      </button>
                    </div>

                    {st.type === 'sql' && (
                      <label>
                        SQL-запрос
                        <textarea
                          rows={3}
                          value={st.query}
                          onChange={(e) => patchStep(p.id, st.id, { query: e.target.value })}
                        />
                      </label>
                    )}

                    {st.type === 'select-columns' && (
                      <label>
                        Колонки через запятую
                        <input
                          value={st.columns.join(', ')}
                          placeholder="date, region, amount"
                          onChange={(e) =>
                            patchStep(p.id, st.id, {
                              columns: e.target.value
                                .split(',')
                                .map((x) => x.trim())
                                .filter(Boolean),
                            })
                          }
                        />
                      </label>
                    )}

                    {st.type === 'filter-rows' && (
                      <>
                        <label>
                          Колонка
                          <input
                            value={st.column}
                            onChange={(e) => patchStep(p.id, st.id, { column: e.target.value })}
                          />
                        </label>
                        <label>
                          Условие
                          <select
                            value={st.op}
                            onChange={(e) =>
                              patchStep(p.id, st.id, {
                                op: e.target.value as typeof st.op,
                              })
                            }
                          >
                            <option value="eq">равно</option>
                            <option value="neq">не равно</option>
                            <option value="contains">содержит</option>
                            <option value="gt">больше</option>
                            <option value="lt">меньше</option>
                          </select>
                        </label>
                        <label>
                          Значение
                          <input
                            value={st.value}
                            onChange={(e) => patchStep(p.id, st.id, { value: e.target.value })}
                          />
                        </label>
                      </>
                    )}

                    {st.type === 'join' && (
                      <>
                        <label>
                          Правый источник
                          <select
                            value={st.rightSourceId}
                            onChange={(e) =>
                              patchStep(p.id, st.id, { rightSourceId: e.target.value })
                            }
                          >
                            <option value="">—</option>
                            {sources
                              .filter((s) => s.id !== p.sourceId)
                              .map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                          </select>
                        </label>
                        <label>
                          Ключ слева
                          <input
                            value={st.leftKey}
                            onChange={(e) => patchStep(p.id, st.id, { leftKey: e.target.value })}
                          />
                        </label>
                        <label>
                          Ключ справа
                          <input
                            value={st.rightKey}
                            onChange={(e) => patchStep(p.id, st.id, { rightKey: e.target.value })}
                          />
                        </label>
                        <label>
                          Тип
                          <select
                            value={st.how}
                            onChange={(e) =>
                              patchStep(p.id, st.id, {
                                how: e.target.value as 'left' | 'inner',
                              })
                            }
                          >
                            <option value="left">left</option>
                            <option value="inner">inner</option>
                          </select>
                        </label>
                      </>
                    )}

                    {st.type === 'aggregate' && (
                      <>
                        <label>
                          Группировка (колонки через запятую)
                          <input
                            value={st.groupBy.join(', ')}
                            onChange={(e) =>
                              patchStep(p.id, st.id, {
                                groupBy: e.target.value
                                  .split(',')
                                  .map((x) => x.trim())
                                  .filter(Boolean),
                              })
                            }
                          />
                        </label>
                        <label>
                          Метрика: колонка
                          <input
                            value={st.metrics[0]?.column || ''}
                            onChange={(e) =>
                              patchStep(p.id, st.id, {
                                metrics: [
                                  {
                                    column: e.target.value,
                                    fn: st.metrics[0]?.fn || 'sum',
                                    as: st.metrics[0]?.as || 'sum_value',
                                  },
                                ],
                              })
                            }
                          />
                        </label>
                        <label>
                          Функция
                          <select
                            value={st.metrics[0]?.fn || 'sum'}
                            onChange={(e) =>
                              patchStep(p.id, st.id, {
                                metrics: [
                                  {
                                    column: st.metrics[0]?.column || '',
                                    fn: e.target.value as 'sum' | 'avg' | 'count' | 'min' | 'max',
                                    as: st.metrics[0]?.as || `${e.target.value}_value`,
                                  },
                                ],
                              })
                            }
                          >
                            <option value="sum">sum</option>
                            <option value="avg">avg</option>
                            <option value="count">count</option>
                            <option value="min">min</option>
                            <option value="max">max</option>
                          </select>
                        </label>
                        <label>
                          Имя результата
                          <input
                            value={st.metrics[0]?.as || ''}
                            onChange={(e) =>
                              patchStep(p.id, st.id, {
                                metrics: [
                                  {
                                    column: st.metrics[0]?.column || '',
                                    fn: st.metrics[0]?.fn || 'sum',
                                    as: e.target.value,
                                  },
                                ],
                              })
                            }
                          />
                        </label>
                      </>
                    )}
                  </div>
                ))}

                <div className="row-actions">
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => addStep(p.id, 'select-columns')}
                  >
                    + Колонки
                  </button>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => addStep(p.id, 'filter-rows')}
                  >
                    + Фильтр
                  </button>
                  <button type="button" className="btn ghost" onClick={() => addStep(p.id, 'join')}>
                    + Join
                  </button>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => addStep(p.id, 'aggregate')}
                  >
                    + Агрегация
                  </button>
                  {source?.type === 'mssql' && (
                    <button type="button" className="btn ghost" onClick={() => addStep(p.id, 'sql')}>
                      + SQL
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
        {!pipelines.length && <li className="muted">Добавьте источник — пайплайн создастся сам</li>}
      </ul>

      <h3>Снимок данных</h3>
      <ul className="source-list">
        {datasets.map((d) => {
          const bytes = JSON.stringify(d).length;
          return (
            <li key={d.id}>
              <strong>{d.name}</strong>
              <div className="muted">
                {d.rows.length} строк · {d.columns.length} колонок · ~{Math.round(bytes / 1024)} КБ
                {d.updatedAt ? ` · ${new Date(d.updatedAt).toLocaleString('ru-RU')}` : ''}
              </div>
              {bytes > 2_000_000 && (
                <div className="warn">Большой снимок — HTML будет тяжёлым</div>
              )}
            </li>
          );
        })}
        {!datasets.length && (
          <li className="muted">Нажмите «Обновить данные» на панели сверху</li>
        )}
      </ul>
    </aside>
  );
}

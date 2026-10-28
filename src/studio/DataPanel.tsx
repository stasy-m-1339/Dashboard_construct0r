import { useRef, useState } from 'react';
import { useStudioStore } from '../store/useStudioStore';
import type { SourceMssql } from '../shared/types';

export function DataPanel() {
  const sources = useStudioStore((s) => s.sources);
  const pipelines = useStudioStore((s) => s.pipelines);
  const datasets = useStudioStore((s) => s.datasets);
  const addCsvSource = useStudioStore((s) => s.addCsvSource);
  const addMssqlSource = useStudioStore((s) => s.addMssqlSource);
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
            {s.type === 'csv' && (
              <div className="muted">{s.fileName}</div>
            )}
          </li>
        ))}
        {!sources.length && <li className="muted">Пока нет источников</li>}
      </ul>

      <h3>Пайплайны → датасеты</h3>
      <ul className="source-list">
        {pipelines.map((p) => {
          const sqlStep = p.steps.find((st) => st.type === 'sql');
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
              {sqlStep && sqlStep.type === 'sql' && (
                <label>
                  SQL-запрос
                  <textarea
                    rows={3}
                    value={sqlStep.query}
                    onChange={(e) =>
                      updatePipeline(p.id, {
                        steps: p.steps.map((st) =>
                          st.id === sqlStep.id ? { ...st, query: e.target.value } : st,
                        ),
                      })
                    }
                  />
                </label>
              )}
            </li>
          );
        })}
      </ul>

      <h3>Снимок данных</h3>
      <ul className="source-list">
        {datasets.map((d) => (
          <li key={d.id}>
            <strong>{d.name}</strong>
            <div className="muted">
              {d.rows.length} строк · {d.columns.length} колонок
              {d.updatedAt ? ` · ${new Date(d.updatedAt).toLocaleString('ru-RU')}` : ''}
            </div>
          </li>
        ))}
        {!datasets.length && (
          <li className="muted">Нажмите «Обновить данные» на панели сверху</li>
        )}
      </ul>
    </aside>
  );
}

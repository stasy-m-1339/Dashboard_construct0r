import { useMemo, useState } from 'react';
import { BLOCK_LIBRARY } from '../shared/blocks';
import { getDashboardLibrary, getFilterLibrary } from '../shared/libraries';
import { THEMES, CHART_PALETTES, BRAND } from '../shared/themes';
import { useStudioStore } from '../store/useStudioStore';
import type { BlockPreset } from '../shared/types';

export type LibraryKind = 'widgets' | 'filters' | 'styles';

interface Props {
  kind: LibraryKind;
  onClose: () => void;
}

const TITLES: Record<LibraryKind, string> = {
  widgets: 'Добавить виджет',
  filters: 'Добавить элемент фильтра',
  styles: 'Стили и палитры',
};

function JsonImportHint() {
  const importBlockJson = useStudioStore((s) => s.importBlockJson);
  const setLastError = useStudioStore((s) => s.setLastError);
  const [text, setText] = useState('');
  return (
    <div style={{ marginTop: 14 }}>
      <h3 style={{ fontSize: 12, color: '#685e5f', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        Импорт JSON (внешний ИИ)
      </h3>
      <textarea
        className="paste-area"
        rows={3}
        placeholder='{"type":"kpi","title":"..."}'
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button
        type="button"
        className="btn"
        disabled={!text.trim()}
        onClick={() => {
          try {
            const err = importBlockJson(JSON.parse(text));
            if (err) setLastError(err);
            else {
              setText('');
              setLastError(null);
            }
          } catch {
            setLastError('Некорректный JSON');
          }
        }}
      >
        Добавить в библиотеку
      </button>
    </div>
  );
}

export function LibraryModal({ kind, onClose }: Props) {
  const customBlocks = useStudioStore((s) => s.customBlocks);
  const datasets = useStudioStore((s) => s.datasets);
  const addWidgetFromLibrary = useStudioStore((s) => s.addWidgetFromLibrary);
  const setThemeId = useStudioStore((s) => s.setThemeId);
  const setChartPaletteId = useStudioStore((s) => s.setChartPaletteId);
  const themeId = useStudioStore((s) => s.dashboard.themeId);
  const chartPaletteId = useStudioStore((s) => s.dashboard.chartPaletteId);
  const setShowFiltersPanel = useStudioStore((s) => s.setShowFiltersPanel);
  const updateWidget = useStudioStore((s) => s.updateWidget);
  const [picked, setPicked] = useState<BlockPreset | null>(null);
  const [cfg, setCfg] = useState({
    datasetId: datasets[0]?.id || '',
    categoryColumn: '',
    valueColumn: '',
    compareColumn: '',
    filterColumn: '',
    rowColumn: '',
    colColumn: '',
    label: '',
  });

  const items = useMemo(() => {
    if (kind === 'filters') return getFilterLibrary(customBlocks);
    return getDashboardLibrary(customBlocks);
  }, [kind, customBlocks]);

  const cols = datasets.find((d) => d.id === cfg.datasetId)?.columns || [];

  const applyPick = (preset: BlockPreset) => {
    setPicked(preset);
    const ds = datasets[0];
    setCfg({
      datasetId: ds?.id || '',
      categoryColumn: ds?.columns[0] || '',
      valueColumn: ds?.columns[1] || ds?.columns[0] || '',
      compareColumn: ds?.columns[2] || ds?.columns[1] || '',
      filterColumn: ds?.columns[0] || '',
      rowColumn: ds?.columns[0] || '',
      colColumn: ds?.columns[2] || ds?.columns[1] || '',
      label: preset.defaultBinding.label || preset.title,
    });
  };

  const confirmAdd = () => {
    if (!picked) return;
    const known =
      BLOCK_LIBRARY.some((b) => b.id === picked.id) ||
      customBlocks.some((b) => b.id === picked.id);
    if (!known) {
      useStudioStore.getState().addCustomBlock(picked);
    }
    addWidgetFromLibrary(picked.id);

    const state = useStudioStore.getState();
    const tab = state.dashboard.tabs.find((t) => t.id === state.dashboard.activeTabId);
    const last = tab?.widgets[tab.widgets.length - 1];
    if (last) {
      updateWidget(last.id, {
        title: picked.title,
        binding: {
          ...last.binding,
          datasetId: cfg.datasetId || last.binding.datasetId,
          categoryColumn: cfg.categoryColumn || last.binding.categoryColumn,
          valueColumn: cfg.valueColumn || last.binding.valueColumn,
          compareColumn: cfg.compareColumn || last.binding.compareColumn,
          lineColumn:
            picked.type === 'combo'
              ? cfg.compareColumn || last.binding.lineColumn
              : last.binding.lineColumn,
          filterColumn: cfg.filterColumn || last.binding.filterColumn,
          rowColumn: cfg.rowColumn || last.binding.rowColumn,
          colColumn: cfg.colColumn || last.binding.colColumn,
          label: cfg.label || last.binding.label,
          showTotals: picked.defaultBinding.showTotals,
          tone: picked.defaultBinding.tone,
          format: picked.defaultBinding.format,
          badge: picked.defaultBinding.badge,
          maxItems: picked.defaultBinding.maxItems,
          columns: picked.type === 'table' ? cols : last.binding.columns,
        },
      });
    }
    if (kind === 'filters') setShowFiltersPanel(true);
    onClose();
  };

  if (kind === 'styles') {
    const themePreferred = THEMES.find((t) => t.id === themeId)?.preferredPaletteId;
    const activePalette = chartPaletteId || themePreferred;

    return (
      <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
        <div className="modal-card styles-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-head">
            <h2>{TITLES.styles}</h2>
            <button type="button" className="btn ghost" onClick={onClose}>
              Закрыть
            </button>
          </div>
          <p className="hint">
            Тема оформления и отдельно палитра рядов графика. По умолчанию — Wide Light.
          </p>

          <h3 className="styles-section-title">Темы</h3>
          <div className="theme-grid">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`theme-card${themeId === t.id ? ' active' : ''}`}
                onClick={() => setThemeId(t.id)}
              >
                <div
                  className="theme-swatch"
                  style={{
                    background: t.background,
                    borderColor: t.border,
                    boxShadow: t.shadow && t.shadow !== 'none' ? t.shadow : undefined,
                    borderRadius: t.radius ?? 8,
                  }}
                >
                  <span style={{ background: t.accent }} />
                  <span style={{ background: t.surface, border: `1px solid ${t.border}` }} />
                  <span style={{ background: t.muted }} />
                </div>
                <strong>{t.name}</strong>
                {t.description && <span className="theme-desc">{t.description}</span>}
              </button>
            ))}
          </div>

          <h3 className="styles-section-title">Палитры графиков</h3>
          <p className="hint">
            Задают цвета серий (и акцент). Можно выбрать независимо от темы; тема Tableau
            подставляет Tableau 10.
          </p>
          <div className="theme-grid palette-grid">
            {CHART_PALETTES.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`theme-card${activePalette === p.id ? ' active' : ''}`}
                onClick={() => setChartPaletteId(p.id)}
              >
                <div className="palette-swatch-row">
                  {p.colors.slice(0, 10).map((c) => (
                    <span key={c} style={{ background: c }} title={c} />
                  ))}
                </div>
                <strong>{p.name}</strong>
                {p.description && <span className="theme-desc">{p.description}</span>}
              </button>
            ))}
          </div>

          <div className="palette-strip" aria-hidden>
            <span style={{ background: BRAND.primary }} title="primary" />
            <span style={{ background: BRAND.teal700 }} title="teal" />
            <span style={{ background: BRAND.sand500 }} title="sand" />
            <span style={{ background: BRAND.wine500 }} title="wine" />
            <span style={{ background: BRAND.plum700 }} title="plum" />
            <span style={{ background: BRAND.blue700 }} title="blue" />
            <span style={{ background: BRAND.bg }} title="bg" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-card wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{picked ? `Настройка: ${picked.title}` : TITLES[kind]}</h2>
          <button type="button" className="btn ghost" onClick={onClose}>
            Закрыть
          </button>
        </div>

        {!picked ? (
          <>
            <p className="hint">Выберите элемент, затем укажите данные и нажмите «Добавить».</p>
            <ul className="modal-block-list">
              {items.map((b) => (
                <li key={b.id}>
                  <button type="button" className="block-item" onClick={() => applyPick(b)}>
                    <strong>{b.title}</strong>
                    <span>{b.description}</span>
                    <span className="block-id">{b.id}</span>
                  </button>
                </li>
              ))}
            </ul>
            {kind === 'widgets' && <JsonImportHint />}
          </>
        ) : (
          <div className="modal-config">
            <p className="hint">{picked.description}</p>
            <label>
              Датасет
              <select
                value={cfg.datasetId}
                onChange={(e) => setCfg((c) => ({ ...c, datasetId: e.target.value }))}
              >
                <option value="">—</option>
                {datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            {kind === 'filters' ? (
              <label>
                Колонка фильтра
                <select
                  value={cfg.filterColumn}
                  onChange={(e) => setCfg((c) => ({ ...c, filterColumn: e.target.value }))}
                >
                  <option value="">—</option>
                  {cols.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            ) : picked.type === 'matrix' ? (
              <>
                <label>
                  Строки
                  <select
                    value={cfg.rowColumn}
                    onChange={(e) => setCfg((c) => ({ ...c, rowColumn: e.target.value }))}
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
                    value={cfg.colColumn}
                    onChange={(e) => setCfg((c) => ({ ...c, colColumn: e.target.value }))}
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
                  Значение (сумма)
                  <select
                    value={cfg.valueColumn}
                    onChange={(e) => setCfg((c) => ({ ...c, valueColumn: e.target.value }))}
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
            ) : (
              <>
                {!['kpi', 'kpi-delta'].includes(picked.type) && (
                  <label>
                    Категория
                    <select
                      value={cfg.categoryColumn}
                      onChange={(e) => setCfg((c) => ({ ...c, categoryColumn: e.target.value }))}
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
                    value={cfg.valueColumn}
                    onChange={(e) => setCfg((c) => ({ ...c, valueColumn: e.target.value }))}
                  >
                    <option value="">—</option>
                    {cols.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
                {(picked.type === 'kpi-delta' || picked.type === 'combo') && (
                  <label>
                    Сравнение / линия
                    <select
                      value={cfg.compareColumn}
                      onChange={(e) => setCfg((c) => ({ ...c, compareColumn: e.target.value }))}
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
              </>
            )}
            <label>
              Подпись
              <input
                value={cfg.label}
                onChange={(e) => setCfg((c) => ({ ...c, label: e.target.value }))}
              />
            </label>
            <div className="row-actions">
              <button type="button" className="btn ghost" onClick={() => setPicked(null)}>
                ← Назад
              </button>
              <button type="button" className="btn primary" onClick={confirmAdd}>
                Добавить
              </button>
            </div>
            {!datasets.length && (
              <p className="warn">Сначала загрузите данные (Демо CSV или «Обновить данные»).</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

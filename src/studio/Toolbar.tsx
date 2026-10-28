import { useStudioStore } from '../store/useStudioStore';
import { THEMES } from '../shared/themes';
import { getTheme } from '../shared/themes';
import { downloadTextFile, exportHtml, fetchSampleCsv, refreshDatasets } from './api';

export function Toolbar() {
  const title = useStudioStore((s) => s.dashboard.title);
  const themeId = useStudioStore((s) => s.dashboard.themeId);
  const setTitle = useStudioStore((s) => s.setTitle);
  const setThemeId = useStudioStore((s) => s.setThemeId);
  const previewMode = useStudioStore((s) => s.previewMode);
  const setPreviewMode = useStudioStore((s) => s.setPreviewMode);
  const sources = useStudioStore((s) => s.sources);
  const pipelines = useStudioStore((s) => s.pipelines);
  const datasets = useStudioStore((s) => s.datasets);
  const dashboard = useStudioStore((s) => s.dashboard);
  const setDatasets = useStudioStore((s) => s.setDatasets);
  const setLastError = useStudioStore((s) => s.setLastError);
  const setRefreshing = useStudioStore((s) => s.setRefreshing);
  const refreshing = useStudioStore((s) => s.refreshing);
  const addCsvSource = useStudioStore((s) => s.addCsvSource);

  const onRefresh = async () => {
    setRefreshing(true);
    setLastError(null);
    try {
      const { datasets: next, warnings } = await refreshDatasets(sources, pipelines);
      setDatasets(next);
      if (warnings.length) setLastError(warnings.join('\n'));
    } catch (e) {
      setLastError(e instanceof Error ? e.message : String(e));
    } finally {
      setRefreshing(false);
    }
  };

  const onExport = async () => {
    setLastError(null);
    try {
      if (!datasets.length) {
        setLastError('Сначала нажмите «Обновить данные», чтобы подготовить снимок.');
        return;
      }
      const snapBytes = JSON.stringify(datasets).length;
      const localWarnings: string[] = [];
      if (snapBytes > 2_000_000) {
        localWarnings.push(
          `Снимок данных ~${Math.round(snapBytes / 1024)} КБ — HTML может быть тяжёлым для браузера.`,
        );
      }
      // Publish payload: dashboard + datasets + theme only (no sources / passwords).
      const result = await exportHtml({
        version: 1,
        dashboard,
        datasets,
        theme: getTheme(dashboard.themeId),
      });
      const allWarnings = [...localWarnings, ...result.warnings];
      if (allWarnings.length) setLastError(allWarnings.join('\n'));
      downloadTextFile(
        result.fileName.endsWith('.html') ? result.fileName : `${result.fileName}.html`,
        result.html,
      );
    } catch (e) {
      setLastError(e instanceof Error ? e.message : String(e));
    }
  };

  const onDemo = async () => {
    setLastError(null);
    try {
      const csv = await fetchSampleCsv();
      addCsvSource('Продажи (демо)', 'sales.csv', csv);
      // refresh immediately
      const state = useStudioStore.getState();
      const { datasets: next, warnings } = await refreshDatasets(state.sources, state.pipelines);
      setDatasets(next);
      if (warnings.length) setLastError(warnings.join('\n'));
      useStudioStore.getState().loadDemo();
    } catch (e) {
      setLastError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <header className="toolbar">
      <div className="brand">
        <span className="brand-mark">DC</span>
        <input
          className="title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="Название дашборда"
        />
      </div>
      <div className="toolbar-actions">
        <label className="field-inline">
          Тема
          <select value={themeId} onChange={(e) => setThemeId(e.target.value)}>
            {THEMES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn ghost" onClick={onDemo}>
          Демо CSV
        </button>
        <button type="button" className="btn" disabled={refreshing} onClick={onRefresh}>
          {refreshing ? 'Обновление…' : 'Обновить данные'}
        </button>
        <button type="button" className="btn ghost" onClick={() => setPreviewMode(!previewMode)}>
          {previewMode ? 'Редактор' : 'Превью'}
        </button>
        <button type="button" className="btn primary" onClick={onExport}>
          Собрать HTML
        </button>
      </div>
    </header>
  );
}

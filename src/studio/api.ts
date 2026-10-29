import type { DataSource, Dataset, Pipeline, PublishedPayload } from '../shared/types';
import { parseCsvText, runPipelineOnRows } from '../shared/pipelineRunner';

/** In dev, Vite proxies /api → studio API. Override with VITE_API_URL if needed. */
const API = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || '';

/**
 * Detect a single header that still contains delimiters (failed parse).
 * Used after refresh so the UI can nudge the user to set `;` / `,` / tab.
 */
export function blobColumnWarnings(datasets: Dataset[]): string[] {
  const out: string[] = [];
  for (const ds of datasets) {
    const col = ds.columns[0] || '';
    if (ds.columns.length === 1 && /[;,\t]/.test(col)) {
      out.push(
        `Датасет «${ds.name}»: одна колонка «${col}». Выберите разделитель «;» у CSV-источника и снова «Обновить данные».`,
      );
    }
  }
  return out;
}

/**
 * Re-parse CSV sources in the browser (same parseCsvText as the API).
 * Avoids a stale `tsx` API process serving an old delimiter detector.
 * Always re-reads `source.content` — no dataset cache.
 */
function refreshCsvInBrowser(
  sources: DataSource[],
  pipelines: Pipeline[],
): { datasets: Dataset[]; warnings: string[] } {
  const warnings: string[] = [];
  const rawBySource: Record<string, { columns: string[]; rows: Dataset['rows'] }> = {};

  for (const source of sources) {
    if (source.type !== 'csv') {
      warnings.push(`Источник «${source.name}»: клиентский refresh только для CSV`);
      continue;
    }
    try {
      const parsed = parseCsvText(source.content, {
        delimiter: source.delimiter ?? 'auto',
      });
      rawBySource[source.id] = { columns: parsed.columns, rows: parsed.rows };
      if (parsed.columns.length <= 1 && /[;,\t]/.test(parsed.columns[0] || '')) {
        warnings.push(
          `CSV «${source.name}»: разделитель не сработал (получена 1 колонка). Смените разделитель и нажмите «Обновить данные».`,
        );
      }
    } catch (e) {
      warnings.push(`Источник «${source.name}»: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const datasets: Dataset[] = [];
  for (const pipeline of pipelines) {
    const source = sources.find((s) => s.id === pipeline.sourceId);
    if (!source) {
      warnings.push(`Источник для пайплайна «${pipeline.name}» не найден`);
      continue;
    }
    const base = rawBySource[source.id];
    if (!base) {
      warnings.push(`Нет данных для пайплайна «${pipeline.name}»`);
      continue;
    }
    try {
      const nonSql: Pipeline = {
        ...pipeline,
        steps: pipeline.steps.filter((s) => s.type !== 'sql'),
      };
      const dataset = runPipelineOnRows(base.rows, base.columns, nonSql, rawBySource);
      datasets.push(dataset);
      const size = JSON.stringify(dataset).length;
      if (size > 2_000_000) {
        warnings.push(
          `Датасет «${dataset.name}» большой (~${Math.round(size / 1024)} КБ). HTML может быть тяжёлым.`,
        );
      }
    } catch (e) {
      warnings.push(
        `Пайплайн «${pipeline.name}»: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  warnings.push(...blobColumnWarnings(datasets));
  return { datasets, warnings: [...new Set(warnings)] };
}

/**
 * Refresh datasets. CSV-only projects parse in the browser so delimiter fixes
 * apply immediately (Vite HMR). MSSQL still goes through `/api/refresh`.
 * Always re-sends full `sources` (incl. content + delimiter) — no cached parse.
 */
export async function refreshDatasets(
  sources: DataSource[],
  pipelines: Pipeline[],
): Promise<{ datasets: Dataset[]; warnings: string[] }> {
  const allCsv = sources.length > 0 && sources.every((s) => s.type === 'csv');
  if (allCsv) {
    return refreshCsvInBrowser(sources, pipelines);
  }

  const res = await fetch(`${API}/api/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sources, pipelines }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка обновления данных');
  const warnings = [...(data.warnings || []), ...blobColumnWarnings(data.datasets || [])];
  return { datasets: data.datasets, warnings: [...new Set(warnings)] };
}

export async function exportHtml(payload: PublishedPayload): Promise<{
  html: string;
  warnings: string[];
  byteLength: number;
  fileName: string;
}> {
  const res = await fetch(`${API}/api/export-html`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка сборки HTML');
  return data;
}

export async function fetchSampleCsv(): Promise<string> {
  const res = await fetch(`${API}/api/sample-csv`);
  if (!res.ok) throw new Error('Не удалось загрузить демо-CSV');
  return res.text();
}

/** Semicolon-delimited RU sample (Показатель;Месяц;…). */
export async function fetchSemicolonSampleCsv(): Promise<string> {
  const res = await fetch(`${API}/api/sample-semicolon-csv`);
  if (!res.ok) throw new Error('Не удалось загрузить semicolon CSV');
  return res.text();
}

export function downloadTextFile(fileName: string, content: string, mime = 'text/html') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

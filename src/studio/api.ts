import type { DataSource, Dataset, Pipeline, PublishedPayload } from '../shared/types';

/** In dev, Vite proxies /api → studio API. Override with VITE_API_URL if needed. */
const API = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || '';

export async function refreshDatasets(
  sources: DataSource[],
  pipelines: Pipeline[],
): Promise<{ datasets: Dataset[]; warnings: string[] }> {
  const res = await fetch(`${API}/api/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sources, pipelines }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка обновления данных');
  return data;
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

export function downloadTextFile(fileName: string, content: string, mime = 'text/html') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

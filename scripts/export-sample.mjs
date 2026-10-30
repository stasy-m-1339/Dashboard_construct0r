import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Papa from 'papaparse';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const csv = fs.readFileSync(path.join(root, 'samples', 'sales.csv'), 'utf8');
const templatePath = path.join(root, 'dist-viewer', 'index.html');

if (!fs.existsSync(templatePath)) {
  console.error('Run npm run build:viewer first');
  process.exit(1);
}

function detectCsvDelimiter(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 8);
  if (!lines.length) return ',';
  const count = (line, delim) => {
    let n = 0, q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (q && line[i + 1] === '"') i++;
        else q = !q;
      } else if (!q && ch === delim) n++;
    }
    return n;
  };
  let best = ',', bestScore = -1;
  for (const d of [';', ',', '\t']) {
    const counts = lines.map((l) => count(l, d) + 1);
    const first = counts[0];
    if (first < 2) continue;
    const score = counts.filter((c) => c === first).length * 100 + first;
    if (score > bestScore) { bestScore = score; best = d; }
  }
  return best;
}

function parseCsv(text) {
  const cleaned = text.replace(/^\uFEFF/, '');
  const parsed = Papa.parse(cleaned, {
    header: true,
    delimiter: detectCsvDelimiter(cleaned),
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
  });
  const columns = (parsed.meta.fields || []).map((c) => c.trim()).filter(Boolean);
  const rows = parsed.data.map((raw) => {
    const row = {};
    columns.forEach((col) => {
      const v = String(raw[col] ?? '').trim();
      const num = Number(v.replace(/\s/g, '').replace(',', '.'));
      row[col] = v !== '' && !Number.isNaN(num) && /^-?\d/.test(v) ? num : v;
    });
    return row;
  });
  return { columns, rows };
}

const { columns, rows } = parseCsv(csv);
const dsId = 'ds-sales';
const payload = {
  version: 1,
  dashboard: {
    id: 'demo',
    title: 'Демо: продажи',
    themeId: 'wide-light',
    activeTabId: 'tab1',
    tabs: [
      {
        id: 'tab1',
        title: 'Обзор',
        widgets: [
          {
            id: 'w1',
            type: 'kpi',
            title: 'Выручка',
            binding: { datasetId: dsId, valueColumn: 'amount', label: 'Сумма продаж' },
            layout: { x: 0, y: 0, w: 3, h: 2 },
          },
          {
            id: 'w2',
            type: 'filter-select',
            title: 'Регион',
            binding: { datasetId: dsId, filterColumn: 'region', label: 'Регион' },
            layout: { x: 3, y: 0, w: 3, h: 2 },
          },
          {
            id: 'w3',
            type: 'bar',
            title: 'Продажи по регионам',
            binding: { datasetId: dsId, categoryColumn: 'region', valueColumn: 'amount' },
            layout: { x: 0, y: 2, w: 6, h: 4 },
          },
          {
            id: 'w4',
            type: 'pie',
            title: 'По категориям',
            binding: { datasetId: dsId, categoryColumn: 'category', valueColumn: 'amount' },
            layout: { x: 6, y: 2, w: 6, h: 4 },
          },
          {
            id: 'w5',
            type: 'line',
            title: 'По дням',
            binding: { datasetId: dsId, categoryColumn: 'date', valueColumn: 'amount' },
            layout: { x: 0, y: 6, w: 8, h: 4 },
          },
          {
            id: 'w6',
            type: 'table',
            title: 'Детализация',
            binding: { datasetId: dsId, columns },
            layout: { x: 0, y: 10, w: 12, h: 5 },
          },
        ],
      },
    ],
  },
  datasets: [
    {
      id: dsId,
      name: 'Продажи (демо)',
      columns,
      rows,
      updatedAt: new Date().toISOString(),
    },
  ],
  theme: {
    id: 'wide-light',
    name: 'Wide Light',
    background: '#F3F1F0',
    surface: '#FFFFFF',
    text: '#2D2A2A',
    muted: '#685E5F',
    accent: '#02665E',
    border: '#DFDBDA',
    chartPalette: ['#02665E', '#3F827B', '#47698B', '#bbac9b', '#b26164', '#643D57', '#98B4B0', '#6B8DA9'],
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
  },
};

let html = fs.readFileSync(templatePath, 'utf8');
const injection = `<script>window.__DASHBOARD_PAYLOAD__=${JSON.stringify(payload)};</script>`;
html = html.includes('<!--DASHBOARD_PAYLOAD-->')
  ? html.replace('<!--DASHBOARD_PAYLOAD-->', injection)
  : html.replace('</head>', `${injection}</head>`);

const outDir = path.join(root, 'samples', 'exported');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, 'demo-sales.html');
fs.writeFileSync(outFile, html, 'utf8');
console.log(`Wrote ${outFile} (${Math.round(Buffer.byteLength(html) / 1024)} KB)`);

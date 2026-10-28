import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const csv = fs.readFileSync(path.join(root, 'samples', 'sales.csv'), 'utf8');
const templatePath = path.join(root, 'dist-viewer', 'index.html');

if (!fs.existsSync(templatePath)) {
  console.error('Run npm run build:viewer first');
  process.exit(1);
}

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim());
  const split = (line) => {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else cur += ch;
    }
    result.push(cur.trim());
    return result;
  };
  const columns = split(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const parts = split(line);
    const row = {};
    columns.forEach((col, idx) => {
      const raw = parts[idx] ?? '';
      const num = Number(String(raw).replace(/\s/g, '').replace(',', '.'));
      row[col] = raw !== '' && !Number.isNaN(num) && /^-?\d/.test(raw) ? num : raw;
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
    themeId: 'slate-teal',
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
    id: 'slate-teal',
    name: 'Сланец и бирюза',
    background: 'linear-gradient(160deg, #0f172a 0%, #134e4a 55%, #0f172a 100%)',
    surface: 'rgba(15, 23, 42, 0.72)',
    text: '#f1f5f9',
    muted: '#94a3b8',
    accent: '#2dd4bf',
    border: 'rgba(148, 163, 184, 0.28)',
    chartPalette: ['#2dd4bf', '#38bdf8', '#a78bfa', '#fbbf24', '#fb7185', '#34d399'],
    fontFamily: '"Segoe UI", "PT Sans", system-ui, sans-serif',
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

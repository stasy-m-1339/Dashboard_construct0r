import Papa from 'papaparse';
import type { Dataset, DatasetRow, Pipeline, PipelineStep } from './types';

export type TableSnapshot = { columns: string[]; rows: DatasetRow[] };

/** Count unquoted delimiter candidates in a sample line. */
function countDelims(line: string, delim: string): number {
  let n = 0;
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (!inQuotes && ch === delim) {
      n += 1;
    }
  }
  return n;
}

/**
 * Pick `;` / `,` / tab by majority votes on the first non-empty lines.
 * Falls back to comma.
 */
export function detectCsvDelimiter(text: string): ',' | ';' | '\t' {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 8);
  if (!lines.length) return ',';

  const candidates: Array<',' | ';' | '\t'> = [';', ',', '\t'];
  let best: ',' | ';' | '\t' = ',';
  let bestScore = -1;
  for (const d of candidates) {
    // Prefer delimiters that produce a stable column count > 1 across sample lines
    const counts = lines.map((l) => countDelims(l, d) + 1);
    const first = counts[0];
    if (first < 2) continue;
    const consistent = counts.filter((c) => c === first).length;
    const score = consistent * 100 + first;
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

function coerceCell(raw: string): string | number {
  const trimmed = raw.trim();
  if (trimmed === '') return '';
  // EU decimals often use comma when CSV is semicolon-separated
  const normalized = trimmed.replace(/\s/g, '').replace(',', '.');
  const num = Number(normalized);
  if (!Number.isNaN(num) && /^-?\d/.test(trimmed)) return num;
  return trimmed;
}

function applySelectColumns(rows: DatasetRow[], columns: string[]): DatasetRow[] {
  if (!columns.length) return rows;
  return rows.map((row) => {
    const next: DatasetRow = {};
    for (const c of columns) next[c] = row[c] ?? null;
    return next;
  });
}

function applyFilterRows(
  rows: DatasetRow[],
  step: Extract<PipelineStep, { type: 'filter-rows' }>,
): DatasetRow[] {
  return rows.filter((row) => {
    const cell = row[step.column];
    const cellStr = cell == null ? '' : String(cell);
    const num = Number(cell);
    const cmp = Number(step.value);
    switch (step.op) {
      case 'eq':
        return cellStr === step.value;
      case 'neq':
        return cellStr !== step.value;
      case 'contains':
        return cellStr.toLowerCase().includes(step.value.toLowerCase());
      case 'gt':
        return !Number.isNaN(num) && !Number.isNaN(cmp) && num > cmp;
      case 'lt':
        return !Number.isNaN(num) && !Number.isNaN(cmp) && num < cmp;
      default:
        return true;
    }
  });
}

function applyAggregate(
  rows: DatasetRow[],
  step: Extract<PipelineStep, { type: 'aggregate' }>,
): DatasetRow[] {
  const groups = new Map<string, DatasetRow[]>();
  for (const row of rows) {
    const key = step.groupBy.map((c: string) => String(row[c] ?? '')).join('\0');
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }
  const out: DatasetRow[] = [];
  for (const [, groupRows] of groups) {
    const result: DatasetRow = {};
    for (const c of step.groupBy) {
      result[c] = groupRows[0][c] ?? null;
    }
    for (const m of step.metrics) {
      const nums = groupRows
        .map((r) => Number(r[m.column]))
        .filter((n) => !Number.isNaN(n));
      let val: number;
      switch (m.fn) {
        case 'count':
          val = groupRows.length;
          break;
        case 'sum':
          val = nums.reduce((a, b) => a + b, 0);
          break;
        case 'avg':
          val = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
          break;
        case 'min':
          val = nums.length ? Math.min(...nums) : 0;
          break;
        case 'max':
          val = nums.length ? Math.max(...nums) : 0;
          break;
        default:
          val = 0;
      }
      result[m.as || `${m.fn}_${m.column}`] = Math.round(val * 1000) / 1000;
    }
    out.push(result);
  }
  return out;
}

function applyJoin(
  leftRows: DatasetRow[],
  leftCols: string[],
  step: Extract<PipelineStep, { type: 'join' }>,
  extras: Record<string, TableSnapshot>,
): { rows: DatasetRow[]; columns: string[] } {
  const right = extras[step.rightSourceId];
  if (!right) {
    throw new Error(`Join: правый источник «${step.rightSourceId}» не найден`);
  }
  const index = new Map<string, DatasetRow[]>();
  for (const row of right.rows) {
    const k = String(row[step.rightKey] ?? '');
    const list = index.get(k) ?? [];
    list.push(row);
    index.set(k, list);
  }

  const rightOnlyCols = right.columns.filter(
    (c) => c !== step.rightKey && !leftCols.includes(c),
  );
  const columns = [...leftCols, ...rightOnlyCols.filter((c) => !leftCols.includes(c))];
  const out: DatasetRow[] = [];

  for (const left of leftRows) {
    const k = String(left[step.leftKey] ?? '');
    const matches = index.get(k) || [];
    if (!matches.length) {
      if (step.how === 'left') {
        const row: DatasetRow = { ...left };
        for (const c of rightOnlyCols) row[c] = null;
        out.push(row);
      }
      continue;
    }
    for (const rightRow of matches) {
      const row: DatasetRow = { ...left };
      for (const c of rightOnlyCols) row[c] = rightRow[c] ?? null;
      out.push(row);
    }
  }
  return { rows: out, columns };
}

export function runPipelineOnRows(
  rows: DatasetRow[],
  columns: string[],
  pipeline: Pipeline,
  extras: Record<string, TableSnapshot> = {},
): Dataset {
  let current = rows;
  let cols = [...columns];

  for (const step of pipeline.steps) {
    if (step.type === 'sql') {
      // SQL is executed on the server against MSSQL; skip in pure JS runner
      continue;
    }
    if (step.type === 'select-columns') {
      current = applySelectColumns(current, step.columns);
      cols = step.columns.length ? step.columns : cols;
    } else if (step.type === 'filter-rows') {
      current = applyFilterRows(current, step);
    } else if (step.type === 'join') {
      const joined = applyJoin(current, cols, step, extras);
      current = joined.rows;
      cols = joined.columns;
    } else if (step.type === 'aggregate') {
      current = applyAggregate(current, step);
      cols = [
        ...step.groupBy,
        ...step.metrics.map((m: { as: string; fn: string; column: string }) =>
          m.as || `${m.fn}_${m.column}`,
        ),
      ];
    }
  }

  if (current.length && cols.length === 0) {
    cols = Object.keys(current[0]);
  }

  return {
    id: pipeline.datasetId,
    name: pipeline.name,
    columns: cols,
    rows: current,
    updatedAt: new Date().toISOString(),
  };
}

export function parseCsvText(text: string): { columns: string[]; rows: DatasetRow[] } {
  const cleaned = text.replace(/^\uFEFF/, '');
  if (!cleaned.trim()) return { columns: [], rows: [] };

  const guessed = detectCsvDelimiter(cleaned);
  // PapaParse delimiter:'' also auto-detects; we pass our guess first so
  // `;` wins over `,` when both appear (EU CSVs with decimal commas).
  const parsed = Papa.parse<Record<string, string>>(cleaned, {
    header: true,
    delimiter: guessed,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
  });

  let columns = (parsed.meta.fields || []).map((c) => c.trim()).filter(Boolean);

  // If guess still yielded a single blob header, retry with Papa auto-detect.
  if (columns.length <= 1 && cleaned.includes(';')) {
    const retry = Papa.parse<Record<string, string>>(cleaned, {
      header: true,
      delimiter: '',
      skipEmptyLines: 'greedy',
      transformHeader: (h) => h.trim(),
    });
    const retryCols = (retry.meta.fields || []).map((c) => c.trim()).filter(Boolean);
    if (retryCols.length > columns.length) {
      columns = retryCols;
      const rows: DatasetRow[] = [];
      for (const raw of retry.data) {
        if (!raw || typeof raw !== 'object') continue;
        const row: DatasetRow = {};
        let empty = true;
        for (const col of columns) {
          const v = coerceCell(String((raw as Record<string, string>)[col] ?? ''));
          row[col] = v;
          if (v !== '' && v != null) empty = false;
        }
        if (!empty) rows.push(row);
      }
      return { columns, rows };
    }
  }

  const rows: DatasetRow[] = [];
  for (const raw of parsed.data) {
    if (!raw || typeof raw !== 'object') continue;
    const row: DatasetRow = {};
    let empty = true;
    for (const col of columns) {
      const v = coerceCell(String((raw as Record<string, string>)[col] ?? ''));
      row[col] = v;
      if (v !== '' && v != null) empty = false;
    }
    if (!empty) rows.push(row);
  }
  return { columns, rows };
}

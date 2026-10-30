import Papa from 'papaparse';
import type { CsvDelimiter, Dataset, DatasetRow, Pipeline, PipelineStep } from './types';

export type TableSnapshot = { columns: string[]; rows: DatasetRow[] };

export type ResolvedCsvDelimiter = ',' | ';' | '\t';

/**
 * Normalize BOM + Unicode lookalike separators (Greek question mark, fullwidth
 * semicolon, Arabic semicolon) so EU/Cyrillic Excel exports still split.
 */
export function normalizeCsvText(text: string): string {
  return text
    .replace(/^\uFEFF/, '')
    .replace(/[\u037e\uff1b\u061b]/g, ';');
}

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
 * Prefer `;` when it yields more columns than `,` (typical EU/RU Excel).
 */
export function detectCsvDelimiter(text: string): ResolvedCsvDelimiter {
  const lines = normalizeCsvText(text)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 12);
  if (!lines.length) return ',';

  const candidates: ResolvedCsvDelimiter[] = [';', ',', '\t'];
  let best: ResolvedCsvDelimiter = ',';
  let bestScore = -1;
  for (const d of candidates) {
    const counts = lines.map((l) => countDelims(l, d) + 1);
    const first = counts[0];
    if (first < 2) continue;
    const consistent = counts.filter((c) => c === first).length;
    // Slight bonus for semicolon so "a;b,c;d" (EU decimals) still prefers `;`
    const bonus = d === ';' ? 15 : d === '\t' ? 5 : 0;
    const score = consistent * 100 + first * 10 + bonus;
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

export function resolveCsvDelimiter(
  text: string,
  override?: CsvDelimiter | null,
): ResolvedCsvDelimiter {
  if (override && override !== 'auto') return override;
  return detectCsvDelimiter(text);
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

function rowsFromPapa(
  columns: string[],
  data: Record<string, string>[],
): DatasetRow[] {
  const rows: DatasetRow[] = [];
  for (const raw of data) {
    if (!raw || typeof raw !== 'object') continue;
    const row: DatasetRow = {};
    let empty = true;
    for (const col of columns) {
      const v = coerceCell(String(raw[col] ?? ''));
      row[col] = v;
      if (v !== '' && v != null) empty = false;
    }
    if (!empty) rows.push(row);
  }
  return rows;
}

/** Manual split when Papa still returns a single blob column. */
function splitLine(line: string, delim: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delim && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

function parseWithDelimiter(
  cleaned: string,
  delim: ResolvedCsvDelimiter,
): { columns: string[]; rows: DatasetRow[] } {
  const parsed = Papa.parse<Record<string, string>>(cleaned, {
    header: true,
    delimiter: delim,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
  });
  let columns = (parsed.meta.fields || []).map((c) => c.trim()).filter(Boolean);

  // Rescue: single header that still contains the delimiter → force manual split
  if (
    columns.length <= 1 &&
    columns[0] &&
    columns[0].includes(delim)
  ) {
    const lines = cleaned.split(/\r?\n/).filter((l) => l.trim().length);
    columns = splitLine(lines[0], delim).filter(Boolean);
    const rows: DatasetRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = splitLine(lines[i], delim);
      const row: DatasetRow = {};
      let empty = true;
      columns.forEach((col, idx) => {
        const v = coerceCell(parts[idx] ?? '');
        row[col] = v;
        if (v !== '' && v != null) empty = false;
      });
      if (!empty) rows.push(row);
    }
    return { columns, rows };
  }

  return { columns, rows: rowsFromPapa(columns, parsed.data) };
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

/**
 * Parse CSV with auto or explicit delimiter.
 * Always re-reads `text` (no cache). Safe for `;` EU/RU Excel exports.
 */
export function parseCsvText(
  text: string,
  options?: { delimiter?: CsvDelimiter | null },
): { columns: string[]; rows: DatasetRow[]; delimiter: ResolvedCsvDelimiter } {
  const cleaned = normalizeCsvText(text);
  if (!cleaned.trim()) return { columns: [], rows: [], delimiter: ',' };

  const delim = resolveCsvDelimiter(cleaned, options?.delimiter);
  let result = parseWithDelimiter(cleaned, delim);

  // If still one blob column, try the other common delimiters
  if (result.columns.length <= 1) {
    const blob = result.columns[0] || '';
    const fallbacks = ([';', ',', '\t'] as ResolvedCsvDelimiter[]).filter(
      (d) => d !== delim,
    );
    for (const d of fallbacks) {
      if (!blob.includes(d) && !cleaned.includes(d)) continue;
      const retry = parseWithDelimiter(cleaned, d);
      if (retry.columns.length > result.columns.length) {
        result = retry;
        return { ...result, delimiter: d };
      }
    }
  }

  return { ...result, delimiter: delim };
}

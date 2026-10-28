import type { Dataset, DatasetRow, Pipeline, PipelineStep } from './types';

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
    const key = step.groupBy.map((c) => String(row[c] ?? '')).join('\0');
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

export function runPipelineOnRows(
  rows: DatasetRow[],
  columns: string[],
  pipeline: Pipeline,
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
    } else if (step.type === 'aggregate') {
      current = applyAggregate(current, step);
      cols = [
        ...step.groupBy,
        ...step.metrics.map((m) => m.as || `${m.fn}_${m.column}`),
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
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim().length);
  if (!lines.length) return { columns: [], rows: [] };

  const split = (line: string): string[] => {
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
      } else if (ch === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    result.push(cur.trim());
    return result;
  };

  const columns = split(lines[0]);
  const rows: DatasetRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = split(lines[i]);
    const row: DatasetRow = {};
    columns.forEach((col, idx) => {
      const raw = parts[idx] ?? '';
      const num = Number(raw.replace(/\s/g, '').replace(',', '.'));
      row[col] = raw !== '' && !Number.isNaN(num) && /^-?\d/.test(raw) ? num : raw;
    });
    rows.push(row);
  }
  return { columns, rows };
}

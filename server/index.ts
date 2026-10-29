import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sql from 'mssql';
import { parseCsvText, runPipelineOnRows } from '../src/shared/pipelineRunner.ts';
import type {
  DataSource,
  Dataset,
  Pipeline,
  PublishedPayload,
  SourceMssql,
} from '../src/shared/types.ts';
import { resolveTheme } from '../src/shared/themes.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

const app = express();
app.use(cors());
app.use(express.json({ limit: '40mb' }));

async function fetchSourceRows(
  source: DataSource,
  pipeline: Pipeline,
): Promise<{ columns: string[]; rows: Dataset['rows'] }> {
  if (source.type === 'csv') {
    const parsed = parseCsvText(source.content, {
      delimiter: source.delimiter ?? 'auto',
    });
    return { columns: parsed.columns, rows: parsed.rows };
  }

  const mssqlSource = source as SourceMssql;
  const sqlStep = pipeline.steps.find((s) => s.type === 'sql');
  if (!sqlStep || sqlStep.type !== 'sql' || !sqlStep.query.trim()) {
    throw new Error(`Пайплайн «${pipeline.name}»: для MSSQL нужен шаг SQL с запросом`);
  }

  const pool = await sql.connect({
    server: mssqlSource.server,
    database: mssqlSource.database,
    user: mssqlSource.user,
    password: mssqlSource.password,
    port: mssqlSource.port || 1433,
    options: {
      encrypt: mssqlSource.encrypt ?? false,
      trustServerCertificate: mssqlSource.trustServerCertificate ?? true,
    },
    connectionTimeout: 15000,
    requestTimeout: 60000,
  });

  try {
    const result = await pool.request().query(sqlStep.query);
    const rows = (result.recordset || []) as Record<string, unknown>[];
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    return {
      columns,
      rows: rows.map((r) => {
        const out: Dataset['rows'][number] = {};
        for (const c of columns) {
          const v = r[c];
          if (v instanceof Date) out[c] = v.toISOString().slice(0, 10);
          else if (typeof v === 'bigint') out[c] = Number(v);
          else out[c] = (v as string | number | boolean | null) ?? null;
        }
        return out;
      }),
    };
  } finally {
    await pool.close();
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/sample-csv', (_req, res) => {
  const samplePath = path.join(root, 'samples', 'sales.csv');
  const content = fs.readFileSync(samplePath, 'utf8');
  res.type('text/csv').send(content);
});

/** Semicolon RU/Excel sample for ETL wizard demo. */
app.get('/api/sample-semicolon-csv', (_req, res) => {
  const samplePath = path.join(root, 'samples', 'pfp44.csv');
  const content = fs.readFileSync(samplePath, 'utf8');
  res.type('text/csv').send(content);
});

app.post('/api/parse-csv', upload.single('file'), (req, res) => {
  try {
    const text =
      req.file?.buffer.toString('utf8') ||
      (typeof req.body?.content === 'string' ? req.body.content : '');
    if (!text) {
      res.status(400).json({ error: 'Нет CSV-содержимого' });
      return;
    }
    const delimiter =
      typeof req.body?.delimiter === 'string' ? req.body.delimiter : 'auto';
    const parsed = parseCsvText(text, { delimiter });
    res.json({
      ...parsed,
      content: text,
      fileName: req.file?.originalname || 'data.csv',
    });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

app.post('/api/refresh', async (req, res) => {
  try {
    const { sources, pipelines } = req.body as {
      sources: DataSource[];
      pipelines: Pipeline[];
    };
    if (!Array.isArray(sources) || !Array.isArray(pipelines)) {
      res.status(400).json({ error: 'Нужны sources и pipelines' });
      return;
    }

    const datasets: Dataset[] = [];
    const warnings: string[] = [];

    // Preload raw tables for join steps (by source id). Credentials never leave this process.
    const rawBySource: Record<string, { columns: string[]; rows: Dataset['rows'] }> = {};
    for (const source of sources) {
      try {
        const sqlFromPipe = pipelines
          .filter((p) => p.sourceId === source.id)
          .flatMap((p) => p.steps)
          .find((s) => s.type === 'sql');
        const preloadPipe: Pipeline = {
          id: 'preload',
          name: 'preload',
          sourceId: source.id,
          datasetId: 'preload',
          steps:
            source.type === 'mssql'
              ? [
                  {
                    id: 'sql',
                    type: 'sql',
                    query:
                      sqlFromPipe && sqlFromPipe.type === 'sql'
                        ? sqlFromPipe.query
                        : 'SELECT 1 WHERE 1=0',
                  },
                ]
              : [],
        };
        rawBySource[source.id] = await fetchSourceRows(source, preloadPipe);
      } catch (e) {
        warnings.push(
          `Источник «${source.name}»: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }

    for (const pipeline of pipelines) {
      const source = sources.find((s) => s.id === pipeline.sourceId);
      if (!source) {
        warnings.push(`Источник для пайплайна «${pipeline.name}» не найден`);
        continue;
      }
      try {
        const base = rawBySource[source.id] || (await fetchSourceRows(source, pipeline));
        const nonSqlSteps: Pipeline = {
          ...pipeline,
          steps: pipeline.steps.filter((s) => s.type !== 'sql'),
        };
        const dataset = runPipelineOnRows(base.rows, base.columns, nonSqlSteps, rawBySource);
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

    res.json({ datasets, warnings });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

app.post('/api/export-html', (req, res) => {
  try {
    const payload = req.body as PublishedPayload;
    if (!payload?.dashboard || !payload?.datasets) {
      res.status(400).json({ error: 'Некорректный payload' });
      return;
    }

    // Explicitly publish only dashboard + datasets + theme (never sources/credentials).
    const safe: PublishedPayload = {
      version: 1,
      dashboard: payload.dashboard,
      datasets: payload.datasets.map((d) => ({
        id: d.id,
        name: d.name,
        columns: d.columns,
        rows: d.rows,
        updatedAt: d.updatedAt,
      })),
      theme:
        payload.theme ||
        resolveTheme(payload.dashboard.themeId, payload.dashboard.chartPaletteId),
    };

    const size = JSON.stringify(safe).length;
    const warnings: string[] = [];
    if (size > 3_000_000) {
      warnings.push(`Снимок данных ~${Math.round(size / 1024)} КБ — файл HTML будет большим.`);
    }

    const templatePath = path.join(root, 'dist-viewer', 'index.html');
    if (!fs.existsSync(templatePath)) {
      res.status(500).json({
        error:
          'Шаблон viewer не собран. Выполните npm run build:viewer, затем повторите экспорт.',
      });
      return;
    }

    let html = fs.readFileSync(templatePath, 'utf8');
    const injection = `<script>window.__DASHBOARD_PAYLOAD__=${JSON.stringify(safe)};</script>`;
    if (html.includes('<!--DASHBOARD_PAYLOAD-->')) {
      html = html.replace('<!--DASHBOARD_PAYLOAD-->', injection);
    } else if (html.includes('</head>')) {
      html = html.replace('</head>', `${injection}</head>`);
    } else {
      html = injection + html;
    }

    const safeName =
      safe.dashboard.title.replace(/[^\wа-яА-ЯёЁ\- ]+/gi, '').trim() || 'dashboard';
    res.json({
      html,
      warnings,
      byteLength: Buffer.byteLength(html, 'utf8'),
      fileName: `${safeName}.html`,
    });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

const port = Number(process.env.PORT || 8787);

// Use http.createServer explicitly. Express 5's app.listen() routes the
// server "error" event into the listen callback; ignoring that argument
// printed a false "started" message, then the process exited 0 (no open
// handle) and concurrently -k killed Vite — common when :8787 is busy.
const server = http.createServer(app);

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `Studio API: порт ${port} занят. Закройте другой процесс или задайте PORT=... и повторите npm run dev.`,
    );
  } else {
    console.error('Studio API listen error:', err);
  }
  process.exit(1);
});

server.listen(port, () => {
  console.log(`Studio API http://localhost:${port}`);
});

function shutdown(signal: string) {
  console.log(`Studio API: ${signal}, shutting down…`);
  server.close(() => process.exit(0));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

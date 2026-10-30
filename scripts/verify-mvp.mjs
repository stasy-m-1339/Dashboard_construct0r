/**
 * Smoke checks for MVP todos (no server scheduler; single HTML publish).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

const failures = [];
function ok(name, cond, detail = '') {
  if (cond) console.log(`✓ ${name}`);
  else {
    console.error(`✗ ${name}${detail ? ` — ${detail}` : ''}`);
    failures.push(name);
  }
}

// 1) scaffold files
ok(
  'scaffold-studio files',
  [
    'src/studio/TabBar.tsx',
    'src/studio/GridEditor.tsx',
    'src/studio/Toolbar.tsx',
    'src/shared/themes.ts',
  ].every((f) => fs.existsSync(path.join(root, f))),
);

const toolbar = fs.readFileSync(path.join(root, 'src/studio/Toolbar.tsx'), 'utf8');
ok('preview + theme + refresh + export controls', 
  toolbar.includes('Превью') &&
  (toolbar.includes('setThemeId') || toolbar.includes('Стили')) &&
  toolbar.includes('Обновить данные') &&
  toolbar.includes('Собрать HTML') &&
  toolbar.includes('getState()'),
);

// 2) block library
const blocks = fs.readFileSync(path.join(root, 'src/shared/blocks.ts'), 'utf8');
const types = ['kpi', 'bar', 'line', 'pie', 'table', 'filter-select', 'filter-date'];
ok(
  'block-library 7 starters',
  types.every((t) => blocks.includes(`type: '${t}'`)),
);
ok(
  'JSON import',
  fs.readFileSync(path.join(root, 'src/studio/BlockPalette.tsx'), 'utf8').includes('importBlockJson') &&
    blocks.includes('parseImportedBlock'),
);

// 3) pipelines / ETL modal (no side Data panel)
const etlModal = fs.readFileSync(path.join(root, 'src/studio/EtlModal.tsx'), 'utf8');
const appTsx = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');
const server = fs.readFileSync(path.join(root, 'server/index.ts'), 'utf8');
ok('no side DataPanel', !appTsx.includes('DataPanel') && !fs.existsSync(path.join(root, 'src/studio/DataPanel.tsx')));
ok(
  'ETL wizard sources CSV/SQL (no xlsx)',
  etlModal.includes('+ CSV') &&
    etlModal.includes('+ SQL') &&
    etlModal.includes('пока только CSV') &&
    !etlModal.includes("import('xlsx')") &&
    !etlModal.includes('from \'xlsx\'') &&
    !fs.readFileSync(path.join(root, 'package.json'), 'utf8').includes('"xlsx"'),
);
ok(
  'ETL wizard 2-step Flat Design',
  etlModal.includes('Шаг') &&
    etlModal.includes('Далее: Настройка схемы') &&
    etlModal.includes('Завершить настройку') &&
    etlModal.includes('Измерения и Фильтры') &&
    etlModal.includes('Меры и Вычисления') &&
    etlModal.includes('Переключатели'),
);
ok(
  'ETL filter widgets + formula templates',
  fs.readFileSync(path.join(root, 'src/shared/etlSchema.ts'), 'utf8').includes('double_stepper') &&
    fs.readFileSync(path.join(root, 'src/shared/etlSchema.ts'), 'utf8').includes('Мультиселект') &&
    etlModal.includes('growth_contrib') &&
    etlModal.includes('+ case'),
);
ok(
  'CSV delimiter override UI',
  etlModal.includes('Разделитель') &&
    etlModal.includes("id: ';'") &&
    etlModal.includes('Обновить данные'),
);
ok(
  'parseCsvText delimiter API',
  fs.readFileSync(path.join(root, 'src/shared/pipelineRunner.ts'), 'utf8').includes(
    'resolveCsvDelimiter',
  ) &&
    fs.readFileSync(path.join(root, 'src/studio/api.ts'), 'utf8').includes('refreshCsvInBrowser'),
);
ok(
  'Toolbar opens Данные… modal',
  fs.readFileSync(path.join(root, 'src/studio/Toolbar.tsx'), 'utf8').includes('Данные…') &&
    fs.readFileSync(path.join(root, 'src/studio/Toolbar.tsx'), 'utf8').includes('EtlModal'),
);
ok('MSSQL driver', server.includes("from 'mssql'") && server.includes('/api/refresh'));
ok('no server cron/scheduler', !/cron|node-cron|schedule\(|setInterval\(/.test(server));

// 4) single HTML publish
ok(
  'export endpoint + viewer template',
  server.includes('/api/export-html') && fs.existsSync(path.join(root, 'viewer.html')),
);
const sample = path.join(root, 'samples', 'exported', 'demo-sales.html');
ok('sample exported HTML exists', fs.existsSync(sample));
if (fs.existsSync(sample)) {
  const html = fs.readFileSync(sample, 'utf8');
  const ext = [...html.matchAll(/(?:src|href)=["'](https?:\/\/[^"']+)["']/g)].map((m) => m[1]);
  ok('sample HTML self-contained (no external http assets)', ext.length === 0, String(ext));
  ok('sample embeds payload', html.includes('__DASHBOARD_PAYLOAD__'));
  const payloadStart = html.indexOf('__DASHBOARD_PAYLOAD__=');
  const payloadEnd = html.indexOf('</script>', payloadStart);
  const payload = html.slice(payloadStart, payloadEnd);
  ok('payload has no password/source secrets', !/password|mssql|"server"/.test(payload));
}

// 5) prompts doc (project store path checked by parent; also verify if mirrored)
const storePrompt = '/cursor/stores/self/docs/ai-block-prompts.md';
ok('ai-prompts-doc in project store', fs.existsSync(storePrompt));
if (fs.existsSync(storePrompt)) {
  const text = fs.readFileSync(storePrompt, 'utf8');
  ok(
    'prompts cover schema + 5 templates',
    text.includes('defaultBinding') &&
      text.includes('Промпт 1') &&
      text.includes('Промпт 5') &&
      text.includes('filter-select'),
  );
}

// pipeline runner smoke (via tsx dynamic import alternative: reimplement quick check)
ok(
  'pipeline runner has join/aggregate',
  fs.readFileSync(path.join(root, 'src/shared/pipelineRunner.ts'), 'utf8').includes('applyJoin') &&
    fs.readFileSync(path.join(root, 'src/shared/pipelineRunner.ts'), 'utf8').includes('applyAggregate'),
);

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log('\nAll MVP audit checks passed');
void require;

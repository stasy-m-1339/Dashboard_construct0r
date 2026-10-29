/**
 * Unit checks for semicolon / BOM / lookalike CSV parsing.
 * Run: npm run test:csv  (via tsx so .ts imports resolve)
 */
import assert from 'node:assert/strict';
import {
  parseCsvText,
  detectCsvDelimiter,
  normalizeCsvText,
  resolveCsvDelimiter,
} from '../src/shared/pipelineRunner.ts';

function check(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (e) {
    console.error(`✗ ${name}`);
    console.error(e);
    process.exitCode = 1;
  }
}

const ruHeader = 'Показатель;Месяц;Регион;Сумма';
const ruBody = 'Выручка;Январь;Север;1200,5\nМаржа;Февраль;Юг;340,1';
const ruCsv = `${ruHeader}\n${ruBody}\n`;

check('detect prefers semicolon for RU Excel CSV', () => {
  assert.equal(detectCsvDelimiter(ruCsv), ';');
});

check('parseCsvText auto-splits semicolon RU header', () => {
  const { columns, rows, delimiter } = parseCsvText(ruCsv);
  assert.equal(delimiter, ';');
  assert.deepEqual(columns, ['Показатель', 'Месяц', 'Регион', 'Сумма']);
  assert.equal(rows.length, 2);
  assert.equal(rows[0]['Показатель'], 'Выручка');
  assert.equal(rows[0]['Сумма'], 1200.5);
});

check('explicit ";" override works even if commas present', () => {
  const weird = 'a;b,c;d\n1;2,5;3\n';
  const { columns, rows, delimiter } = parseCsvText(weird, { delimiter: ';' });
  assert.equal(delimiter, ';');
  assert.deepEqual(columns, ['a', 'b,c', 'd']);
  assert.equal(rows[0].a, 1);
  assert.equal(rows[0]['b,c'], 2.5);
});

check('BOM is stripped', () => {
  const withBom = `\uFEFF${ruCsv}`;
  const { columns } = parseCsvText(withBom, { delimiter: ';' });
  assert.equal(columns[0], 'Показатель');
  assert.equal(columns.length, 4);
});

check('Unicode lookalike semicolon normalized', () => {
  // U+037E Greek question mark looks like ;
  const lookalike = `Показатель\u037eМесяц\nA\u037eB\n`;
  assert.ok(normalizeCsvText(lookalike).includes(';'));
  const { columns } = parseCsvText(lookalike, { delimiter: 'auto' });
  assert.deepEqual(columns, ['Показатель', 'Месяц']);
});

check('resolveCsvDelimiter honors override', () => {
  assert.equal(resolveCsvDelimiter(ruCsv, ';'), ';');
  assert.equal(resolveCsvDelimiter(ruCsv, ','), ',');
  assert.equal(resolveCsvDelimiter(ruCsv, 'auto'), ';');
});

check('comma CSV still works', () => {
  const us = 'date,region,amount\n2024-01-01,North,10\n';
  const { columns, delimiter } = parseCsvText(us);
  assert.equal(delimiter, ',');
  assert.deepEqual(columns, ['date', 'region', 'amount']);
});

check('tab CSV', () => {
  const tsv = 'a\tb\tc\n1\t2\t3\n';
  const { columns, delimiter } = parseCsvText(tsv);
  assert.equal(delimiter, '\t');
  assert.deepEqual(columns, ['a', 'b', 'c']);
});

check('single blob header is rescued when override is ;', () => {
  // Simulate what the UI showed: one field containing the whole header
  const blob = 'Показатель;Месяц;Год\nx;y;z\n';
  const { columns } = parseCsvText(blob, { delimiter: ';' });
  assert.equal(columns.length, 3);
  assert.equal(columns[0], 'Показатель');
});

if (!process.exitCode) {
  console.log('\nAll CSV delimiter tests passed.');
} else {
  console.error('\nCSV delimiter tests failed.');
  process.exit(1);
}

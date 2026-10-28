import type { BlockPreset, WidgetInstance, WidgetType } from './types';

/** Core starters + blocks inspired by docs/dashboard-standalone.html */
export const BLOCK_LIBRARY: BlockPreset[] = [
  // —— базовые ——
  {
    id: 'kpi',
    type: 'kpi',
    title: 'KPI',
    description: 'Крупное число: сумма по колонке',
    defaultBinding: { valueColumn: '', label: 'Показатель', tone: 'default' },
    defaultLayout: { w: 3, h: 2 },
  },
  {
    id: 'bar',
    type: 'bar',
    title: 'Столбчатая диаграмма',
    description: 'Категории по оси X, значения — столбцы',
    defaultBinding: { categoryColumn: '', valueColumn: '' },
    defaultLayout: { w: 6, h: 4 },
  },
  {
    id: 'line',
    type: 'line',
    title: 'Линейный график',
    description: 'Динамика значений по категориям или датам',
    defaultBinding: { categoryColumn: '', valueColumn: '' },
    defaultLayout: { w: 6, h: 4 },
  },
  {
    id: 'pie',
    type: 'pie',
    title: 'Круговая диаграмма',
    description: 'Доли категорий в общем итоге',
    defaultBinding: { categoryColumn: '', valueColumn: '' },
    defaultLayout: { w: 4, h: 4 },
  },
  {
    id: 'table',
    type: 'table',
    title: 'Таблица',
    description: 'Строки датасета в таблице',
    defaultBinding: { columns: [], tone: 'default' },
    defaultLayout: { w: 8, h: 5 },
  },
  {
    id: 'filter-select',
    type: 'filter-select',
    title: 'Фильтр: список',
    description: 'Выпадающий список по уникальным значениям колонки',
    defaultBinding: { filterColumn: '', label: 'Фильтр' },
    defaultLayout: { w: 3, h: 2 },
  },
  {
    id: 'filter-date',
    type: 'filter-date',
    title: 'Фильтр: период',
    description: 'Диапазон дат по колонке',
    defaultBinding: { filterColumn: '', label: 'Период' },
    defaultLayout: { w: 4, h: 2 },
  },

  // —— из standalone: KPI / insight ——
  {
    id: 'sa-kpi-fact',
    type: 'kpi-delta',
    title: 'KPI факт + Δ',
    description: 'Как сводка «факт»: значение, сравнение и отклонение (teal)',
    defaultBinding: {
      valueColumn: '',
      compareColumn: '',
      label: 'Факт',
      badge: 'Факт',
      tone: 'fact',
      format: 'money',
    },
    defaultLayout: { w: 4, h: 3 },
    schemaHint: 'Standalone summary kpiActual / card-fact',
  },
  {
    id: 'sa-kpi-plan',
    type: 'kpi-delta',
    title: 'KPI план + Δ',
    description: 'План/forecast с отклонением (sand/teal)',
    defaultBinding: {
      valueColumn: '',
      compareColumn: '',
      label: 'План',
      badge: 'План',
      tone: 'plan',
      format: 'money',
    },
    defaultLayout: { w: 4, h: 3 },
    schemaHint: 'Standalone summary kpiPlan / card-plan',
  },
  {
    id: 'sa-top-list',
    type: 'top-list',
    title: 'Топ-список',
    description: 'Рейтинг с полосками (insight-list / top clients·brands)',
    defaultBinding: {
      categoryColumn: '',
      valueColumn: '',
      maxItems: 5,
      tone: 'insight',
      format: 'money',
      badge: 'Топ',
    },
    defaultLayout: { w: 4, h: 5 },
    schemaHint: 'Standalone summary topLists',
  },

  // —— из standalone: charts ——
  {
    id: 'sa-dynamics-area',
    type: 'area',
    title: 'Динамика (area)',
    description: 'Динамика по неделям/месяцам — area как weekChart/monthChart',
    defaultBinding: { categoryColumn: '', valueColumn: '', tone: 'fact' },
    defaultLayout: { w: 8, h: 4 },
    schemaHint: 'Standalone weekChart / monthChart dynamics',
  },
  {
    id: 'sa-combo-fact-plan',
    type: 'combo',
    title: 'Комбо факт+план',
    description: 'Столбцы факта + линия плана/forecast (combo)',
    defaultBinding: {
      categoryColumn: '',
      valueColumn: '',
      lineColumn: '',
      tone: 'fact',
    },
    defaultLayout: { w: 8, h: 4 },
    schemaHint: 'Standalone chart type combo',
  },
  {
    id: 'sa-stacked-bar',
    type: 'stacked-bar',
    title: 'Столбцы stacked',
    description: 'Составные столбцы по нескольким сериям',
    defaultBinding: { categoryColumn: '', seriesColumns: [], valueColumn: '' },
    defaultLayout: { w: 6, h: 4 },
    schemaHint: 'Standalone chart type stacked',
  },
  {
    id: 'sa-hbar',
    type: 'hbar',
    title: 'Горизонтальные бары',
    description: 'HBar / торнадо-отклонения: длинные названия, ± значения',
    defaultBinding: {
      categoryColumn: '',
      valueColumn: '',
      maxItems: 12,
      tone: 'insight',
    },
    defaultLayout: { w: 6, h: 5 },
    schemaHint: 'Standalone hbar / tornado deviations',
  },
  {
    id: 'sa-donut',
    type: 'donut',
    title: 'Donut',
    description: 'Кольцевая диаграмма долей (standalone donut)',
    defaultBinding: { categoryColumn: '', valueColumn: '' },
    defaultLayout: { w: 4, h: 4 },
    schemaHint: 'Standalone chart type donut',
  },
  {
    id: 'sa-waterfall',
    type: 'waterfall',
    title: 'Waterfall / мост',
    description: 'Мост отклонений: база → шаги → итог (wf-monthly)',
    defaultBinding: {
      categoryColumn: '',
      valueColumn: '',
      compareColumn: '',
      tone: 'insight',
    },
    defaultLayout: { w: 8, h: 4 },
    schemaHint: 'Standalone waterfall / dg-card wf-monthly',
  },

  // —— из standalone: tables / filters ——
  {
    id: 'sa-sales-table',
    type: 'table',
    title: 'Таблица продаж',
    description: 'Компактная sales-tbl с подсветкой pos/neg (факт/план)',
    defaultBinding: { columns: [], tone: 'fact', format: 'money' },
    defaultLayout: { w: 6, h: 5 },
    schemaHint: 'Standalone sales-tbl in card-fact/card-plan',
  },
  {
    id: 'sa-matrix',
    type: 'matrix',
    title: 'Матрица',
    description: 'Сводная матрица строк×колонок с подсветкой ± (matrix-tbl)',
    defaultBinding: {
      rowColumn: '',
      colColumn: '',
      valueColumn: '',
      format: 'money',
      tone: 'insight',
    },
    defaultLayout: { w: 8, h: 5 },
    schemaHint: 'Standalone summary matrix',
  },
  {
    id: 'sa-filter-chips',
    type: 'filter-chips',
    title: 'Фильтр: чипы',
    description: 'Мультивыбор значениями-чипами (filter-chips панели)',
    defaultBinding: { filterColumn: '', label: 'Фильтр' },
    defaultLayout: { w: 6, h: 2 },
    schemaHint: 'Standalone filter-chips',
  },
  {
    id: 'sa-filter-week',
    type: 'filter-select',
    title: 'Фильтр: неделя/месяц',
    description: 'Селектор периода как week/month selector',
    defaultBinding: { filterColumn: '', label: 'Период', badge: 'Неделя' },
    defaultLayout: { w: 3, h: 2 },
    schemaHint: 'Standalone weekSelector / monthSelector',
  },
];

export const ALL_WIDGET_TYPES: WidgetType[] = [
  'kpi',
  'kpi-delta',
  'bar',
  'stacked-bar',
  'hbar',
  'line',
  'area',
  'combo',
  'pie',
  'donut',
  'waterfall',
  'top-list',
  'matrix',
  'table',
  'filter-select',
  'filter-chips',
  'filter-date',
];

export function createWidgetFromPreset(
  preset: BlockPreset,
  id: string,
  layout: { x: number; y: number; w: number; h: number },
): WidgetInstance {
  return {
    id,
    type: preset.type,
    title: preset.title,
    binding: { ...preset.defaultBinding },
    layout,
  };
}

export function isFilterWidget(type: WidgetType): boolean {
  return type === 'filter-select' || type === 'filter-date' || type === 'filter-chips';
}

/** Validate / normalize a block JSON imported from external AI */
export function parseImportedBlock(raw: unknown): BlockPreset | { error: string } {
  if (!raw || typeof raw !== 'object') {
    return { error: 'Ожидался JSON-объект блока' };
  }
  const obj = raw as Record<string, unknown>;
  const type = obj.type as WidgetType | undefined;
  if (!type || !ALL_WIDGET_TYPES.includes(type)) {
    return { error: `Неизвестный type. Допустимо: ${ALL_WIDGET_TYPES.join(', ')}` };
  }
  const title = typeof obj.title === 'string' ? obj.title : 'Импортированный блок';
  const description = typeof obj.description === 'string' ? obj.description : '';
  const id =
    typeof obj.id === 'string' && obj.id.trim()
      ? obj.id.trim()
      : `custom-${type}-${Date.now()}`;
  const defaultBinding =
    obj.defaultBinding && typeof obj.defaultBinding === 'object'
      ? (obj.defaultBinding as BlockPreset['defaultBinding'])
      : {};
  const defaultLayout =
    obj.defaultLayout && typeof obj.defaultLayout === 'object'
      ? {
          w: Number((obj.defaultLayout as { w?: number }).w) || 4,
          h: Number((obj.defaultLayout as { h?: number }).h) || 3,
        }
      : { w: 4, h: 3 };

  return {
    id,
    type,
    title,
    description,
    defaultBinding,
    defaultLayout,
    schemaHint: typeof obj.schemaHint === 'string' ? obj.schemaHint : undefined,
  };
}

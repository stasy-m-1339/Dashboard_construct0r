import type { BlockPreset, WidgetInstance, WidgetType } from './types';

export const BLOCK_LIBRARY: BlockPreset[] = [
  {
    id: 'kpi',
    type: 'kpi',
    title: 'KPI',
    description: 'Крупное число: сумма, среднее или количество по колонке',
    defaultBinding: { valueColumn: '', label: 'Показатель' },
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
    defaultBinding: { columns: [] },
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
  return type === 'filter-select' || type === 'filter-date';
}

/** Validate / normalize a block JSON imported from external AI */
export function parseImportedBlock(raw: unknown): BlockPreset | { error: string } {
  if (!raw || typeof raw !== 'object') {
    return { error: 'Ожидался JSON-объект блока' };
  }
  const obj = raw as Record<string, unknown>;
  const type = obj.type as WidgetType | undefined;
  const allowed: WidgetType[] = ['kpi', 'bar', 'line', 'pie', 'table', 'filter-select', 'filter-date'];
  if (!type || !allowed.includes(type)) {
    return { error: `Неизвестный type. Допустимо: ${allowed.join(', ')}` };
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

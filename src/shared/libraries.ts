import { BLOCK_LIBRARY, isFilterWidget } from './blocks';
import type { BlockPreset } from './types';

/** Dashboard canvas widgets (not filters). */
export function getDashboardLibrary(custom: BlockPreset[] = []): BlockPreset[] {
  const base = BLOCK_LIBRARY.filter((b) => !isFilterWidget(b.type));
  const extras = custom.filter((b) => !isFilterWidget(b.type));
  // Prefer human titles; put сводная near top after core tables
  return [...base, ...extras];
}

/** Elements for the filters soft-rail. */
export function getFilterLibrary(custom: BlockPreset[] = []): BlockPreset[] {
  const base = BLOCK_LIBRARY.filter((b) => isFilterWidget(b.type));
  const extras = custom.filter((b) => isFilterWidget(b.type));
  return [...base, ...extras];
}

/** Ensure pivot/matrix is clearly named in dashboard library. */
export const PIVOT_PRESET_ID = 'sa-pivot-table';

export const PIVOT_PRESET: BlockPreset = {
  id: PIVOT_PRESET_ID,
  type: 'matrix',
  title: 'Сводная таблица',
  description:
    'Сводная (pivot): строки × колонки, сумма значений, подсветка плюс/минус',
  defaultBinding: {
    rowColumn: '',
    colColumn: '',
    valueColumn: '',
    format: 'money',
    tone: 'insight',
    badge: 'Сводная',
  },
  defaultLayout: { w: 8, h: 6 },
  schemaHint: 'Pivot / matrix summary table',
};

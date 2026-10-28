import type { ChartPalettePreset, ThemeConfig } from './types';

/** Brand tokens from docs/palette-wide.html (wide fashion light). */
export const BRAND = {
  grey50: '#F8F6F5',
  grey100: '#F3F1F0',
  grey200: '#ECE9E8',
  grey300: '#DFDBDA',
  grey400: '#D2CDCC',
  grey500: '#C4BDBE',
  sand50: '#EDE7DF',
  sand300: '#CBBFB2',
  sand500: '#bbac9b',
  teal50: '#DCE1DF',
  teal100: '#BCCBC8',
  teal300: '#98B4B0',
  teal500: '#6E9B96',
  teal700: '#3F827B',
  teal900: '#00665e',
  primary: '#02665E',
  wine500: '#b26164',
  wine700: '#8E4B4F',
  plum500: '#8C5E7B',
  plum700: '#643D57',
  blue500: '#6B8DA9',
  blue700: '#47698B',
  blue900: '#264B6C',
  iris500: '#746C99',
  bg: '#F3F1F0',
  bgCard: '#FFFFFF',
  text: '#2D2A2A',
  textSecondary: '#685E5F',
  textDisabled: '#A39C9D',
  border: '#DFDBDA',
  focusRing: 'rgba(2,102,94,.35)',
  positive: '#3F827B',
  negative: '#b26164',
  warning: '#643D57',
  info: '#47698B',
  plan: '#bbac9b',
} as const;

/** Tableau Classic / Tableau 10 */
export const TABLEAU_CLASSIC_10 = [
  '#4E79A7',
  '#F28E2B',
  '#E15759',
  '#76B7B2',
  '#59A14F',
  '#EDC948',
  '#B07AA1',
  '#FF9DA7',
  '#9C755F',
  '#BAB0AC',
] as const;

/** Tableau 20 (paired light/dark) */
export const TABLEAU_20 = [
  '#4E79A7',
  '#A0CBE8',
  '#F28E2B',
  '#FFBE7D',
  '#59A14F',
  '#8CD17D',
  '#B6992D',
  '#F1CE63',
  '#499894',
  '#86BCB6',
  '#E15759',
  '#FF9D9A',
  '#79706E',
  '#BAB0AC',
  '#D37295',
  '#FABFD2',
  '#B07AA1',
  '#D4A6C8',
  '#9D7660',
  '#D7B5A6',
] as const;

/** Tableau Color Blind 10 */
export const TABLEAU_COLOR_BLIND_10 = [
  '#006BA4',
  '#FF800E',
  '#ABABAB',
  '#595959',
  '#5F9ED1',
  '#C85200',
  '#898989',
  '#A2C8EC',
  '#FFBC79',
  '#CFCFCF',
] as const;

/** Traffic Light (categorical) + Green–Orange–Blue accents */
export const TABLEAU_TRAFFIC_GOB = [
  '#1A9850',
  '#FDAE61',
  '#2C7BB6',
  '#D73027',
  '#FEE08B',
  '#4575B4',
  '#91CF60',
  '#F46D43',
] as const;

/** Seattle Grays / gray sequential for mono charts */
export const TABLEAU_SEATTLE_GRAYS = [
  '#C7C7C7',
  '#A2A2A2',
  '#7D7D7D',
  '#595959',
  '#3C3C3C',
  '#252525',
  '#E8E8E8',
  '#B0B0B0',
] as const;

export const DEFAULT_THEME_ID = 'wide-light';

/** Chart palette presets (Styles modal) — selectable independently of theme. */
export const CHART_PALETTES: ChartPalettePreset[] = [
  {
    id: 'wide-brand',
    name: 'Wide Brand',
    description: 'Фирменные teal / sand / wine',
    colors: [
      BRAND.primary,
      BRAND.teal700,
      BRAND.blue700,
      BRAND.sand500,
      BRAND.wine500,
      BRAND.plum700,
      BRAND.teal300,
      BRAND.blue500,
    ],
    accentHint: BRAND.primary,
  },
  {
    id: 'tableau-10',
    name: 'Tableau 10',
    description: 'Tableau Classic 10',
    colors: [...TABLEAU_CLASSIC_10],
    accentHint: TABLEAU_CLASSIC_10[0],
  },
  {
    id: 'tableau-20',
    name: 'Tableau 20',
    description: '20 парных оттенков',
    colors: [...TABLEAU_20],
    accentHint: TABLEAU_20[0],
  },
  {
    id: 'tableau-colorblind-10',
    name: 'Color Blind 10',
    description: 'Tableau Color Blind 10',
    colors: [...TABLEAU_COLOR_BLIND_10],
    accentHint: TABLEAU_COLOR_BLIND_10[0],
  },
  {
    id: 'tableau-traffic-gob',
    name: 'Traffic / G–O–B',
    description: 'Светофор + зелёный–оранжевый–синий',
    colors: [...TABLEAU_TRAFFIC_GOB],
    accentHint: TABLEAU_TRAFFIC_GOB[2],
  },
  {
    id: 'tableau-seattle-grays',
    name: 'Seattle Grays',
    description: 'Серая последовательность для mono-чартов',
    colors: [...TABLEAU_SEATTLE_GRAYS],
    accentHint: TABLEAU_SEATTLE_GRAYS[3],
  },
];

export const THEMES: ThemeConfig[] = [
  {
    id: DEFAULT_THEME_ID,
    name: 'Wide Light',
    description: 'Фирменная светлая палитра (по умолчанию)',
    background: BRAND.bg,
    surface: BRAND.bgCard,
    text: BRAND.text,
    muted: BRAND.textSecondary,
    accent: BRAND.primary,
    border: BRAND.border,
    chartPalette: [
      BRAND.primary,
      BRAND.teal700,
      BRAND.blue700,
      BRAND.sand500,
      BRAND.wine500,
      BRAND.plum700,
      BRAND.teal300,
      BRAND.blue500,
    ],
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
    radius: 10,
    shadow: '0 1px 2px rgba(45, 42, 42, 0.04)',
  },
  {
    id: 'wide-sand',
    name: 'Wide Sand',
    description: 'Тёплый песочный фон, teal-акцент',
    background: BRAND.sand50,
    surface: BRAND.bgCard,
    text: BRAND.text,
    muted: BRAND.textSecondary,
    accent: BRAND.teal700,
    border: BRAND.sand300,
    chartPalette: [
      BRAND.teal700,
      BRAND.sand500,
      BRAND.primary,
      BRAND.blue700,
      BRAND.wine500,
      BRAND.plum500,
    ],
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
    radius: 10,
    shadow: '0 1px 2px rgba(45, 42, 42, 0.04)',
  },
  {
    id: 'wide-ink',
    name: 'Wide Ink',
    description: 'Светлый холст, глубокий teal-900',
    background: BRAND.grey50,
    surface: BRAND.bgCard,
    text: BRAND.text,
    muted: BRAND.textSecondary,
    accent: BRAND.teal900,
    border: BRAND.grey300,
    chartPalette: [
      BRAND.teal900,
      BRAND.blue900,
      BRAND.plum700,
      BRAND.sand500,
      BRAND.wine700,
      BRAND.teal500,
    ],
    fontFamily: '"Segoe UI", "PT Sans", system-ui, sans-serif',
    radius: 8,
    shadow: '0 1px 2px rgba(45, 42, 42, 0.04)',
  },

  // —— Styles library (usable at 1024×768) ——
  {
    id: 'swiss',
    name: 'Швейцарский',
    description:
      'International Typographic Style: белое поле, Helvetica, чёрный/красный, тонкие линии',
    background: '#FFFFFF',
    surface: '#FFFFFF',
    text: '#111111',
    muted: '#666666',
    accent: '#E30613',
    border: '#111111',
    chartPalette: [
      '#111111',
      '#E30613',
      '#444444',
      '#888888',
      '#B00000',
      '#CCCCCC',
      '#222222',
      '#FF4D4D',
    ],
    fontFamily: 'Helvetica, "Helvetica Neue", Arial, "Arial Unicode MS", sans-serif',
    radius: 0,
    shadow: 'none',
  },
  {
    id: 'flat',
    name: 'Флэт',
    description: 'Flat UI: сплошные цвета, без теней, простые карточки',
    background: '#ECF0F1',
    surface: '#FFFFFF',
    text: '#2C3E50',
    muted: '#7F8C8D',
    accent: '#3498DB',
    border: '#BDC3C7',
    chartPalette: [
      '#3498DB',
      '#E74C3C',
      '#2ECC71',
      '#F39C12',
      '#9B59B6',
      '#1ABC9C',
      '#E67E22',
      '#34495E',
    ],
    fontFamily: '"Segoe UI", "Trebuchet MS", system-ui, sans-serif',
    radius: 6,
    shadow: 'none',
  },
  {
    id: 'tableau',
    name: 'Tableau',
    description: 'BI-вид: Classic 10, светло-серый холст, синие заголовки',
    background: '#F5F5F5',
    surface: '#FFFFFF',
    text: '#333333',
    muted: '#666666',
    accent: '#4E79A7',
    border: '#D4D4D4',
    chartPalette: [...TABLEAU_CLASSIC_10],
    fontFamily: '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
    radius: 2,
    shadow: '0 0 0 1px rgba(0,0,0,0.04)',
    headerBg: '#4E79A7',
    preferredPaletteId: 'tableau-10',
  },
  {
    id: 'neo-brutalism',
    name: 'Нео-брутализм',
    description:
      'Толстые чёрные рамки, жёсткая offset-тень, жирный шрифт, плоские контрастные блоки',
    background: '#FFFDF5',
    surface: '#FFFFFF',
    text: '#0A0A0A',
    muted: '#444444',
    accent: '#FF5A36',
    border: '#0A0A0A',
    chartPalette: [
      '#FF5A36',
      '#2D6CDF',
      '#FFD400',
      '#00C2A8',
      '#0A0A0A',
      '#FF7AD9',
      '#7CFF6B',
      '#9B5DE5',
    ],
    fontFamily: '"Arial Black", "Helvetica Neue", Impact, Arial, sans-serif',
    radius: 0,
    shadow: '4px 4px 0 #0A0A0A',
  },
  {
    id: 'avant-garde',
    name: 'Авангард',
    description:
      'Выразительная типографика, асимметрия, сильный контраст форм; читаемая BI-палитра',
    background: '#F7F2EA',
    surface: '#FFFEFB',
    text: '#1C1420',
    muted: '#6B5E6E',
    accent: '#C41E3A',
    border: '#1C1420',
    chartPalette: [
      '#C41E3A',
      '#1C3A5F',
      '#E8A838',
      '#2A9D8F',
      '#6B2D5C',
      '#E76F51',
      '#264653',
      '#A8DADC',
    ],
    fontFamily: 'Georgia, "Times New Roman", "Palatino Linotype", serif',
    radius: 0,
    shadow: '0 12px 0 -8px rgba(28, 20, 32, 0.35)',
    headerBg: '#1C1420',
  },
];

const LEGACY_THEME_MAP: Record<string, string> = {
  'slate-teal': DEFAULT_THEME_ID,
  'paper-ink': 'wide-ink',
  forest: DEFAULT_THEME_ID,
};

export function normalizeThemeId(id: string | undefined | null): string {
  if (!id) return DEFAULT_THEME_ID;
  if (THEMES.some((t) => t.id === id)) return id;
  return LEGACY_THEME_MAP[id] ?? DEFAULT_THEME_ID;
}

export function getTheme(id: string): ThemeConfig {
  const normalized = normalizeThemeId(id);
  return THEMES.find((t) => t.id === normalized) ?? THEMES[0];
}

export function getChartPalette(id: string | undefined | null): ChartPalettePreset | undefined {
  if (!id) return undefined;
  return CHART_PALETTES.find((p) => p.id === id);
}

export function normalizeChartPaletteId(id: string | undefined | null): string | undefined {
  if (!id) return undefined;
  return CHART_PALETTES.some((p) => p.id === id) ? id : undefined;
}

/**
 * Theme + optional independent chart palette override.
 * Palette colors replace series colors; accentHint may tint theme accent.
 */
export function resolveTheme(
  themeId: string,
  chartPaletteId?: string | null,
  opts?: { applyAccentHint?: boolean },
): ThemeConfig {
  const base = getTheme(themeId);
  const pal = getChartPalette(normalizeChartPaletteId(chartPaletteId));
  if (!pal) return base;
  const applyAccent = opts?.applyAccentHint !== false;
  return {
    ...base,
    chartPalette: [...pal.colors],
    accent: applyAccent && pal.accentHint ? pal.accentHint : base.accent,
  };
}

/** Apply theme tokens as CSS variables on an element (studio/viewer). */
export function themeToCssVars(theme: ThemeConfig): Record<string, string> {
  return {
    '--theme-bg': theme.background,
    '--theme-surface': theme.surface,
    '--theme-text': theme.text,
    '--theme-muted': theme.muted,
    '--theme-accent': theme.accent,
    '--theme-border': theme.border,
    '--theme-font': theme.fontFamily,
    '--theme-radius': `${theme.radius ?? 10}px`,
    '--theme-shadow': theme.shadow ?? '0 1px 2px rgba(45,42,42,0.04)',
    '--theme-header': theme.headerBg || theme.accent,
  };
}

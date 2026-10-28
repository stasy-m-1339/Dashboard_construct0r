import type { ThemeConfig } from './types';

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

export const DEFAULT_THEME_ID = 'wide-light';

export const THEMES: ThemeConfig[] = [
  {
    id: DEFAULT_THEME_ID,
    name: 'Wide Light',
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
  },
  {
    id: 'wide-sand',
    name: 'Wide Sand',
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
  },
  {
    id: 'wide-ink',
    name: 'Wide Ink',
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

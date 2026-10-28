import type { ThemeConfig } from './types';

export const THEMES: ThemeConfig[] = [
  {
    id: 'slate-teal',
    name: 'Сланец и бирюза',
    background: 'linear-gradient(160deg, #0f172a 0%, #134e4a 55%, #0f172a 100%)',
    surface: 'rgba(15, 23, 42, 0.72)',
    text: '#f1f5f9',
    muted: '#94a3b8',
    accent: '#2dd4bf',
    border: 'rgba(148, 163, 184, 0.28)',
    chartPalette: ['#2dd4bf', '#38bdf8', '#a78bfa', '#fbbf24', '#fb7185', '#34d399'],
    fontFamily: '"Segoe UI", "PT Sans", system-ui, sans-serif',
  },
  {
    id: 'paper-ink',
    name: 'Бумага и чернила',
    background: 'linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)',
    surface: 'rgba(255, 255, 255, 0.92)',
    text: '#0f172a',
    muted: '#64748b',
    accent: '#0ea5e9',
    border: 'rgba(15, 23, 42, 0.12)',
    chartPalette: ['#0ea5e9', '#6366f1', '#14b8a6', '#f59e0b', '#ef4444', '#8b5cf6'],
    fontFamily: '"Georgia", "Times New Roman", serif',
  },
  {
    id: 'forest',
    name: 'Лес',
    background: 'linear-gradient(145deg, #14532d 0%, #052e16 50%, #1a2e05 100%)',
    surface: 'rgba(20, 83, 45, 0.55)',
    text: '#ecfdf5',
    muted: '#86efac',
    accent: '#84cc16',
    border: 'rgba(134, 239, 172, 0.25)',
    chartPalette: ['#84cc16', '#22c55e', '#a3e635', '#facc15', '#38bdf8', '#eab308'],
    fontFamily: '"Trebuchet MS", "Verdana", sans-serif',
  },
];

export function getTheme(id: string): ThemeConfig {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

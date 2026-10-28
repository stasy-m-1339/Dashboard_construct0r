import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { PublishedPayload } from '../shared/types';
import { getTheme } from '../shared/themes';
import { DashboardViewer } from './DashboardViewer';
import './viewer.css';

declare global {
  interface Window {
    __DASHBOARD_PAYLOAD__?: PublishedPayload;
  }
}

const payload: PublishedPayload = window.__DASHBOARD_PAYLOAD__ || {
  version: 1,
  dashboard: {
    id: 'empty',
    title: 'Пустой дашборд',
    themeId: 'slate-teal',
    tabs: [{ id: 't1', title: 'Вкладка', widgets: [] }],
    activeTabId: 't1',
  },
  datasets: [],
  theme: getTheme('slate-teal'),
};

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <ResponsiveViewer payload={payload} />
    </StrictMode>,
  );
}

function ResponsiveViewer({ payload }: { payload: PublishedPayload }) {
  const [width, setWidth] = useState(() =>
    Math.min(Math.max(window.innerWidth - 48, 320), 1400),
  );
  useEffect(() => {
    const onResize = () =>
      setWidth(Math.min(Math.max(window.innerWidth - 48, 320), 1400));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return <DashboardViewer payload={payload} width={width} />;
}

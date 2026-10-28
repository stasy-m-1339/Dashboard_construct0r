import { Toolbar } from './studio/Toolbar';
import { BlockPalette } from './studio/BlockPalette';
import { TabBar } from './studio/TabBar';
import { GridEditor } from './studio/GridEditor';
import { DataPanel } from './studio/DataPanel';
import { useStudioStore } from './store/useStudioStore';
import './studio/studio.css';

export default function App() {
  const lastError = useStudioStore((s) => s.lastError);
  const setLastError = useStudioStore((s) => s.setLastError);

  return (
    <div className="studio-app">
      <Toolbar />
      {lastError && (
        <div className="banner error" role="alert">
          <pre>{lastError}</pre>
          <button type="button" onClick={() => setLastError(null)}>
            Закрыть
          </button>
        </div>
      )}
      <div className="studio-body">
        <BlockPalette />
        <main className="studio-main">
          <TabBar />
          <GridEditor />
        </main>
        <DataPanel />
      </div>
    </div>
  );
}

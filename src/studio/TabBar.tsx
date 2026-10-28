import { useStudioStore } from '../store/useStudioStore';

export function TabBar() {
  const tabs = useStudioStore((s) => s.dashboard.tabs);
  const activeTabId = useStudioStore((s) => s.dashboard.activeTabId);
  const setActiveTab = useStudioStore((s) => s.setActiveTab);
  const addTab = useStudioStore((s) => s.addTab);
  const renameTab = useStudioStore((s) => s.renameTab);
  const removeTab = useStudioStore((s) => s.removeTab);

  return (
    <div className="tab-bar">
      {tabs.map((t) => (
        <div key={t.id} className={`tab ${t.id === activeTabId ? 'active' : ''}`}>
          <button type="button" className="tab-btn" onClick={() => setActiveTab(t.id)}>
            <input
              value={t.title}
              onChange={(e) => renameTab(t.id, e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </button>
          {tabs.length > 1 && (
            <button
              type="button"
              className="tab-close"
              aria-label="Удалить вкладку"
              onClick={() => removeTab(t.id)}
            >
              ×
            </button>
          )}
        </div>
      ))}
      <button type="button" className="btn ghost tab-add" onClick={addTab}>
        + Вкладка
      </button>
    </div>
  );
}

import { useRef, useState } from 'react';
import { BLOCK_LIBRARY } from '../shared/blocks';
import { useStudioStore } from '../store/useStudioStore';

export function BlockPalette() {
  const customBlocks = useStudioStore((s) => s.customBlocks);
  const addWidgetFromLibrary = useStudioStore((s) => s.addWidgetFromLibrary);
  const importBlockJson = useStudioStore((s) => s.importBlockJson);
  const setLastError = useStudioStore((s) => s.setLastError);
  const fileRef = useRef<HTMLInputElement>(null);
  const [paste, setPaste] = useState('');

  const all = [...BLOCK_LIBRARY, ...customBlocks];

  const handleImportText = (text: string) => {
    try {
      const raw = JSON.parse(text);
      const err = importBlockJson(raw);
      if (err) setLastError(err);
      else {
        setLastError(null);
        setPaste('');
      }
    } catch {
      setLastError('Некорректный JSON');
    }
  };

  return (
    <aside className="panel palette">
      <h2>Библиотека</h2>
      <p className="hint">Нажмите блок, чтобы добавить на текущую вкладку</p>
      <ul className="block-list">
        {all.map((b) => (
          <li key={b.id}>
            <button type="button" className="block-item" onClick={() => addWidgetFromLibrary(b.id)}>
              <strong>{b.title}</strong>
              <span>{b.description}</span>
            </button>
          </li>
        ))}
      </ul>

      <h3>Импорт JSON (внешний ИИ)</h3>
      <textarea
        className="paste-area"
        placeholder='Вставьте JSON блока, например {"type":"kpi","title":"..."}'
        value={paste}
        onChange={(e) => setPaste(e.target.value)}
        rows={4}
      />
      <div className="row-actions">
        <button type="button" className="btn" onClick={() => handleImportText(paste)} disabled={!paste.trim()}>
          Из буфера
        </button>
        <button type="button" className="btn ghost" onClick={() => fileRef.current?.click()}>
          Из файла
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            handleImportText(await file.text());
            e.target.value = '';
          }}
        />
      </div>
    </aside>
  );
}

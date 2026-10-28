# Dashboard Construct0r

Визуальный конструктор дашбордов для пользователя без кода. Студия готовит данные из CSV и MSSQL и собирает **один самодостаточный HTML** для выкладки.

## Быстрый старт

```bash
npm install
npm run build:viewer   # одноразово: шаблон viewer для «Собрать HTML»
npm run dev            # API :8787 + студия :5173
```

Откройте http://localhost:5173

1. **Демо CSV** — загрузить пример продаж и собрать демо-вкладку  
2. Настроить виджеты / тему / вкладки  
3. **Обновить данные** — прогон пайплайнов  
4. **Превью** — фильтры на снимке  
5. **Собрать HTML** — скачать один файл без внешних зависимостей  

## MSSQL

В панели «Данные» → **+ MSSQL**: сервер, база, логин, пароль, SQL в пайплайне.  
Пароли хранятся только в студии (localStorage браузера) и **не** попадают в HTML и не коммитятся в репозиторий.

## Скрипты

| Команда | Назначение |
|---------|------------|
| `npm run dev` | Студия + API |
| `npm run build:viewer` | Бандл viewer → `dist-viewer/index.html` |
| `npm run build` | Сборка студии + viewer |
| `npm run export:sample` | Собрать пример HTML в `samples/exported/` |
| `npm run verify:mvp` | Аудит MVP-требований (без cron, один HTML) |

Промпты для внешнего ИИ (пополнение библиотеки): документ в Agent Store проекта  
`docs/ai-block-prompts.md` (путь store: `/cursor/stores/self/docs/ai-block-prompts.md`).

## Структура

- `src/studio` — UI конструктора  
- `src/viewer` — рантайм дашборда (превью и экспорт)  
- `src/shared` — типы, библиотека блоков, фильтры, пайплайны  
- `server` — CSV / MSSQL / экспорт HTML  
- `samples/sales.csv` — демо-данные  

Промпты для внешних ИИ: см. документацию проекта `ai-block-prompts.md`.

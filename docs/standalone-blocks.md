# Блоки из standalone-дашборда

Источник: корпоративный `dashboard-standalone.html` (сводка, неделя/месяц, матрица, топы, фильтры).  
В студии: панель **Библиотека → Standalone (Wide)**. Тема по умолчанию — Wide Light.

| id | type | Назначение |
|----|------|------------|
| `sa-kpi-fact` | `kpi-delta` | KPI факта + Δ / % (card-fact) |
| `sa-kpi-plan` | `kpi-delta` | KPI плана/forecast + Δ |
| `sa-top-list` | `top-list` | Топ с полосками (insight-list) |
| `sa-dynamics-area` | `area` | Динамика недель/месяцев |
| `sa-combo-fact-plan` | `combo` | Столбцы факта + линия плана |
| `sa-stacked-bar` | `stacked-bar` | Составные столбцы |
| `sa-hbar` | `hbar` | Горизонтальные бары / торнадо |
| `sa-donut` | `donut` | Кольцевая диаграмма |
| `sa-waterfall` | `waterfall` | Мост отклонений (wf) |
| `sa-sales-table` | `table` | Компактная sales-tbl pos/neg |
| `sa-matrix` | `matrix` | Сводная матрица ± |
| `sa-filter-chips` | `filter-chips` | Мультивыбор чипами |
| `sa-filter-week` | `filter-select` | Селектор периода |

Как посмотреть: `npm run dev` → **Демо CSV** → в библиотеке клик по блоку `sa-*` → в **Свойствах** привязать колонки → **Превью**.

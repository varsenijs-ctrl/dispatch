# Dispatch

A personal email/SMS **dispatch tracker** (рассылки) — a single-page web app for tracking
campaign sends, clients, flows (email sequences), finances, and invoices. All data lives in the
browser's `localStorage`; there is no backend.

This project was refactored from a single 3,250-line `dispatch-tracker_20.html` into a clean
multi-file structure, and a number of bugs were fixed along the way (see **Fixes** below).

## Running it

It's a static app — no build step, no server required.

- **Easiest:** double-click `index.html` to open it in your browser (`file://`).
- **Or serve it** (nicer for PWA behaviour), e.g. from this folder:
  ```sh
  python3 -m http.server 8753
  # then open http://localhost:8753
  ```

The scripts are plain `<script>` tags (not ES modules) specifically so the `file://` double-click
path keeps working.

## ⚠️ Moving your existing data

`localStorage` is tied to the page's exact address. The old file lived in `Downloads/`, so its
data is stored under *that* location. When you open this new `index.html` (a different path/origin)
the app will look **empty at first** — your data hasn't been lost, it's just under the old address.

To carry it over:

1. Open the **old** `dispatch-tracker_20.html`.
2. Go to **Клиенты → Бэкап данных → ⬇ Экспорт в файл**. (If the old file's button doesn't work,
   that's the very bug fixed here — instead run this in the browser console on the old file:
   `var d={};for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k&&k.startsWith('dc_'))d[k]=localStorage.getItem(k);}var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(d)]));a.download='dispatch-backup.json';a.click();`)
3. Open this new app → **Клиенты → Бэкап данных → ⬆ Импорт из файла** → pick the file. The app
   reloads with your data.

Use the same Export/Import any time you want a backup.

## Project structure

```
index.html              page shell: <head>, body markup, ordered <script> tags
css/styles.css          all styles
assets/icons/           favicons (extracted from inline base64)
js/
  core.js               constants, date/escape helpers, localStorage layer, export/import,
                          legacy-key migration  (loads first)
  state.js              global state, month management, preload data, schedule helpers
  views.js              render() dispatcher, sidebar, Обзор/Сегодня/Рассылки/История views
  planner.js            Планировщик calendar + day modal + task editing
  finance-clients.js    Финансы, Клиенты list/add/import, Инвойсы, backup UI
  flows.js              Флоу: sequences, per-day flow tasks, earnings
  clients-calendar.js   client actions, per-client calendar modal, undo, toast, event binding
  ui.js                 sound effects + accent-colour theming + navigation/swipe
  main.js               startup: first render, month bar, swipe/keyboard nav  (loads last)
```

These are **classic scripts sharing one global scope**, so load order matters: `core.js` defines
the storage layer before `state.js` reads data, and `main.js` runs the initial render last. The
order is fixed by the `<script>` tags in `index.html`.

Data is namespaced per month in `localStorage` as `dc_<thing>__YYYY-MM` (e.g. `dc_history__2026-06`),
plus a few global keys (`dc_months`, `dc_active_month`, `dc_accent_color`, `dc_flows`).

## Fixes applied during the refactor

| Area | Bug | Fix |
|------|-----|-----|
| Accent colour | `setAccentColor()` / `toggleColorPicker()` were called but never defined — the whole colour picker was dead, and its swatches were an un-evaluated `${…}` template literal showing as raw text | Implemented both functions; expanded the swatches into real buttons |
| Flows → История | A stray block of audio code pasted into `renderFlows()` threw `ReferenceError` as soon as any flow was completed, crashing the History tab | Removed the misplaced block (the real sound still lives in the audio module) |
| Data backup | The Export/Import buttons existed only in static markup that `render()` immediately overwrote, so the backup feature was unreachable | Moved Export/Import into **Клиенты → Бэкап данных** where they persist |
| Dates | Several places used `toISOString()` on local dates, shifting them a day backward for users east of UTC (streak, night-task end date, history rows, schedule start) | Added a local-date `toISO()` helper and used it everywhere |
| Safety | Client names, task text, notes and flow names were injected into HTML unescaped (broken layout / injection risk) | Added an `esc()` helper and escaped all user text at render time |
| Finance | The earnings header counted only email/SMS, while the per-client rows also counted flows, so the totals didn't agree | Header now includes flow earnings too |
| Robustness | `getMonths()` could throw and white-screen on corrupted storage; the edit modal didn't pre-select a time-of-day for older tasks; dead references to a never-built flow picker and a non-existent deadline input | Guarded the JSON parse; fixed the pre-select; removed the dead code |

## Known limitations (left as-is — would change the saved-data format)

- **History is keyed by client *name*, not id.** Renaming a client would orphan its history. There
  is currently no rename UI, so it can't happen by accident, but keep it in mind.
- **Flows (`dc_flows`) are stored globally**, not per-month like everything else, and aren't
  cleaned up when a client is deleted. Harmless, but flow definitions are shared across months.

---
name: dispatch-daily-sync
description: Парсит ClickUp My Work и инжектит задачи напрямую в Dispatch через Chrome
---

## Dispatch Daily Sync

### Шаг 1 — Получить задачи из ClickUp

Навигируй к https://app.clickup.com/90121718809/my-work/today через mcp__Claude_in_Chrome__navigate, подожди 3 секунды (bash sleep 3), затем mcp__Claude_in_Chrome__get_page_text. Извлеки все задачи из секции Today — название, дедлайн, клиент/список.

### Шаг 2 — Прочитать клиентов и существующие задачи из Dispatch

Навигируй к https://varsenijs-ctrl.github.io/dispatch/ (тот же tabId), подожди 3 секунды, затем выполни javascript_tool:

```javascript
(function(){
  // Clients are stored per-month: dc_clients__YYYY-MM. Collect all active clients across all months.
  var clientMap = {};
  Object.keys(localStorage)
    .filter(function(k){ return k.startsWith('dc_clients__'); })
    .forEach(function(k){
      try {
        JSON.parse(localStorage.getItem(k) || '[]').forEach(function(c){
          if(c.active && !clientMap[c.id]) clientMap[c.id] = c;
        });
      } catch(e) {}
    });
  var clients = Object.values(clientMap).map(function(c){ return { id: c.id, name: c.name }; });

  var allTasks = [];
  Object.keys(localStorage)
    .filter(function(k){ return k.startsWith('dc_plantasks__'); })
    .forEach(function(k){
      try {
        allTasks = allTasks.concat(Object.values(JSON.parse(localStorage.getItem(k) || '{}')));
      } catch(e) {}
    });

  return { clients: clients, existingTasks: allTasks.map(function(t){ return { text: t.text, cid: t.cid, done: t.done }; }) };
})()
```

### Шаг 3 — Собрать задачи и проставить клиентов

Для каждой задачи из ClickUp найди клиента в списке из Шага 2 (case-insensitive по вхождению имени).

**Важно:** перед сравнением нормализуй обе строки — убери все пробелы и приведи к нижнему регистру. Например, "Biker Vision" → "bikervision" совпадает с "BikerVision" → "bikervision".

- Если клиент **найден**: убери его имя из текста задачи, проставь cid и clientName.
- Если клиент **не найден**: оставь текст задачи полностью как есть (не вырезай ничего), cid: '', clientName: '', в note напиши имя клиента из ClickUp.

Правила дат:
- startIso, until, deadline — всегда строки 'YYYY-MM-DD' (startIso = сегодня)
- Если дедлайн = "Today" → сегодняшняя дата
- Если диапазон "Today - Wed" → until/deadline = ближайшая среда

### Шаг 4 — Инжектировать в Dispatch

Подставь реальные задачи, затем выполни javascript_tool:

```javascript
(function(){
  var today = new Date();
  var pad = function(n){ return String(n).padStart(2,'0'); };
  var todayIso = today.getFullYear()+'-'+pad(today.getMonth()+1)+'-'+pad(today.getDate());
  var month = today.getFullYear()+'-'+pad(today.getMonth()+1);
  var version = todayIso + 'T001';
  var injectKey = 'dc_inject_v__' + version;
  if(localStorage.getItem(injectKey)) { return 'already injected: ' + version; }

  var tasksKey = 'dc_plantasks__' + month;
  var tasks = {};
  try { tasks = JSON.parse(localStorage.getItem(tasksKey) || '{}'); } catch(e) {}

  var allExisting = [];
  Object.keys(localStorage)
    .filter(k => k.startsWith('dc_plantasks__'))
    .forEach(k => {
      try { allExisting = allExisting.concat(Object.values(JSON.parse(localStorage.getItem(k) || '{}')));} catch(e) {}
    });

  var newTasks = [
    // ПОДСТАВЬ РЕАЛЬНЫЕ ЗАДАЧИ СЮДА:
    { id: 'inject_clickup_XXX', text: 'Task name', cid: 'c_preload_XXX', clientName: 'Client', startIso: todayIso, until: 'YYYY-MM-DD', deadline: 'YYYY-MM-DD', done: false, note: 'ClickUp' }
  ];

  var added = [], skipped = [];
  newTasks.forEach(function(t){
    var dup = allExisting.find(function(e){ return e.text === t.text && e.cid === t.cid; });
    if(dup) { skipped.push(t.text + ' / ' + (t.clientName || t.note || '?') + (dup.done ? ' [done]' : ' [exists]')); }
    else { tasks[t.id] = t; added.push(t.text + ' / ' + (t.clientName || t.note || 'unknown')); }
  });

  localStorage.setItem(tasksKey, JSON.stringify(tasks));
  localStorage.setItem(injectKey, '1');
  return 'injected ' + added.length + ' new, ' + skipped.length + ' skipped. Added: ' + JSON.stringify(added) + '. Skipped: ' + JSON.stringify(skipped);
})()
```

### Шаг 5 — Отчёт

Напиши: сколько задач инжектировано, сколько пропущено (и почему — [done] или [exists]), какие клиенты не нашлись в Dispatch.

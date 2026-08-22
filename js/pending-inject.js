// ── Dispatch ← ClickUp auto-sync ────────────────────────────────────────────
// This file is regenerated EVERY 15 MINUTES by .github/workflows/clickup-sync.yml
// (the GitHub Action fetches your ClickUp tasks and rewrites the RAW list + version).
//
// Client matching happens HERE, in the browser, against your real client list
// (localStorage dc_clients__*), so each task gets a proper client (cid + badge)
// exactly as if you'd picked it from the dropdown — not just text in a note.
//   • startIso  = the ClickUp due day (so overdue/today/next sort correctly)
//   • deadline  = the ClickUp due date (when it turns red)
//   • bucket    = the CURRENT work zone (activeMonth) — every task lands where
//                 you're working, so nothing hides in another month's zone.
// Already-injected ClickUp tasks (by their id) are never added twice.

(function(){
  var INJECT_VERSION = '2026-08-22T0112';   // bumped by the Action on every sync

  // Raw ClickUp tasks. Each: {id, name, list, due(ms)}. The Action overwrites this.
  var RAW = /*RAW_START*/[
    {
      "id": "869dtzgn9",
      "name": "test",
      "list": "Personal List",
      "start": "",
      "due": "",
      "prio": 0
    },
    {
      "id": "869ejaekv",
      "name": "BlockBlaster | Publish emails",
      "list": "BlockBlaster",
      "start": "",
      "due": "1786914000000",
      "prio": 0
    },
    {
      "id": "869ekutpp",
      "name": "Revair | Publish emails",
      "list": "Revair",
      "start": "",
      "due": "1787259600000",
      "prio": 0
    },
    {
      "id": "869enbw3v",
      "name": " ENZ1 | Publish emails",
      "list": "ENZ1",
      "start": "",
      "due": "1787432400000",
      "prio": 0
    }
  ]/*RAW_END*/;

  // RAW пересчитывается при каждой загрузке: задача узнаётся по своему ClickUp id,
  // поэтому дубликатов нет, а удалённая руками (dc_inject_removed) не возвращается.
  // Data is global now — one task store, no zones.
  var _t = new Date();
  var _p = function(n){ return String(n).padStart(2,'0'); };
  var TODAY_ISO = _t.getFullYear()+'-'+_p(_t.getMonth()+1)+'-'+_p(_t.getDate());

  // ms → YYYY-MM-DD in the user's own timezone (so it matches the ClickUp date)
  function isoFromMs(ms){
    if(!ms) return '';
    try { return new Date(Number(ms)).toLocaleDateString('en-CA'); } // en-CA = ISO order
    catch(e){ var d=new Date(Number(ms)); return d.getFullYear()+'-'+_p(d.getMonth()+1)+'-'+_p(d.getDate()); }
  }

  // clients — the single global list
  var clientList = []; try{ clientList = JSON.parse(localStorage.getItem('dc_clients')||'[]')||[]; }catch(e){ clientList=[]; }

  function norm(s){ return (s||'').toLowerCase().replace(/[^a-z0-9а-я]/gi,''); }
  function bigrams(s){ s=norm(s); var b=[]; for(var i=0;i<s.length-1;i++) b.push(s.slice(i,i+2)); return b; }
  // Sørensen–Dice similarity 0..1 (tolerant to spelling/spacing/typos)
  function dice(a,b){
    var A=bigrams(a), B=bigrams(b); if(!A.length||!B.length) return 0;
    var m={}; A.forEach(function(g){ m[g]=(m[g]||0)+1; });
    var inter=0; B.forEach(function(g){ if(m[g]>0){ inter++; m[g]--; } });
    return 2*inter/(A.length+B.length);
  }
  // the client part of a ClickUp title (before the first "- | : [ ]")
  function firstSeg(name){ var p=(name||'').split(/[-|:\[\]]/); for(var i=0;i<p.length;i++){ if(p[i].trim()) return p[i].trim(); } return name||''; }
  // find the best Dispatch client: exact substring wins; otherwise fuzzy match
  // the title's client-part / list name (so variants & typos still resolve).
  function matchClient(name, list){
    var hay = norm(name) + '|' + norm(list);
    var seg = firstSeg(name);
    var best = null, bestScore = 0;
    clientList.forEach(function(c){
      var n = norm(c.name); if(n.length < 3) return;
      var score;
      if(hay.indexOf(n) >= 0) score = 1 + n.length/1000;                 // contained → strong (longer wins)
      else score = Math.max(dice(seg, c.name), dice(list, c.name), dice(name, c.name));
      if(score > bestScore){ bestScore = score; best = c; }
    });
    return bestScore >= 0.62 ? best : null;   // ~1 for substring, ≥0.62 for fuzzy
  }
  function cleanText(s){
    return (s||'')
      .replace(/\[\s*\]|\(\s*\)/g,' ')
      .replace(/^[\s\-–—|:]+|[\s\-–—|:]+$/g,'')
      .replace(/\s{2,}/g,' ')
      .trim();
  }
  function stripName(text, name){
    // 1) exact occurrence anywhere — handles "[BikerVision] …", "Nevo | …"
    var lt = text.toLowerCase(), ln = name.toLowerCase();
    var i = lt.indexOf(ln);
    if(i >= 0){ var out = text.slice(0, i) + text.slice(i + name.length); return cleanText(out) || cleanText(text); }
    // 2) fuzzy LEADING mention — handles spacing/punct diffs like
    //    "Bloomie Blankets:" ↔ "BloomieBlankets", "WildHarvest:" ↔ "Wild Harvest©"
    var nn = norm(name);
    if(nn){
      var consumed = '', j = 0;
      while(j < text.length && norm(consumed).length < nn.length){ consumed += text[j]; j++; }
      if(norm(consumed) === nn){ var rest = cleanText(text.slice(j)); if(rest) return rest; }
    }
    return cleanText(text);
  }

  // ── Добавляем задачи из ClickUp ──────────────────────────────────────────
  // Новые задачи появляются, у уже добавленных обновляются даты/дедлайн/приоритет.
  // Ничего не удаляется: задача, исчезнувшая из ClickUp (закрыли, переназначили),
  // остаётся в приложении — убрать её можно вручную. Одна и та же задача не
  // добавляется дважды (по её ClickUp id). РУЧНЫЕ задачи не трогаем вообще.
  var tasks; try{ tasks = JSON.parse(localStorage.getItem('dc_plantasks')||'{}')||{}; }catch(e){ tasks={}; }
  var gone = {};   // задачи, удалённые вручную — не возвращаем их при каждом синке
  try{ (JSON.parse(localStorage.getItem('dc_inject_removed')||'[]')||[]).forEach(function(x){ gone[x]=1; }); }catch(e){}
  var added = 0, matched = 0, updated = 0;
  RAW.forEach(function(r){
    if(!r || !r.id) return;
    var id = 'inject_' + r.id;
    if(gone[r.id] && !tasks[id]) return;
    var newDue   = isoFromMs(r.due);                          // ClickUp DUE  → deadline
    var newStart = isoFromMs(r.start) || newDue || TODAY_ISO; // ClickUp START → startIso (falls back to due)
    var newPrio  = +r.prio || 0;
    var existing = tasks[id];
    if(existing){
      // keep dates/deadline/priority synced with ClickUp; never touch `done`
      if(existing.injStart !== newStart){ existing.startIso = newStart; existing.injStart = newStart; updated++; }
      if(existing.injDue   !== newDue){   existing.deadline = newDue; existing.until = newDue || existing.until || newStart; existing.injDue = newDue; updated++; }
      existing.prio = newPrio;
      return;
    }
    var c = matchClient(r.name, r.list);
    var text = c ? stripName(r.name, c.name) : r.name; if(!text) text = r.name;
    var hint = (r.list && r.list !== 'Imported From Trello') ? r.list : firstSeg(r.name);
    tasks[id] = {
      id: id, injectId: r.id, text: text,
      cid: c ? c.id : '', clientName: c ? c.name : '',
      startIso: newStart, until: newDue || newStart, deadline: newDue || '',
      injStart: newStart, injDue: newDue,
      prio: newPrio,                                   // ClickUp priority (0-4)
      done: false, note: c ? 'ClickUp' : ('ClickUp: ' + hint)
    };
    added++; if(c) matched++;
  });
  // Задачи, которых больше нет в ClickUp, НЕ удаляются: их переназначили,
  // закрыли или убрали в ClickUp, а работа за тобой всё равно записана — пусть
  // остаётся в планировщике, пока сам не удалишь. Раньше это был жёсткий mirror,
  // и такие задачи молча исчезали из приложения.
  localStorage.setItem('dc_plantasks', JSON.stringify(tasks));
  try{ localStorage.removeItem('dc_inject_seen'); }catch(e){}   // legacy suppression list — no longer used
  console.log('Dispatch ← ClickUp: ('+added+' added, '+updated+' synced, '+matched+' matched, старые сохранены) · '+INJECT_VERSION);
})();

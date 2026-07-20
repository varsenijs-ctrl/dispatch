// ── Dispatch ← ClickUp auto-sync ────────────────────────────────────────────
// This file is regenerated DAILY by .github/workflows/clickup-sync.yml (the
// GitHub Action fetches your ClickUp tasks and rewrites the RAW list + version).
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
  var INJECT_VERSION = '2026-07-20T001';   // bumped daily by the Action

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
      "id": "869e0rkuz",
      "name": "Nura Relief | Publish emails",
      "list": "Nura Relief",
      "start": "1783386000000",
      "due": "1783630800000",
      "prio": 0
    },
    {
      "id": "869e1dzt8",
      "name": "Nura Relief | Publish emails",
      "list": "Nura Relief",
      "start": "1783386000000",
      "due": "1783717200000",
      "prio": 0
    },
    {
      "id": "869e2a78j",
      "name": "enhancedhim | Build flows",
      "list": "enhancedhim",
      "start": "",
      "due": "1784062800000",
      "prio": 0
    },
    {
      "id": "869e4bygf",
      "name": "Auna Beauty | Publish emails",
      "list": "Auna Beauty",
      "start": "",
      "due": "1784235600000",
      "prio": 0
    },
    {
      "id": "869e51vdt",
      "name": "Snatched | Flow Builds",
      "list": "SNATCHED",
      "start": "",
      "due": "1784246400000",
      "prio": 0
    },
    {
      "id": "869e484e3",
      "name": "WildHarvest | Trust Pilot Email #2 | Build",
      "list": "Wild Harvest©",
      "start": "",
      "due": "1784246400000",
      "prio": 2
    },
    {
      "id": "869dnf5x4",
      "name": "Bare Rituals: Post-Purchase Flow Audit & Restructure + Replenishment & Cross-Sell Flow Build (OCU)",
      "list": "BareRitual",
      "start": "",
      "due": "1784250000000",
      "prio": 2
    },
    {
      "id": "869e5gv83",
      "name": "Ruvelo | Publish emails",
      "list": "Ruvelo",
      "start": "",
      "due": "1784322000000",
      "prio": 0
    },
    {
      "id": "869e4zphd",
      "name": "Sculptara™ | Publish emails",
      "list": "Sculptara™",
      "start": "1784250000000",
      "due": "1784322000000",
      "prio": 0
    },
    {
      "id": "869e51qm9",
      "name": "Publish emails",
      "list": "Velcura",
      "start": "1784077200000",
      "due": "1784336400000",
      "prio": 0
    },
    {
      "id": "869e4c356",
      "name": "Luvura | Publish flows",
      "list": "Luvura",
      "start": "",
      "due": "1784494800000",
      "prio": 0
    }
  ]/*RAW_END*/;

  // RAW is re-processed on every load; any ClickUp id ever injected (dc_inject_seen)
  // is skipped — new tasks appear, nothing duplicates, deleted tasks stay deleted.
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

  // ── one-time: clean re-sync of ClickUp tasks ────────────────────────────
  // Drops the previously-injected ClickUp tasks (keeps your MANUAL ones) and clears
  // dc_inject_seen, so the RAW list above re-injects the CURRENT ClickUp board in full
  // — no stale tasks from earlier syncs linger, none are missing. Bump the flag version
  // (…_v10, _v11…) whenever you want another clean re-sync.
  if(!localStorage.getItem('dc_inject_reset_v10')){
    localStorage.removeItem('dc_inject_seen');
    try{ var _tp=JSON.parse(localStorage.getItem('dc_plantasks')||'{}')||{}; Object.keys(_tp).forEach(function(k){ if(_tp[k]&&_tp[k].injectId) delete _tp[k]; }); localStorage.setItem('dc_plantasks', JSON.stringify(_tp)); }catch(e){}
    localStorage.setItem('dc_inject_reset_v10','1');
  }

  // ── existing tasks (single global store): dedupe ONLY by ClickUp id (unique) ──
  // NOT by text — two distinct ClickUp tasks can share a name (e.g. two "Nura Relief
  // | Publish emails"); dropping by text lost the second one.
  var tasks; try{ tasks = JSON.parse(localStorage.getItem('dc_plantasks')||'{}')||{}; }catch(e){ tasks={}; }
  var seenIds = {};
  Object.values(tasks).forEach(function(t){ if(!t) return; if(t.injectId) seenIds[t.injectId]=1; });
  try { (JSON.parse(localStorage.getItem('dc_inject_seen')||'[]')||[]).forEach(function(id){ seenIds[id]=1; }); } catch(e){}

  var added = 0, matched = 0, updated = 0;
  RAW.forEach(function(r){
    if(!r || !r.id) return;
    var id = 'inject_' + r.id;
    var newDue   = isoFromMs(r.due);                          // ClickUp DUE  → deadline
    var newStart = isoFromMs(r.start) || newDue || TODAY_ISO; // ClickUp START → startIso (falls back to due)
    var newPrio  = +r.prio || 0;
    var existing = tasks[id];

    if(existing){
      // Already here → keep dates/deadline/priority in sync with ClickUp. Only apply
      // when ClickUp's own value CHANGED (injStart/injDue = last synced), so a manual
      // local move survives while ClickUp is unchanged. Never touches `done`.
      if(existing.injStart !== newStart){ existing.startIso = newStart; existing.injStart = newStart; updated++; }
      if(existing.injDue   !== newDue){   existing.deadline = newDue; existing.until = newDue || existing.until || newStart; existing.injDue = newDue; updated++; }
      existing.prio = newPrio;
      seenIds[r.id] = 1;
      return;
    }
    if(seenIds[r.id]) return;                                  // injected before, user deleted it → stays deleted

    var c = matchClient(r.name, r.list);
    var text = c ? stripName(r.name, c.name) : r.name; if(!text) text = r.name;
    var hint = (r.list && r.list !== 'Imported From Trello') ? r.list : firstSeg(r.name);
    tasks[id] = {
      id: id, injectId: r.id, text: text,
      cid: c ? c.id : '', clientName: c ? c.name : '',
      startIso: newStart, until: newDue || newStart, deadline: newDue || '',
      injStart: newStart, injDue: newDue,              // remember the synced ClickUp dates
      prio: newPrio,                                   // ClickUp priority (0-4)
      done: false, note: c ? 'ClickUp' : ('ClickUp: ' + hint)
    };
    seenIds[r.id] = 1; added++; if(c) matched++;
  });

  localStorage.setItem('dc_plantasks', JSON.stringify(tasks));
  localStorage.setItem('dc_inject_seen', JSON.stringify(Object.keys(seenIds)));
  console.log('Dispatch ← ClickUp: +'+added+' tasks ('+matched+' matched, '+updated+' date-synced) · '+INJECT_VERSION);
})();

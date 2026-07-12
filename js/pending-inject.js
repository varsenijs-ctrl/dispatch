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
  var INJECT_VERSION = '2026-07-12T001';   // bumped daily by the Action

  // Raw ClickUp tasks. Each: {id, name, list, due(ms)}. The Action overwrites this.
  var RAW = /*RAW_START*/[
    {
      "id": "869dw2j9e",
      "name": "Orvia Labs - Delivery Flow - Build",
      "list": "Orvia Labs",
      "start": "1783123200000",
      "due": "1783296000000",
      "prio": 0
    },
    {
      "id": "869dyuanp",
      "name": "[Poke Source]: July: New Email Request: #2: Build",
      "list": "pokesource",
      "start": "",
      "due": "1783468800000",
      "prio": 0
    },
    {
      "id": "869dyu5fc",
      "name": "[Poke Source]: July: New Email Request: Build",
      "list": "pokesource",
      "start": "",
      "due": "1783468800000",
      "prio": 0
    },
    {
      "id": "869e1kuy0",
      "name": "Pilloway | Publish emails",
      "list": "Pilloway",
      "start": "",
      "due": "1783544400000",
      "prio": 0
    },
    {
      "id": "869e1xrg3",
      "name": "Publishing",
      "list": "Drinkretros.com",
      "start": "",
      "due": "1783558800000",
      "prio": 0
    },
    {
      "id": "869dnvbhd",
      "name": "LifeList Lab - Jul-2026 - Campaigns",
      "list": "LifeList Lab",
      "start": "",
      "due": "1783558800000",
      "prio": 2
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
      "id": "869e0gghm",
      "name": "Sabel Life | Build campaigns",
      "list": "Sabel Life",
      "start": "",
      "due": "1783630800000",
      "prio": 0
    },
    {
      "id": "869dwqdpy",
      "name": "Garden's Pulse - Campaigns - July - Build",
      "list": "Garden's Pulse",
      "start": "1783036800000",
      "due": "1783641600000",
      "prio": 0
    },
    {
      "id": "869dwqctg",
      "name": "[FaithIsMade] New Post Purchase Flow: Build",
      "list": "FaithIsMade",
      "start": "1782691200000",
      "due": "1783641600000",
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
      "id": "869dzbkjq",
      "name": "Sabel Life | Built flow ",
      "list": "Sabel Life",
      "start": "",
      "due": "1783717200000",
      "prio": 0
    },
    {
      "id": "869e300vg",
      "name": "BlockBlaster | Publish emails",
      "list": "BlockBlaster",
      "start": "1783645200000",
      "due": "1783803600000",
      "prio": 0
    },
    {
      "id": "869e3e9hd",
      "name": "BlockBlaster | Publish emails",
      "list": "BlockBlaster",
      "start": "",
      "due": "1783890000000",
      "prio": 0
    },
    {
      "id": "869e1pvtm",
      "name": "enhancedhim | Build campaigns",
      "list": "enhancedhim",
      "start": "",
      "due": "1783890000000",
      "prio": 0
    },
    {
      "id": "869e2uf1k",
      "name": "Pepticool - draft July campaigns",
      "list": "Pepticool",
      "start": "",
      "due": "1783976340000",
      "prio": 0
    },
    {
      "id": "869e2uf0t",
      "name": "Ilovehue (Still Archive) - draft July campaigns",
      "list": "ilovehue",
      "start": "",
      "due": "1783976340000",
      "prio": 0
    },
    {
      "id": "869e2kckf",
      "name": "July campaigns - publishing",
      "list": "Avera",
      "start": "",
      "due": "1783976340000",
      "prio": 0
    },
    {
      "id": "869e3c6gd",
      "name": "Sculptara™ | Publish emails",
      "list": "Sculptara™",
      "start": "1783731600000",
      "due": "1783976400000",
      "prio": 0
    },
    {
      "id": "869e2a78j",
      "name": "enhancedhim | Build flows",
      "list": "enhancedhim",
      "start": "",
      "due": "1784062800000",
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

  // ── one-time: re-add ALL ClickUp tasks ──────────────────────────────────
  // You deleted every task and want them all back. Clearing dc_inject_seen once
  // lets the RAW list above re-inject IN FULL on the next load (deleted-stays-
  // deleted resumes afterwards). To force another full re-add later, bump this
  // flag version (…_v9, _v10…) — that's the whole "разово добавить всё заново".
  if(!localStorage.getItem('dc_inject_reset_v8')){
    localStorage.removeItem('dc_inject_seen');
    localStorage.setItem('dc_inject_reset_v8','1');
  }

  // ── existing tasks (single global store): dedupe by ClickUp id + by text+client ──
  var tasks; try{ tasks = JSON.parse(localStorage.getItem('dc_plantasks')||'{}')||{}; }catch(e){ tasks={}; }
  var seenIds = {}, texts = {};
  Object.values(tasks).forEach(function(t){ if(!t) return; if(t.injectId) seenIds[t.injectId]=1; texts[norm(t.text)+'|'+(t.cid||'')]=1; });
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
    var key = norm(text)+'|'+(c?c.id:'');
    if(texts[key]) return;                                     // identical task already present
    var hint = (r.list && r.list !== 'Imported From Trello') ? r.list : firstSeg(r.name);
    tasks[id] = {
      id: id, injectId: r.id, text: text,
      cid: c ? c.id : '', clientName: c ? c.name : '',
      startIso: newStart, until: newDue || newStart, deadline: newDue || '',
      injStart: newStart, injDue: newDue,              // remember the synced ClickUp dates
      prio: newPrio,                                   // ClickUp priority (0-4)
      done: false, note: c ? 'ClickUp' : ('ClickUp: ' + hint)
    };
    texts[key] = 1; seenIds[r.id] = 1; added++; if(c) matched++;
  });

  localStorage.setItem('dc_plantasks', JSON.stringify(tasks));
  localStorage.setItem('dc_inject_seen', JSON.stringify(Object.keys(seenIds)));
  console.log('Dispatch ← ClickUp: +'+added+' tasks ('+matched+' matched, '+updated+' date-synced) · '+INJECT_VERSION);
})();

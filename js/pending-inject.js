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
  var INJECT_VERSION = '2026-07-05T001';   // bumped daily by the Action

  // Raw ClickUp tasks. Each: {id, name, list, due(ms)}. The Action overwrites this.
  var RAW = /*RAW_START*/[
    {
      "id": "869dw4aqx",
      "name": "Lemeli - Flows (Retainer) -Build",
      "list": "Imported From Trello",
      "due": "1782954000000",
      "prio": 3
    },
    {
      "id": "869da21ty",
      "name": "Retros: post purchase survey ",
      "list": "Drinkretros.com",
      "due": "1782954000000",
      "prio": 3
    },
    {
      "id": "869dynzr9",
      "name": "Nexova | Publish emails",
      "list": "Nexova",
      "due": "1783026000000",
      "prio": 3
    },
    {
      "id": "869dnvbm5",
      "name": "BloomieBlankets - Jul-2026 - Campaigns",
      "list": "BloomieBlankets",
      "due": "1783040400000",
      "prio": 2
    },
    {
      "id": "869dzenjt",
      "name": "Mizuro - Jul-2026 - Campaigns.- Build",
      "list": "Imported From Trello",
      "due": "1783123200000",
      "prio": 4
    },
    {
      "id": "869dwq4jg",
      "name": "Wild Harvest© - Jul-2026 - Campaigns - Build",
      "list": "Wild Harvest©",
      "due": "1783123200000",
      "prio": 0
    },
    {
      "id": "869dww9xg",
      "name": "[PokeSource]: Flows: Build",
      "list": "pokesource",
      "due": "1783126800000",
      "prio": 0
    },
    {
      "id": "869dwqejp",
      "name": "FaithIsMade - Jul-2026 - Campaigns - Build",
      "list": "Imported From Trello",
      "due": "1783126800000",
      "prio": 0
    },
    {
      "id": "869dwqctg",
      "name": "[FaithIsMade] New Post Purchase Flow: Build",
      "list": "FaithIsMade",
      "due": "1783126800000",
      "prio": 0
    },
    {
      "id": "869dzhr9a",
      "name": "Publish emails",
      "list": "Redline Syndicate",
      "due": "1783213200000",
      "prio": 3
    },
    {
      "id": "869dnvbpb",
      "name": "BareRitual - Jul-2026 - Campaigns",
      "list": "BareRitual",
      "due": "1783213200000",
      "prio": 0
    },
    {
      "id": "869dnvbh7",
      "name": "Ovia - Jul-2026 - Campaigns",
      "list": "Ovia",
      "due": "1783213200000",
      "prio": 0
    },
    {
      "id": "869dw2j9e",
      "name": "Orvia Labs - Delivery Flow - Build",
      "list": "Orvia Labs",
      "due": "1783296000000",
      "prio": 0
    },
    {
      "id": "869dzzydj",
      "name": "Revive | Publish emails",
      "list": "Revive",
      "due": "1783371600000",
      "prio": 0
    },
    {
      "id": "869dzbkjq",
      "name": "Sabel Life flow | Built",
      "list": "Sabel Life",
      "due": "1783458000000",
      "prio": 0
    },
    {
      "id": "869dyuanp",
      "name": "[Poke Source]: July: New Email Request: #2: Build",
      "list": "pokesource",
      "due": "1783468800000",
      "prio": 0
    },
    {
      "id": "869dyu5fc",
      "name": "[Poke Source]: July: New Email Request: Build",
      "list": "pokesource",
      "due": "1783468800000",
      "prio": 0
    },
    {
      "id": "869dwqdjw",
      "name": "macrobeauty - Jul-2026 - Campaigns - Build",
      "list": "Imported From Trello",
      "due": "1783468800000",
      "prio": 0
    },
    {
      "id": "869dnvbhd",
      "name": "LifeList Lab - Jul-2026 - Campaigns",
      "list": "LifeList Lab",
      "due": "1783472400000",
      "prio": 2
    },
    {
      "id": "869dwqdpy",
      "name": "Garden's Pulse - Campaigns - July - Build",
      "list": "Imported From Trello",
      "due": "1783641600000",
      "prio": 0
    }
  ]/*RAW_END*/;

  // No once-per-day gate: RAW is re-processed on every load, but any ClickUp id
  // ever injected (persisted in dc_inject_seen) is skipped — so new tasks always
  // appear, nothing duplicates, and a task you deleted is not resurrected.
  var _t = new Date();
  var _p = function(n){ return String(n).padStart(2,'0'); };
  var TODAY_ISO = _t.getFullYear()+'-'+_p(_t.getMonth()+1)+'-'+_p(_t.getDate());
  // bucket everything into the CURRENT work zone so nothing hides in another month
  var ZONE = (typeof activeMonth!=='undefined' && activeMonth) ? activeMonth
           : _t.getFullYear()+'-'+_p(_t.getMonth()+1);

  // One-time cleanup (v3): re-place every auto-injected task into the current work
  // zone. Drop ONLY auto-injected tasks (those with injectId) + the seen-set so all
  // ClickUp tasks re-land in one place. Manual tasks are untouched.
  if(!localStorage.getItem('dc_inject_reset_v4')){
    Object.keys(localStorage).filter(function(k){return k.indexOf('dc_plantasks__')===0;}).forEach(function(k){
      try { var o=JSON.parse(localStorage.getItem(k)||'{}'), changed=false;
        Object.keys(o).forEach(function(id){ if(o[id]&&o[id].injectId){ delete o[id]; changed=true; } });
        if(changed) localStorage.setItem(k, JSON.stringify(o));
      } catch(e){}
    });
    localStorage.removeItem('dc_inject_seen');
    Object.keys(localStorage).forEach(function(k){ if(k.indexOf('dc_inject_v__')===0) localStorage.removeItem(k); });
    localStorage.setItem('dc_inject_reset_v4','1');
  }

  // ms → YYYY-MM-DD in the user's own timezone (so it matches the ClickUp date)
  function isoFromMs(ms){
    if(!ms) return '';
    try { return new Date(Number(ms)).toLocaleDateString('en-CA'); } // en-CA = ISO order
    catch(e){ var d=new Date(Number(ms)); return d.getFullYear()+'-'+_p(d.getMonth()+1)+'-'+_p(d.getDate()); }
  }

  // collect every client across all months (clients are stored per-month)
  var clientMap = {};
  Object.keys(localStorage).filter(function(k){return k.indexOf('dc_clients__')===0;}).forEach(function(k){
    try { JSON.parse(localStorage.getItem(k)||'[]').forEach(function(c){ if(c&&c.id&&!clientMap[c.id]) clientMap[c.id]=c; }); } catch(e){}
  });
  var clientList = Object.values(clientMap);

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

  // ── existing tasks: dedupe by ClickUp id (all months) + by text+client in the zone ──
  var seenIds = {}, zoneTexts = {};
  Object.keys(localStorage).filter(function(k){return k.indexOf('dc_plantasks__')===0;}).forEach(function(k){
    var m = k.slice('dc_plantasks__'.length);
    try { Object.values(JSON.parse(localStorage.getItem(k)||'{}')).forEach(function(t){
      if(!t) return;
      if(t.injectId) seenIds[t.injectId] = 1;
      if(m===ZONE){ zoneTexts[norm(t.text)+'|'+(t.cid||'')] = 1; }
    }); } catch(e){}
  });
  // also skip ClickUp ids injected on earlier days (even if the task was later deleted)
  try { (JSON.parse(localStorage.getItem('dc_inject_seen')||'[]')||[]).forEach(function(id){ seenIds[id]=1; }); } catch(e){}

  // load the current zone's task bucket once
  var zoneBucket; try{ zoneBucket = JSON.parse(localStorage.getItem('dc_plantasks__'+ZONE)||'{}'); }catch(e){ zoneBucket = {}; }

  var added = 0, matched = 0;
  RAW.forEach(function(r){
    if(!r || !r.id || seenIds[r.id]) return;                  // same ClickUp task already injected
    var c = matchClient(r.name, r.list);
    var deadline = isoFromMs(r.due);
    var startIso = deadline || TODAY_ISO;                      // real due day → sorts as overdue/today/next
    var text = c ? stripName(r.name, c.name) : r.name; if(!text) text = r.name;
    var key = norm(text)+'|'+(c?c.id:'');
    if(zoneTexts[key]) return;                                 // identical task already in this zone
    var id = 'inject_' + r.id;
    var hint = (r.list && r.list !== 'Imported From Trello') ? r.list : firstSeg(r.name);
    zoneBucket[id] = {
      id: id, injectId: r.id, text: text,
      cid: c ? c.id : '', clientName: c ? c.name : '',
      startIso: startIso, until: deadline || startIso, deadline: deadline || '',
      prio: +r.prio || 0,                              // ClickUp priority (0-4)
      done: false, note: c ? 'ClickUp' : ('ClickUp: ' + hint)
    };
    zoneTexts[key] = 1; seenIds[r.id] = 1; added++; if(c) matched++;
  });

  localStorage.setItem('dc_plantasks__'+ZONE, JSON.stringify(zoneBucket));
  localStorage.setItem('dc_inject_seen', JSON.stringify(Object.keys(seenIds)));
  console.log('Dispatch ← ClickUp: +'+added+' tasks ('+matched+' matched) → zone '+ZONE+' · '+INJECT_VERSION);
})();

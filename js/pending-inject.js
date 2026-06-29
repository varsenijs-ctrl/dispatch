// ── Dispatch ← ClickUp auto-sync ────────────────────────────────────────────
// This file is regenerated DAILY by .github/workflows/clickup-sync.yml (the
// GitHub Action fetches your ClickUp tasks and rewrites the RAW list + version).
//
// Client matching happens HERE, in the browser, against your real client list
// (localStorage dc_clients__*), so each task gets a proper client (cid + badge)
// exactly as if you'd picked it from the dropdown — not just text in a note.
//   • startIso  = the day the task first appears in Dispatch (today)
//   • deadline  = the ClickUp due date (when it turns red)
//   • until     = same as deadline (carry-over window)
// Already-injected ClickUp tasks (by their id) are never added twice.

(function(){
  var INJECT_VERSION = '2026-06-29T001';   // bumped daily by the Action

  // Raw ClickUp tasks. Each: {id, name, list, due(ms)}. The Action overwrites this.
  var RAW = /*RAW_START*/[
    {
      "id": "869du5dry",
      "name": "[BikerVision] Campaigns | June | Build",
      "list": "BikerVision",
      "due": "1782259200000"
    },
    {
      "id": "869d98zyj",
      "name": "Bloomie Blankets: welcome flow разделить на 4 paths",
      "list": "BloomieBlankets",
      "due": "1782262800000"
    },
    {
      "id": "869dnvbjr",
      "name": "Kerablend - Jul-2026 - Campaigns",
      "list": "Kerablend",
      "due": "1782428400000"
    },
    {
      "id": "869dnvbqk",
      "name": "RISE - Jul-2026 - Campaigns",
      "list": "RISE",
      "due": "1782435600000"
    },
    {
      "id": "869dnvbkm",
      "name": "Lunavo - Jul-2026 - Campaigns",
      "list": "Lunavo",
      "due": "1782435600000"
    },
    {
      "id": "869dw2b73",
      "name": "Spicylab | Publish emails",
      "list": "Spicylab",
      "due": "1782522000000"
    },
    {
      "id": "869dwg3q6",
      "name": "Nevo | Publish emails",
      "list": "Nevo",
      "due": "1782680400000"
    },
    {
      "id": "869dv4g94",
      "name": "[BikerVision] Campaigns | July | Build",
      "list": "BikerVision",
      "due": "1782691200000"
    },
    {
      "id": "869dwq4pr",
      "name": "WildHarvest: Trustpilot email in Post Purchase - Build",
      "list": "Wild Harvest©",
      "due": "1782777600000"
    },
    {
      "id": "869dw4aqx",
      "name": "Lemeli - Flows (Retainer) -Build",
      "list": "Imported From Trello",
      "due": "1782864000000"
    },
    {
      "id": "869dwpwcv",
      "name": "Nexova | Publish emails",
      "list": "Nexova",
      "due": "1782939600000"
    },
    {
      "id": "869dnvbhd",
      "name": "LifeList Lab - Jul-2026 - Campaigns",
      "list": "LifeList Lab",
      "due": "1782954000000"
    },
    {
      "id": "869dwq75b",
      "name": "pokesource - Jul-2026 - Campaigns - Build",
      "list": "Imported From Trello",
      "due": "1783123200000"
    },
    {
      "id": "869dwq4jg",
      "name": "Wild Harvest© - Jul-2026 - Campaigns - Build",
      "list": "Wild Harvest©",
      "due": "1783123200000"
    },
    {
      "id": "869dw49b1",
      "name": "BikerVision - Jul-2026 - Campaigns - Build",
      "list": "Imported From Trello",
      "due": "1783123200000"
    },
    {
      "id": "869dw2j9e",
      "name": "Orvia Labs - Delivery Flow - Build",
      "list": "Orvia Labs",
      "due": "1783296000000"
    },
    {
      "id": "869dwqdjw",
      "name": "macrobeauty - Jul-2026 - Campaigns - Build",
      "list": "Imported From Trello",
      "due": "1783468800000"
    },
    {
      "id": "869dwqdpy",
      "name": "Garden's Pulse - Campaigns - July - Build",
      "list": "Imported From Trello",
      "due": "1783641600000"
    }
  ]/*RAW_END*/;

  // ── once-per-batch guard ──
  var INJECT_KEY = 'dc_inject_v__' + INJECT_VERSION;
  if(localStorage.getItem(INJECT_KEY)) return;

  var _t = new Date();
  var _p = function(n){ return String(n).padStart(2,'0'); };
  var TODAY_ISO = _t.getFullYear()+'-'+_p(_t.getMonth()+1)+'-'+_p(_t.getDate());
  var MONTH = _t.getFullYear()+'-'+_p(_t.getMonth()+1);

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

  // ── existing tasks: dedupe by ClickUp id (all months) + by text+client per month ──
  var seenIds = {}, monthTexts = {};
  Object.keys(localStorage).filter(function(k){return k.indexOf('dc_plantasks__')===0;}).forEach(function(k){
    var m = k.slice('dc_plantasks__'.length);
    try { Object.values(JSON.parse(localStorage.getItem(k)||'{}')).forEach(function(t){
      if(!t) return;
      if(t.injectId) seenIds[t.injectId] = 1;
      if(!monthTexts[m]) monthTexts[m] = {};
      monthTexts[m][norm(t.text)+'|'+(t.cid||'')] = 1;
    }); } catch(e){}
  });

  // place each task into the month of its DEADLINE, so it shows up where you
  // actually work (June tasks in June, July in July) — not all dumped in one month
  function firstDay(m){ return m + '-01'; }
  function lastDay(m){ var p=m.split('-'); var d=new Date(Number(p[0]), Number(p[1]), 0); return m+'-'+_p(d.getDate()); }
  function startFor(m){ var tm=TODAY_ISO.slice(0,7); return tm===m ? TODAY_ISO : (TODAY_ISO<firstDay(m) ? firstDay(m) : lastDay(m)); }
  var buckets = {};
  function bucket(m){ if(!buckets[m]){ try{ buckets[m]=JSON.parse(localStorage.getItem('dc_plantasks__'+m)||'{}'); }catch(e){ buckets[m]={}; } } return buckets[m]; }

  var added = 0, matched = 0, perMonth = {};
  RAW.forEach(function(r){
    if(!r || !r.id || seenIds[r.id]) return;                  // same ClickUp task already injected
    var c = matchClient(r.name, r.list);
    var deadline = isoFromMs(r.due);
    var month = deadline ? deadline.slice(0,7) : TODAY_ISO.slice(0,7);
    var startIso = startFor(month);
    var text = c ? stripName(r.name, c.name) : r.name; if(!text) text = r.name;
    var key = norm(text)+'|'+(c?c.id:'');
    if(monthTexts[month] && monthTexts[month][key]) return;    // identical task already in that month
    var id = 'inject_' + r.id;
    var hint = (r.list && r.list !== 'Imported From Trello') ? r.list : firstSeg(r.name);
    bucket(month)[id] = {
      id: id, injectId: r.id, text: text,
      cid: c ? c.id : '', clientName: c ? c.name : '',
      startIso: startIso, until: deadline || startIso, deadline: deadline || '',
      done: false, note: c ? 'ClickUp' : ('ClickUp: ' + hint)
    };
    if(!monthTexts[month]) monthTexts[month] = {}; monthTexts[month][key] = 1;
    seenIds[r.id] = 1; added++; if(c) matched++; perMonth[month] = (perMonth[month]||0) + 1;
  });

  Object.keys(buckets).forEach(function(m){ localStorage.setItem('dc_plantasks__'+m, JSON.stringify(buckets[m])); });
  localStorage.setItem(INJECT_KEY, '1');
  console.log('Dispatch ← ClickUp: +'+added+' tasks ('+matched+' matched) → '+JSON.stringify(perMonth)+' · '+INJECT_VERSION);
})();

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
  var INJECT_VERSION = '2026-06-24T001';   // bumped daily by the Action

  // Raw ClickUp tasks. Each: {id, name, list, due(ms)}. The Action overwrites this.
  var RAW = /*RAW_START*/[
    { "id": "869dwqdjw", "name": "macrobeauty - Jul-2026 - Campaigns - Build", "list": "Imported From Trello", "due": "1783468800000" },
    { "id": "869dw2j9e", "name": "Orvia Labs - Delivery Flow - Build", "list": "Orvia Labs", "due": "1783296000000" },
    { "id": "869dwq75b", "name": "pokesource - Jul-2026 - Campaigns - Build", "list": "Imported From Trello", "due": "1783123200000" },
    { "id": "869dwq4jg", "name": "Wild Harvest© - Jul-2026 - Campaigns - Build", "list": "Wild Harvest©", "due": "1783123200000" },
    { "id": "869dw49b1", "name": "BikerVision - Jul-2026 - Campaigns - Build", "list": "Imported From Trello", "due": "1783123200000" },
    { "id": "869dwpwcv", "name": "Nexova | Publish emails", "list": "Nexova", "due": "1782939600000" },
    { "id": "869dw4aqx", "name": "Lemeli - Flows (Retainer) -Build", "list": "Imported From Trello", "due": "1782864000000" },
    { "id": "869dwq4pr", "name": "WildHarvest: Trustpilot email in Post Purchase - Build", "list": "Wild Harvest©", "due": "1782777600000" },
    { "id": "869dwg3q6", "name": "Nevo | Publish emails", "list": "Nevo", "due": "1782680400000" },
    { "id": "869dv4g94", "name": "[BikerVision] Campaigns | July | Build", "list": "BikerVision", "due": "1782691200000" },
    { "id": "869dw2b73", "name": "Spicylab | Publish emails", "list": "Spicylab", "due": "1782522000000" },
    { "id": "869dw2b0v", "name": "Healthy Living Co | Publish emails", "list": "Healthy Living Co", "due": "1782522000000" },
    { "id": "869dnvbqk", "name": "RISE - Jul-2026 - Campaigns", "list": "RISE", "due": "1782435600000" },
    { "id": "869dnvbkm", "name": "Lunavo - Jul-2026 - Campaigns", "list": "Lunavo", "due": "1782435600000" },
    { "id": "869dnvbjr", "name": "Kerablend - Jul-2026 - Campaigns", "list": "Kerablend", "due": "1782428400000" },
    { "id": "869du5dry", "name": "[BikerVision] Campaigns | June | Build", "list": "BikerVision", "due": "1782259200000" },
    { "id": "869d98zyj", "name": "Bloomie Blankets: welcome flow разделить на 4 paths", "list": "BloomieBlankets", "due": "1782262800000" }
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
  // find the Dispatch client whose name appears in the task name or its list (longest wins)
  function matchClient(name, list){
    var hay = norm(name) + '|' + norm(list);
    var best = null, bestLen = 0;
    clientList.forEach(function(c){
      var n = norm(c.name);
      if(n.length < 3) return;
      if(hay.indexOf(n) >= 0 && n.length > bestLen){ best = c; bestLen = n.length; }
    });
    return best;
  }
  function cleanText(s){
    return (s||'')
      .replace(/\[\s*\]|\(\s*\)/g,' ')
      .replace(/^[\s\-–—|:]+|[\s\-–—|:]+$/g,'')
      .replace(/\s{2,}/g,' ')
      .trim();
  }
  function stripName(text, name){
    var lt = text.toLowerCase(), ln = name.toLowerCase();
    var i = lt.indexOf(ln);
    if(i < 0) return cleanText(text);
    var out = text.slice(0, i) + text.slice(i + name.length);
    return cleanText(out) || cleanText(text);
  }

  // tasks already injected before (any month) — dedupe by ClickUp id
  var seen = {};
  Object.keys(localStorage).filter(function(k){return k.indexOf('dc_plantasks__')===0;}).forEach(function(k){
    try { Object.values(JSON.parse(localStorage.getItem(k)||'{}')).forEach(function(t){ if(t&&t.injectId) seen[t.injectId]=1; }); } catch(e){}
  });

  var TASKS_KEY = 'dc_plantasks__' + MONTH;
  var tasks = {};
  try { tasks = JSON.parse(localStorage.getItem(TASKS_KEY)||'{}'); } catch(e){}

  var added = 0, matched = 0;
  RAW.forEach(function(r){
    if(!r || !r.id || seen[r.id]) return;            // already injected on an earlier day
    var c = matchClient(r.name, r.list);
    var deadline = isoFromMs(r.due);
    var text = c ? stripName(r.name, c.name) : r.name;
    if(!text) text = r.name;
    var id = 'inject_' + r.id;
    var hint = (r.list && r.list !== 'Imported From Trello') ? r.list : (r.name.split(/[-|:[\]]/)[0]||'').trim();
    tasks[id] = {
      id: id, injectId: r.id,
      text: text,
      cid: c ? c.id : '',
      clientName: c ? c.name : '',
      startIso: TODAY_ISO,
      until: deadline || TODAY_ISO,
      deadline: deadline || '',
      done: false,
      note: c ? 'ClickUp' : ('ClickUp: ' + hint)
    };
    seen[r.id] = 1; added++; if(c) matched++;
  });

  localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  localStorage.setItem(INJECT_KEY, '1');
  console.log('Dispatch ← ClickUp: +' + added + ' tasks (' + matched + ' matched to a client) · batch ' + INJECT_VERSION);
})();

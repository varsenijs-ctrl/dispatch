const MONO="font-family:var(--mono)";

const _TODAY_FIXED = null; // unused, kept for reference

// ── Small shared helpers ─────────────────────────────────────
// Escape user-supplied text before injecting into innerHTML (prevents broken
// layout / HTML injection from client names, notes, task text, flow names…).
function esc(s){
  return String(s==null?'':s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
// Local-timezone YYYY-MM-DD. NOT toISOString(), which converts to UTC and can
// land on the wrong day for users east of UTC (this app targets UTC+3).
function toISO(d){
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
// A task is overdue when it's not done and its due day has already passed.
// «дедлайн» (if set) postpones the red until that date; otherwise the task's
// own day counts. The «до …» field is only a label and never affects this.
function _overdue(t){
  if(!t || t.done) return false;
  var due = t.deadline ? t.deadline : t.startIso;
  return due < isoToday();
}

// ── Data export/import ───────────────────────────────────────
function exportData(){
  var data={};
  for(var i=0;i<localStorage.length;i++){
    var k=localStorage.key(i);
    if(k&&k.startsWith('dc_')) data[k]=localStorage.getItem(k);
  }
  var blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  var a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='dispatch-backup-'+toISO(new Date())+'.json';
  a.click();
  showToast('✓ Данные экспортированы');
}
function importData(){
  var input=document.createElement('input');
  input.type='file';input.accept='.json';
  input.onchange=function(e){
    var file=e.target.files[0];if(!file)return;
    var reader=new FileReader();
    reader.onload=function(ev){
      try{
        var data=JSON.parse(ev.target.result);
        var count=0;
        Object.keys(data).forEach(function(k){
          if(k.startsWith('dc_')){localStorage.setItem(k,data[k]);count++;}
        });
        showToast('✓ Импортировано '+count+' ключей');
        setTimeout(function(){location.reload();},800);
      }catch(ex){showToast('Ошибка импорта');}
    };
    reader.readAsText(file);
  };
  input.click();
}
function getTODAY(){ return new Date(); }
const DAYS_RU = ['вс','пн','вт','ср','чт','пт','сб'];
const MONTHS_RU = ['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'];
const MONTHS_SHORT = MONTHS_RU;

function fmtDate(d){ return d.getDate().toString().padStart(2,'0')+'.'+( d.getMonth()+1).toString().padStart(2,'0')+'.'+d.getFullYear(); }
function todayKey(){ return fmtDate(getTODAY()); }
function monthKey(d){ return d.getFullYear()+'-'+(d.getMonth()+1).toString().padStart(2,'0'); }

function getMonths(){try{return JSON.parse(localStorage.getItem('dc_months')||'[]');}catch{return [];}}
function saveMonths(m){localStorage.setItem('dc_months',JSON.stringify(m));}
function getActiveMonth(){
  const stored=localStorage.getItem('dc_active_month');
  if(stored && stored !== 'null') return stored;
  const months = getMonths();
  const mk = months.length ? months[0] : (new Date().getFullYear()+'-'+String(new Date().getMonth()+1).padStart(2,'0'));
  localStorage.setItem('dc_active_month', mk);
  return mk;
}
function setActiveMonth(mk){localStorage.setItem('dc_active_month',mk);}

let activeMonth = getActiveMonth();

// Data is GLOBAL now (no per-month buckets). The month bar is just a view filter for
// Finance/History; clients, statuses and tasks all live in one place. This killed the
// endless "wrong zone / disappeared / teleport" bugs.
function load(k,def){ try{ return JSON.parse(localStorage.getItem(k))??def; }catch{ return def; } }
function save(k,v){ localStorage.setItem(k,JSON.stringify(v)); }

function gload(k,def){ try{ return JSON.parse(localStorage.getItem(k))??def; }catch{ return def; } }
function gsave(k,v){ localStorage.setItem(k,JSON.stringify(v)); }

// Escape a string for use inside a single-quoted JS string within a double-quoted
// HTML attribute (e.g. onclick="fn('...')") — handles quotes/backslashes/&.
function jsq(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }

// ── task priority (ClickUp-style): 0 none · 1 low · 2 normal · 3 high · 4 urgent ──
const PRIO_META = {
  4:{lbl:'Срочно',  col:'#ff453a'},
  3:{lbl:'Высокий', col:'#ff9f0a'},
  2:{lbl:'Обычный', col:'#5e9eff'},
  1:{lbl:'Низкий',  col:'#8e8e93'}
};
function prioFlag(p){ p=+p||0; var m=PRIO_META[p]; if(!m) return ''; return '<span title="'+m.lbl+'" style="color:'+m.col+';font-size:12px;flex-shrink:0;line-height:1;margin-right:4px">⚑</span>'; }
function prioFromClickUp(p){ var s=p&&(typeof p==='object'?p.priority:p); return {urgent:4,high:3,normal:2,low:1}[String(s||'').toLowerCase()]||0; }

// All clients across every work zone, deduped by name (active zone wins). Used by
// the edit-task client picker so a task can be reassigned to any client, even one
// that lives in another zone. Returns [{id,name,active}].
function _clientsUnion(){
  var out=[], seen={};
  (typeof clients!=='undefined'?clients:[]).forEach(function(c){ if(c&&c.name&&!seen[c.name]){ seen[c.name]=1; out.push({id:c.id,name:c.name,active:c.active!==false}); } });
  Object.keys(localStorage).forEach(function(k){ if(k.indexOf('dc_clients__')!==0) return; try{ (JSON.parse(localStorage.getItem(k))||[]).forEach(function(c){ if(c&&c.name&&!seen[c.name]){ seen[c.name]=1; out.push({id:c.id,name:c.name,active:c.active!==false}); } }); }catch(e){} });
  return out;
}

// Find which work zone (month bucket) a client id lives in — active zone first,
// then every dc_clients__* roster. Returns {mk, client} or null.
function _findClientZone(cid){
  var c=(typeof clients!=='undefined'?clients:[]).find(function(x){return x&&x.id===cid;});
  if(c) return {mk:activeMonth, client:c};
  var hit=null;
  Object.keys(localStorage).forEach(function(k){
    if(hit||k.indexOf('dc_clients__')!==0) return;
    try{ (JSON.parse(localStorage.getItem(k))||[]).forEach(function(x){ if(!hit&&x&&x.id===cid) hit={mk:k.slice('dc_clients__'.length), client:x}; }); }catch(e){}
  });
  return hit;
}

// ── pay rates ── an email pays EMAIL_RATE; an SMS day adds SMS_EXTRA on top.
const EMAIL_RATE = 0.40;                        // email = 40¢ (was 50¢)
const SMS_EXTRA  = 0.10;                       // SMS = 10¢ (was 50¢)
const SMS_DAY_RATE = EMAIL_RATE + SMS_EXTRA;   // 0.50

// ── action log ── records WHEN each status mark was made, so History can show
// "on <day> I set <client> for <target date> = <status>". Global, going-forward.
// Entry: {t: ms, w: action-day ISO, c: client name, d: target date ISO, s: status}.
function _logAct(client, targetIso, status){
  try{
    if(!client || !targetIso) return;
    var log = gload('dc_actlog', []);
    log.push({ t: Date.now(), w: isoToday(), c: client, d: targetIso, s: status||'' });
    if(log.length > 4000) log = log.slice(log.length-4000);
    gsave('dc_actlog', log);
  }catch(e){}
}
// One-time seed from existing marks. Real action-day is unknown for old data, so
// we approximate it with the target date (marks are usually made on/near their day).
function _seedActLog(){
  try{
    if(gload('dc_actlog_seeded_v1', false)) return;
    var log = gload('dc_actlog', []);
    var seen = {}; log.forEach(function(e){ seen[e.c+'|'+e.d]=1; });
    Object.keys(localStorage).forEach(function(k){
      if(k.indexOf('dc_history__')!==0) return;
      var hist; try{ hist = JSON.parse(localStorage.getItem(k)||'{}'); }catch(e){ return; }
      Object.keys(hist).forEach(function(client){
        var days = hist[client]||{};
        Object.keys(days).forEach(function(iso){
          var s = days[iso];
          if(s!=='yes' && s!=='draft' && s!=='no') return;
          if(seen[client+'|'+iso]) return;
          seen[client+'|'+iso]=1;
          log.push({ t:0, w:iso, c:client, d:iso, s:s, seed:true });
        });
      });
    });
    gsave('dc_actlog', log);
    gsave('dc_actlog_seeded_v1', true);
  }catch(e){}
}

// ── month-bucket helpers ── read/write a specific month's bucket (not just active)
function _loadMonth(base, mk){ try{ var v=localStorage.getItem(base+'__'+mk); return v==null?{}:(JSON.parse(v)||{}); }catch(e){ return {}; } }
function _saveMonth(base, mk, obj){ localStorage.setItem(base+'__'+mk, JSON.stringify(obj)); }
function _ensureMonthListed(mk){ try{ if(typeof getMonths==='function'&&typeof saveMonths==='function'){ var ms=getMonths(); if(ms.indexOf(mk)<0){ ms.push(mk); ms.sort(); saveMonths(ms); } } }catch(e){} }

// One-time repair: history/sms/pay entries were written into the ACTIVE month's
// bucket even when the date belonged to another month (calendar shows ±2 months;
// sheet import writes every date to the active bucket). That made other months'
// emails appear in the wrong month ("duplicates"). Move every entry into the bucket
// of its own date's month. History is keyed by clientName→iso; sms/pay by cid→iso.
function _relocateByMonth(){
  if(localStorage.getItem('dc_globalized_v1')) return;   // obsolete once data is global
  if(gload('dc_relocate_v1', false)) return;
  var touched={};
  ['dc_history','dc_sms_days','dc_pay_disabled'].forEach(function(base){
    var buckets={};
    Object.keys(localStorage).forEach(function(k){ if(k.indexOf(base+'__')===0){ var mk=k.slice(base.length+2); try{ buckets[mk]=JSON.parse(localStorage.getItem(k))||{}; }catch(e){ buckets[mk]={}; } } });
    var out={}; Object.keys(buckets).forEach(function(mk){ out[mk]={}; });   // clear existing buckets, refill correctly
    Object.keys(buckets).forEach(function(mk){
      var obj=buckets[mk];
      Object.keys(obj).forEach(function(key){                 // key = clientName (history) or cid (sms/pay)
        var days=obj[key]; if(!days||typeof days!=='object') return;
        Object.keys(days).forEach(function(iso){
          var tm=(typeof iso==='string' && /^\d{4}-\d{2}/.test(iso)) ? iso.slice(0,7) : mk;
          if(!out[tm]) out[tm]={};
          if(!out[tm][key]) out[tm][key]={};
          out[tm][key][iso]=days[iso];
          touched[tm]=1;
        });
      });
    });
    Object.keys(out).forEach(function(mk){ localStorage.setItem(base+'__'+mk, JSON.stringify(out[mk])); });
  });
  Object.keys(touched).forEach(_ensureMonthListed);
  gsave('dc_relocate_v1', true);
}

// One-time: consolidate a specific set of clients' entire history (+ SMS / pay-off)
// into the июнь 2026 work space, pulling their marks out of every other zone.
// Requested by the user; irreversible. Flag-gated so it runs once.
function _consolidateClientsToJune(){
  var FLAG='dc_consolidate_june_v1';
  try{
    if(localStorage.getItem('dc_globalized_v1')) return;   // obsolete once data is global
    if(gload(FLAG,false)) return;
    var TM='2026-06';
    var WANT=['Rise','kerablend','lunavo','pokesource','wild harvest','nevo','healthy living','spicyLab','clearkind'];
    var norm=function(s){return String(s||'').toLowerCase().replace(/[^a-z0-9а-я]/gi,'');};
    var wantNorm={}; WANT.forEach(function(w){ wantNorm[norm(w)]=w; });   // normalized → display name

    var juneRoster=_loadMonth('dc_clients',TM); if(!Array.isArray(juneRoster)) juneRoster=[];
    var juneHist=_loadMonth('dc_history',TM), juneSms=_loadMonth('dc_sms_days',TM), junePay=_loadMonth('dc_pay_disabled',TM);
    var _seq=0;
    function juneClientFor(nk, displayName){
      var found=juneRoster.find(function(c){return c&&norm(c.name)===nk;});
      if(found) return found;
      var nc={id:'c_j'+Date.now()+'_'+(_seq++), name:displayName, active:true, smsEnabled:false, schedule:'', deadline:null};
      juneRoster.push(nc); return nc;
    }

    // pull each wanted client's history/sms/pay out of every OTHER month bucket
    Object.keys(localStorage).forEach(function(k){
      if(k.indexOf('dc_history__')!==0) return;
      var mk=k.slice('dc_history__'.length); if(mk===TM) return;
      var hist; try{ hist=JSON.parse(localStorage.getItem(k))||{}; }catch(e){ return; }
      var sms=_loadMonth('dc_sms_days',mk), pay=_loadMonth('dc_pay_disabled',mk);
      var roster=_loadMonth('dc_clients',mk); var nameToCid={}; (Array.isArray(roster)?roster:[]).forEach(function(c){if(c&&c.name)nameToCid[norm(c.name)]=c.id;});
      var histChanged=false, smsChanged=false, payChanged=false;
      Object.keys(hist).forEach(function(name){
        var nk=norm(name); if(!wantNorm[nk]) return;
        var jc=juneClientFor(nk, wantNorm[nk]);
        if(!juneHist[jc.name]) juneHist[jc.name]={};
        Object.assign(juneHist[jc.name], hist[name]); delete hist[name]; histChanged=true;
        var oldCid=nameToCid[nk];
        if(oldCid){
          if(sms[oldCid]){ if(!juneSms[jc.id])juneSms[jc.id]={}; Object.assign(juneSms[jc.id],sms[oldCid]); delete sms[oldCid]; smsChanged=true; }
          if(pay[oldCid]){ if(!junePay[jc.id])junePay[jc.id]={}; Object.assign(junePay[jc.id],pay[oldCid]); delete pay[oldCid]; payChanged=true; }
        }
      });
      if(histChanged) localStorage.setItem(k, JSON.stringify(hist));
      if(smsChanged) _saveMonth('dc_sms_days',mk,sms);
      if(payChanged) _saveMonth('dc_pay_disabled',mk,pay);
    });

    // make sure every wanted client exists (active) in June, even with no history
    Object.keys(wantNorm).forEach(function(nk){ var c=juneClientFor(nk, wantNorm[nk]); c.active=true; });

    _saveMonth('dc_clients',TM,juneRoster);
    _saveMonth('dc_history',TM,juneHist);
    _saveMonth('dc_sms_days',TM,juneSms);
    _saveMonth('dc_pay_disabled',TM,junePay);
    _ensureMonthListed(TM);
    gsave(FLAG,true);
  }catch(e){}
}

// ── one-time migration: legacy un-namespaced keys → current-month namespace ──
(function(){
  const OLD_KEYS = ['dc_clients','dc_log','dc_history','dc_plans','dc_plantasks','dc_manual_done','dc_sms_days','dc_pay_disabled','dc_flows'];
  const TARGET = '2026-06';
  let migrated = false;
  OLD_KEYS.forEach(k=>{
    const old = localStorage.getItem(k);
    const newKey = k+'__'+TARGET;
    if(old !== null && localStorage.getItem(newKey) === null){
      localStorage.setItem(newKey, old);
      migrated = true;
    }
  });
  if(migrated) console.log('Migrated old data to 2026-06 namespace');
})();

// ── one-time: collapse ALL per-month buckets into single GLOBAL keys ──
// Runs before state.js reads anything, so load('dc_*') returns the merged data.
// Non-destructive: the old <key>__<month> buckets are left in place.
(function _globalize(){
  try{
    if(localStorage.getItem('dc_globalized_v1')) return;
    function buckets(base){ var out=[]; Object.keys(localStorage).forEach(function(k){ if(k.indexOf(base+'__')===0){ try{ out.push(JSON.parse(localStorage.getItem(k))); }catch(e){} } }); return out; }
    // clients — array, dedup by name (existing global first, then buckets)
    (function(){
      var seen={}, arr=[];
      function add(c){ if(c&&c.name){ var key=String(c.name).toLowerCase(); if(!seen[key]){ seen[key]=1; arr.push(c); } } }
      try{ (JSON.parse(localStorage.getItem('dc_clients'))||[]).forEach(add); }catch(e){}
      buckets('dc_clients').forEach(function(b){ (Array.isArray(b)?b:[]).forEach(add); });
      if(arr.length) localStorage.setItem('dc_clients', JSON.stringify(arr));
    })();
    // nested  key -> { iso -> value } : history, sms days, pay-disabled
    ['dc_history','dc_sms_days','dc_pay_disabled'].forEach(function(base){
      var g={}; try{ g=JSON.parse(localStorage.getItem(base))||{}; }catch(e){ g={}; }
      buckets(base).forEach(function(b){ if(!b||typeof b!=='object') return;
        Object.keys(b).forEach(function(key){ if(!g[key])g[key]={}; var days=b[key]||{}; Object.keys(days).forEach(function(iso){ if(g[key][iso]===undefined) g[key][iso]=days[iso]; }); });
      });
      localStorage.setItem(base, JSON.stringify(g));
    });
    // flat  id -> value : tasks, manual-done, log, flows
    ['dc_plantasks','dc_manual_done','dc_log','dc_flows'].forEach(function(base){
      var g={}; try{ g=JSON.parse(localStorage.getItem(base))||{}; }catch(e){ g={}; }
      buckets(base).forEach(function(b){ if(!b||typeof b!=='object') return; Object.keys(b).forEach(function(id){ if(g[id]===undefined) g[id]=b[id]; }); });
      localStorage.setItem(base, JSON.stringify(g));
    });
    // invoices — array, concat
    (function(){
      var arr=[]; try{ arr=JSON.parse(localStorage.getItem('dc_invoices'))||[]; if(!Array.isArray(arr))arr=[]; }catch(e){ arr=[]; }
      buckets('dc_invoices').forEach(function(b){ if(Array.isArray(b)) arr=arr.concat(b); });
      localStorage.setItem('dc_invoices', JSON.stringify(arr));
    })();
    localStorage.setItem('dc_globalized_v1','1');
    console.log('Dispatch: data globalized — zones merged into one store.');
  }catch(e){ console.error('globalize failed', e); }
})();

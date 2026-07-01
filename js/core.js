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

function load(k,def){
  try{ return JSON.parse(localStorage.getItem(k+'__'+activeMonth))??def; }catch{ return def; }
}
function save(k,v){ localStorage.setItem(k+'__'+activeMonth,JSON.stringify(v)); }

function gload(k,def){ try{ return JSON.parse(localStorage.getItem(k))??def; }catch{ return def; } }
function gsave(k,v){ localStorage.setItem(k,JSON.stringify(v)); }

// Escape a string for use inside a single-quoted JS string within a double-quoted
// HTML attribute (e.g. onclick="fn('...')") — handles quotes/backslashes/&.
function jsq(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }

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
const EMAIL_RATE = 0.50;
const SMS_EXTRA  = 0.10;                       // SMS = 10¢ (was 50¢)
const SMS_DAY_RATE = EMAIL_RATE + SMS_EXTRA;   // 0.60

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

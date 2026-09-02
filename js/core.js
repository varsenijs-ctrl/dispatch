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
// Compact labels used by the redesigned views ("5 авг", "среда")
const _MSHORT = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
const _DFULL  = ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'];
const _MGEN   = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const _MPREP  = ['январе','феврале','марте','апреле','мае','июне','июле','августе','сентябре','октябре','ноябре','декабре'];
// Русское склонение по числу: _plural(1,'клиент','клиента','клиентов') → "клиент"
function _plural(n, one, few, many){
  const a=Math.abs(n)%100, b=a%10;
  if(a>10&&a<20) return many;
  if(b>1&&b<5)   return few;
  if(b===1)      return one;
  return many;
}

function fmtDate(d){ return d.getDate().toString().padStart(2,'0')+'.'+( d.getMonth()+1).toString().padStart(2,'0')+'.'+d.getFullYear(); }
function todayKey(){ return fmtDate(getTODAY()); }
function monthKey(d){ return d.getFullYear()+'-'+(d.getMonth()+1).toString().padStart(2,'0'); }

// Months for the bottom bar = every month that has data (history/tasks) + the
// current month + any manually-added. Derived so a task/mark for another month
// (e.g. doing something in July for August) makes that month selectable.
// Зоны в баре = созданные вручную (dc_months) + текущий месяц. Месяцы, которые
// всплывают только из данных (отметка на будущее, дедлайн задачи из ClickUp), зоной
// НЕ становятся, если их уже видно из соседней: зона показывает свой месяц и
// следующий, поэтому «выставил в августе пару имейлов на сентябрь» остаётся
// августовской работой — сентябрь больше не заводится и не заполняется сам.
// Месяц, которого не видно ниоткуда, зону всё-таки получает — данные не теряются.
function getMonths(){
  var explicit={}, derived={};
  try{ (JSON.parse(localStorage.getItem('dc_months')||'[]')||[]).forEach(function(m){ explicit[m]=1; }); }catch(e){}
  var now=new Date(); explicit[now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')]=1;
  try{ var h=JSON.parse(localStorage.getItem('dc_history')||'{}'); Object.keys(h).forEach(function(n){ var d=h[n]||{}; Object.keys(d).forEach(function(iso){ if(iso&&iso.length>=7) derived[iso.slice(0,7)]=1; }); }); }catch(e){}
  try{ var t=JSON.parse(localStorage.getItem('dc_plantasks')||'{}'); Object.keys(t).forEach(function(id){ var x=t[id]; if(!x)return; if(x.startIso) derived[x.startIso.slice(0,7)]=1; if(x.deadline) derived[x.deadline.slice(0,7)]=1; }); }catch(e){}
  var ok=function(m){ return /^\d{4}-\d{2}$/.test(m); };
  var out={};
  Object.keys(explicit).forEach(function(m){ if(ok(m)) out[m]=1; });
  Object.keys(derived).filter(ok).sort().forEach(function(m){
    if(out[m]) return;
    if(out[_prevMonthKey(m)]) return;      // виден как «следующий месяц» соседней зоны
    out[m]=1;
  });
  return Object.keys(out).sort();
}
function _pausedClientNames(){ var s={}; (typeof clients!=='undefined'?clients:[]).forEach(function(c){ if(c&&c.paused) s[String(c.name).toLowerCase()]=1; }); return s; }
function _isTaskClientPaused(t){ if(!t) return false; var p=_pausedClientNames(); if(t.clientName && p[String(t.clientName).toLowerCase()]) return true; if(t.cid){ var c=(typeof clients!=='undefined'?clients:[]).find(function(x){return x&&x.id===t.cid;}); if(c&&c.paused) return true; } return false; }
function saveMonths(m){localStorage.setItem('dc_months',JSON.stringify(m));}
function getActiveMonth(){
  const stored=localStorage.getItem('dc_active_month');
  if(stored && stored !== 'null') return stored;
  const mk = new Date().getFullYear()+'-'+String(new Date().getMonth()+1).padStart(2,'0');  // default: current month zone
  localStorage.setItem('dc_active_month', mk);
  return mk;
}
// A date belongs to the active zone iff its month matches the zone label. Zones are
// independent — every view shows ONLY the active zone's slice (no cross-zone mixing).
function _inZone(iso){ return typeof iso==='string' && iso.slice(0,7)===activeMonth; }
function setActiveMonth(mk){localStorage.setItem('dc_active_month',mk);}

let activeMonth = getActiveMonth();

// ── Per-zone client rosters ────────────────────────────────────────────────
// Each work-zone (month) has its OWN, MANUALLY built client list. Nothing shows
// automatically: a client appears in a zone only if the user explicitly added it
// there. Stored as ONE global map { "2026-07":[cid,…], "2026-06":[cid,…] }.
// The dc_clients pool (client records: name / deadline / SMS / …) stays shared and
// is NEVER moved or deleted — the roster only decides which of them a zone shows.
function _rosterMap(){ return load('dc_zone_roster', {}); }
function _zoneRoster(mk){ mk=mk||activeMonth; var m=_rosterMap(); return Array.isArray(m[mk])?m[mk]:[]; }
function _inRoster(cid, mk){ return _zoneRoster(mk).indexOf(cid)>=0; }
function _addToRoster(cid, mk){ mk=mk||activeMonth; var m=_rosterMap(); if(!Array.isArray(m[mk])) m[mk]=[]; if(m[mk].indexOf(cid)<0){ m[mk].push(cid); save('dc_zone_roster', m); } }
function _removeFromRoster(cid, mk){ mk=mk||activeMonth; var m=_rosterMap(); if(Array.isArray(m[mk])){ m[mk]=m[mk].filter(function(x){return x!==cid;}); save('dc_zone_roster', m); } }
// Client objects in THIS zone's roster, in the order they were added. Skips ids
// that no longer exist in the pool.
function _zoneClients(mk){ var ids=_zoneRoster(mk); return ids.map(function(id){ return clients.find(function(c){return c.id===id;}); }).filter(Boolean); }
// Active, non-paused zone clients — the common case for money/marking views.
function _zac(){ return _zoneClients().filter(function(c){return c.active&&!c.paused;}); }
// Lower-cased names of the active zone's clients — for filtering name-keyed data
// (history / action log) to this zone only.
function _zoneClientNames(){ var set={}; _zac().forEach(function(c){ if(c&&c.name) set[String(c.name).toLowerCase()]=1; }); return set; }

// Does a dated mark for `cid` count toward the ACTIVE zone's earnings?
// The zone is defined by its client roster, not strictly by the calendar month, so a
// zone shows ALL its clients' earnings — including work you did "in July for August".
// A mark counts here if its month IS the active month, OR no OTHER zone (matching that
// month) rosters this client. So a recurring client's June work stays in the June zone
// (that zone rosters them for June) and never bleeds into July.
// This is the rule build "07.22 · сайдбар-как-финансы" used (the one that read 446) —
// Finance, Обзор, Флоу and the sidebar ALL share it, so their numbers agree.
// Следующий месяц от ключа зоны: "2026-07" → "2026-08" (переход года учтён).
function _nextMonthKey(mk){
  var p=(mk||'').split('-').map(Number);
  if(!p[0]||!p[1]) return mk||'';
  var d=new Date(p[0], p[1], 1);                       // p[1] = месяц уже +1 (0-based)
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
}
// Месяцы, которые считает активная зона: свой + следующий (работа «в июле за август»
// попадает в июльскую зону, а прошлые месяцы больше не протекают).
function _prevMonthKey(mk){
  var p=(mk||'').split('-').map(Number);
  if(!p[0]||!p[1]) return mk||'';
  var d=new Date(p[0], p[1]-2, 1);                      // p[1]-1 = 0-based, ещё -1 = предыдущий
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
}
function _zoneMonths(mk){ mk=mk||activeMonth; return [mk, _nextMonthKey(mk)]; }
// Сдвиг ключа месяца на N месяцев (для листания календарей вперёд/назад)
function _shiftMonthKey(mk, delta){
  var p=(mk||'').split('-').map(Number);
  if(!p[0]||!p[1]) return mk||'';
  var d=new Date(p[0], p[1]-1+(+delta||0), 1);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
}
// ── Чья это отметка: зона, в которой её ПОСТАВИЛИ ──────────────────────────
// Окно зоны — свой месяц и следующий, поэтому 22 сентября видно и из августовской
// зоны, и из сентябрьской. Из-за одного этого окна отметка, поставленная в августе
// на сентябрь, приносила деньги ДВА раза: и в августе, и в сентябре. Зоны
// независимы — один имейл не может стоить $1.00. Поэтому у каждой отметки есть
// метка зоны, в которой её сделали, и деньги за неё считает ТОЛЬКО эта зона.
// Хранилище одно общее: { "<cid>|<iso>": "<ключ зоны>" }.
// Строку из localStorage парсим только когда она изменилась: функция зовётся на
// каждую клетку сетки (клиенты × дни), тысяча JSON.parse на рендер — это заметно.
var _mzRaw=null, _mzMap={};
function _markZoneMap(){
  var raw=localStorage.getItem('dc_mark_zone')||'';
  if(raw===_mzRaw) return _mzMap;
  try{ _mzMap=JSON.parse(raw)||{}; }catch(e){ _mzMap={}; }
  _mzRaw=raw;
  return _mzMap;
}
// Список зон с тем же кэшем — getMonths() перебирает всю историю.
var _zlRaw=null, _zlList=null;
function _zoneList(){
  var raw=(localStorage.getItem('dc_months')||'')+'|'+(localStorage.getItem('dc_history')||'').length;
  if(raw===_zlRaw && _zlList) return _zlList;
  _zlList=(typeof getMonths==='function'?getMonths():[])||[];
  _zlRaw=raw;
  return _zlList;
}
// Зона, которая показывает этот месяц: сам месяц, если такая зона есть, иначе
// предыдущая (для неё этот месяц — «следующий»). Так отметка без метки, оставшаяся
// от старых данных, ни из какой зоны не пропадает.
function _zoneOwningMonth(mk){
  var ms=_zoneList();
  if(ms.indexOf(mk)>=0) return mk;
  var prev=_prevMonthKey(mk);
  return ms.indexOf(prev)>=0 ? prev : mk;
}
function _markZone(cid, iso){
  var m=(iso||'').slice(0,7);
  if(!m) return '';
  var st=cid?_markZoneMap()[cid+'|'+iso]:'';
  return st || _zoneOwningMonth(m);
}
// Считает ли активная зона деньги за эту отметку.
function _markInActiveZone(cid, iso){ return _markZone(cid, iso)===activeMonth; }
// Дата попадает в ОКНО зоны (свой месяц + следующий). Этим правилом живут
// календари и задачи: отмечать вперёд можно как раньше, а деньги делит правило выше.
function _dateInActiveZone(iso){
  var m=(iso||'').slice(0,7);
  if(!m) return false;
  return m===activeMonth || m===_nextMonthKey(activeMonth);
}
// Название зоны для подписей: "2026-08" → "август 2026".
function _mkLabel(mk){
  var p=(mk||'').split('-');
  if(p.length<2) return mk||'';
  return (MONTHS_RU[parseInt(p[1],10)-1]||'')+' '+p[0];
}
// Метку ставим в момент отметки: поставил сейчас — деньги активной зоны. У уже
// существующей отметки зону НЕ переписываем: смена статуса (да → черновик → нет) —
// это правка той же работы, а не перенос денег в другой месяц. Снял отметку — метка
// уходит вместе с ней, и следующая отметка на этот день будет уже «своя».
function _stampMarkZone(cid, iso, status){
  try{
    if(!cid || !iso) return;
    var map=_markZoneMap(), k=cid+'|'+iso;
    if(status){ if(map[k]) return; map[k]=activeMonth; }
    else { if(!(k in map)) return; delete map[k]; }
    save('dc_mark_zone', map);
  }catch(e){}
}
// То же по имени клиента — журнал действий знает имя, а не id.
function _stampMarkZoneByName(name, iso, status){
  try{
    var key=_normName(name), cid='';
    (typeof clients!=='undefined'?clients:[]).forEach(function(c){ if(!cid&&c&&_normName(c.name)===key) cid=c.id; });
    if(cid) _stampMarkZone(cid, iso, status);
  }catch(e){}
}
// Есть ли на этом дне отметка ДРУГОЙ зоны.
function _alienMark(cid, iso){
  if(!cid || !iso) return false;
  var c=(typeof clients!=='undefined'?clients:[]).find(function(x){ return x&&x.id===cid; });
  if(!c) return false;
  var v=((typeof historyData!=='undefined'&&historyData[c.name])||{})[iso];
  return !!v && !_markInActiveZone(cid, iso);
}
// Клик по отметке другой зоны. Стереть её отсюда НЕЛЬЗЯ — это её заработок, и один
// случайный тап не должен уносить деньги августа. Поэтому первый клик просто
// забирает день в активную зону: статус остаётся как был, меняется только хозяин —
// «поставил свою отметку поверх». Дальше день ведёт себя как обычная своя отметка
// (можно менять статус, SMS, количество и снимать). Отмена возвращает и зону.
// true = день забрали, вызывающему делать больше нечего.
function _claimAlienDay(cid, iso){
  try{
    if(!_alienMark(cid, iso)) return false;
    var was=_markZone(cid, iso);
    var c=(typeof clients!=='undefined'?clients:[]).find(function(x){ return x&&x.id===cid; });
    var map=_markZoneMap(); map[cid+'|'+iso]=activeMonth; save('dc_mark_zone', map);
    try{
      _undoStack.push({cid:cid, name:c?c.name:'', iso:iso, prev:((historyData[c.name]||{})[iso]||''), prevZone:was});
      if(_undoStack.length>MAX_UNDO) _undoStack.shift();
    }catch(e){}
    try{ _sfx.play('click'); }catch(e){}
    try{ showToast(fmtDate(new Date(iso+'T00:00:00'))+' теперь в зоне «'+_mkLabel(activeMonth)+'» — деньги за этот день считаются здесь'); }catch(e){}
    try{ updateSidebar(); }catch(e){}
    try{ render(); }catch(e){}
    return true;
  }catch(e){ return false; }
}
// Принудительно вернуть отметке её зону (отмена «забрал день»).
function _forceMarkZone(cid, iso, zone){
  try{
    var map=_markZoneMap(), k=cid+'|'+iso;
    if(zone) map[k]=zone; else delete map[k];
    save('dc_mark_zone', map);
  }catch(e){}
}
// Флоу принадлежит зоне, в которой его выставили: у новых задач есть метка doneZone,
// у старых остаётся прежнее правило окна.
function _flowDoneInZone(t){
  if(!t || !t.done) return false;
  return t.doneZone ? t.doneZone===activeMonth : _dateInActiveZone(t.startIso);
}
function _flowDoneZoneOf(t){
  if(!t || !t.done) return '';
  return t.doneZone || (t.startIso||'').slice(0,7);
}
// Разовая разметка старых отметок. Журнал действий помнит день, когда отметка была
// поставлена (w), а с этой версии — и саму зону (z): по ним и восстанавливаем, кому
// принадлежат деньги. Чего в журнале нет — отдаём зоне, показывающей этот месяц.
function _backfillMarkZones(){
  try{
    if(localStorage.getItem('dc_markzone_v1')) return {n:0};
    var hist=load('dc_history',{})||{};
    var map=load('dc_mark_zone',{})||{};
    var months=(typeof getMonths==='function'?getMonths():[])||[];
    var cidOf={};
    (load('dc_clients',[])||[]).forEach(function(c){ if(c&&c.name) cidOf[_normName(c.name)]=c.id; });
    var last={};
    (gload('dc_actlog',[])||[]).forEach(function(e){
      if(!e || !e.c || !e.d || !e.s) return;
      var k=_normName(e.c)+'|'+e.d, p=last[k];
      if(!p || (e.t||0)>=(p.t||0)) last[k]=e;
    });
    function zoneOnDay(iso){                        // какая зона была активна в этот день
      var m=(iso||'').slice(0,7);
      if(!m) return activeMonth;
      if(months.indexOf(m)>=0) return m;
      var best=''; months.forEach(function(z){ if(z<m && z>best) best=z; });
      return best||m;
    }
    var n=0;
    Object.keys(hist).forEach(function(name){
      var cid=cidOf[_normName(name)]; if(!cid) return;
      var days=hist[name]||{};
      Object.keys(days).forEach(function(iso){
        if(!days[iso]) return;
        var k=cid+'|'+iso; if(map[k]) return;
        var e=last[_normName(name)+'|'+iso];
        map[k]=(e&&e.z) ? e.z : zoneOnDay((e&&e.w)||iso);
        n++;
      });
    });
    if(n){ save('dc_mark_zone', map); console.log('Dispatch: отметки разнесены по зонам — '+n); }
    // Флоу — та же история: выставленный в августе флоу не должен платить ещё и в
    // сентябре. У задачи есть день, когда её отметили выполненной (doneDate) — по
    // нему и определяем зону; если дня нет, берём день самой задачи.
    var tasks=load('dc_plantasks',{})||{}, tn=0;
    Object.keys(tasks).forEach(function(k){
      var t=tasks[k];
      if(!t || !t.flowId || !t.done || t.doneZone) return;
      t.doneZone=zoneOnDay(t.doneDate||t.startIso); tn++;
    });
    if(tn){ save('dc_plantasks', tasks); console.log('Dispatch: флоу разнесены по зонам — '+tn); }
    localStorage.setItem('dc_markzone_v1','1');
    return {n:n, flows:tn};
  }catch(e){ return {n:0}; }
}
// Ни один месяц с отметками не должен пропасть из вида. Но зона и так показывает
// свой месяц И следующий, поэтому отметки, выставленные «наперёд» (в августе на
// сентябрь), уже видны в августовской зоне — новую зону для них создавать НЕ надо,
// иначе сентябрь появляется в баре сам собой и сам заполняется клиентами.
// Зона создаётся только для месяца, которого не видно ни из одной существующей.
// Идемпотентно: гоняем на каждой загрузке, лишнего не добавляем.
function _ensureZonesForData(){
  try{
    var hist=load('dc_history',{});
    var months=getMonths()||[];
    var map=_rosterMap();
    var byZone={}, addedZones=[], addedRoster=0;
    (load('dc_clients',[])||[]).forEach(function(c){
      var days=hist[c.name]||{};
      Object.keys(days).forEach(function(iso){
        if(!days[iso]) return;
        var zone=_markZone(c.id, iso);              // зона, в которой отметку поставили
        if(!/^\d{4}-\d{2}$/.test(zone)) return;
        (byZone[zone]=byZone[zone]||{})[c.id]=1;
      });
    });
    // Зона нужна только для отметок, которые ей и принадлежат. Сентябрьские числа,
    // отмеченные в августе, — августовские деньги, и сентябрьскую зону они не заводят.
    Object.keys(byZone).forEach(function(zone){
      if(months.indexOf(zone)<0){ months.push(zone); addedZones.push(zone); }
      if(!Array.isArray(map[zone])) map[zone]=[];
      Object.keys(byZone[zone]).forEach(function(cid){
        if(map[zone].indexOf(cid)<0){ map[zone].push(cid); addedRoster++; }
      });
    });
    if(addedZones.length){ months.sort(); saveMonths(months); }
    if(addedZones.length||addedRoster) save('dc_zone_roster', map);
    return {zones:addedZones, roster:addedRoster};
  }catch(e){ return {zones:[], roster:0}; }
}

// Разовая уборка зон, которые старое правило создало само: будущий месяц, который
// и так виден из предыдущей зоны (сентябрь при работающем августе). Данные не
// теряются — отметки лежат в одном общем хранилище, а клиентов переносим в
// ростер той зоны, что этот месяц показывает. Дальше зоны создаются только вручную.
function _cleanupAutoZones(){
  try{
    if(localStorage.getItem('dc_autozone_cleanup_v1')) return {removed:[]};
    var months=getMonths()||[];
    var now=new Date();
    var thisMonth=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
    var map=_rosterMap(), removed=[];
    months.slice().forEach(function(mk){
      if(mk<=thisMonth) return;                      // прошлые и текущий не трогаем
      var prev=_prevMonthKey(mk);
      if(months.indexOf(prev)<0) return;             // никто его не показывает — оставляем
      (map[mk]||[]).forEach(function(cid){            // клиентов — в показывающую зону
        if(!Array.isArray(map[prev])) map[prev]=[];
        if(map[prev].indexOf(cid)<0) map[prev].push(cid);
      });
      delete map[mk];
      months=months.filter(function(m){ return m!==mk; });
      removed.push(mk);
    });
    if(removed.length){
      saveMonths(months);
      save('dc_zone_roster', map);
      if(removed.indexOf(activeMonth)>=0){           // стояли в удалённой зоне — вернём в предыдущую
        var back=_prevMonthKey(activeMonth);
        if(months.indexOf(back)<0) back=months[months.length-1];
        activeMonth=back; setActiveMonth(back);
      }
      console.log('Dispatch: убраны зоны, созданные автоматически — '+removed.join(', '));
    }
    localStorage.setItem('dc_autozone_cleanup_v1','1');
    return {removed:removed};
  }catch(e){ return {removed:[]}; }
}
// Normalized client-name key (case/space/punctuation-insensitive) so "Macro Beauty"
// and "macrobeauty" collapse to the same key — used to de-duplicate client records.
function _normName(s){ return (s||'').toString().toLowerCase().replace(/[^a-z0-9а-яё]/gi,''); }

// One-time: collapse duplicate client records that differ only by case / spacing /
// punctuation (e.g. "Macro Beauty" ↔ "macrobeauty"). Keeps the record that HAS data
// (history / flows / roster membership); removes ONLY the empty phantom duplicates.
// If two same-named records BOTH have data, it leaves them untouched and logs them
// (so nothing with your data is ever deleted). Guarded by a flag — bump to re-run.
function _dedupeClients(){
  if(localStorage.getItem('dc_dedupe_clients_v1')) return {removed:0,conflicts:[]};
  var list = load('dc_clients', []);
  if(!Array.isArray(list) || list.length<2){ localStorage.setItem('dc_dedupe_clients_v1','1'); return {removed:0,conflicts:[]}; }
  var hist = load('dc_history', {}), flows = load('dc_flows', {}), roster = load('dc_zone_roster', {});
  function score(c){
    var s=0, h=hist[c.name]; if(h&&typeof h==='object') s+=Object.keys(h).length;
    var f=flows[c.id]; if(f&&f.length) s+=f.length*1000;
    Object.keys(roster).forEach(function(mk){ if(Array.isArray(roster[mk])&&roster[mk].indexOf(c.id)>=0) s+=100; });
    return s;
  }
  var groups={};
  list.forEach(function(c){ if(c&&c.name){ var k=_normName(c.name); (groups[k]=groups[k]||[]).push(c); } });
  var removeSet={}, conflicts=[];
  Object.keys(groups).forEach(function(k){
    var g=groups[k]; if(g.length<2) return;
    g.sort(function(a,b){ return score(b)-score(a); });        // keeper (most data) first
    g.slice(1).forEach(function(d){ if(score(d)===0) removeSet[d.id]=1; else conflicts.push(d.name); });
  });
  var removed=Object.keys(removeSet).length;
  if(removed){
    save('dc_clients', list.filter(function(c){ return !removeSet[c.id]; }));
    var changed=false;
    Object.keys(roster).forEach(function(mk){ if(Array.isArray(roster[mk])){ var n=roster[mk].filter(function(id){return !removeSet[id];}); if(n.length!==roster[mk].length){ roster[mk]=n; changed=true; } } });
    if(changed) save('dc_zone_roster', roster);
  }
  localStorage.setItem('dc_dedupe_clients_v1','1');
  try{ console.log('Dedupe clients: removed '+removed+' empty duplicate(s)'+(conflicts.length?'; both-have-data (kept both): '+conflicts.join(', '):'')); }catch(e){}
  return {removed:removed, conflicts:conflicts};
}
// Pool clients NOT yet added to the active zone (for the "add to zone" picker).
function _poolNotInZone(){ var r=_zoneRoster(); return clients.filter(function(c){return c.active&&r.indexOf(c.id)<0;}); }

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
const EMAIL_RATE = 0.50;                        // email = 50¢
const SMS_EXTRA  = 0.10;                        // SMS adds 10¢
const SMS_DAY_RATE = EMAIL_RATE + SMS_EXTRA;    // 0.60 (email + SMS)

// ── сколько имейлов выставлено за один день ─────────────────────────────────
// Статус дня (yes/draft/no) один, а имейлов в этот день может быть несколько.
// Количество живёт отдельным ключом: {cid:{iso:N}}, причём N=1 не хранится — так
// старые данные читаются как «один имейл» без миграции. Деньги, счётчики и
// календари умножают ставку дня на это число.
const DAY_N_MAX = 99;
function _dayN(cid, iso){
  if(!cid || !iso) return 1;
  try{ var m=load('dc_day_count',{})[cid]; var n=+((m&&m[iso])||1); return n>=1?Math.min(n,DAY_N_MAX):1; }
  catch(e){ return 1; }
}
function _setDayN(cid, iso, n){
  if(!cid || !iso) return 1;
  n=Math.max(1, Math.min(DAY_N_MAX, +n||1));
  var all=load('dc_day_count',{});
  if(!all[cid]) all[cid]={};
  if(n<=1) delete all[cid][iso]; else all[cid][iso]=n;
  if(!Object.keys(all[cid]).length) delete all[cid];
  save('dc_day_count', all);
  return n;
}
// Ставка дня с учётом количества: N имейлов, каждый со своей SMS-надбавкой.
function _dayPay(cid, iso, hasSms){ return _dayN(cid,iso) * (hasSms ? SMS_DAY_RATE : EMAIL_RATE); }

// ── action log ── records WHEN each status mark was made, so History can show
// "on <day> I set <client> for <target date> = <status>". Global, going-forward.
// Entry: {t: ms, w: action-day ISO, c: client name, d: target date ISO, s: status}.
function _logAct(client, targetIso, status){
  try{
    if(!client || !targetIso) return;
    var log = gload('dc_actlog', []);
    log.push({ t: Date.now(), w: isoToday(), c: client, d: targetIso, s: status||'', z: activeMonth });
    if(log.length > 4000) log = log.slice(log.length-4000);
    gsave('dc_actlog', log);
    // Отметку поставили СЕЙЧАС — значит деньги за неё принадлежат активной зоне.
    // Через журнал проходят все пути отметки (сетка «Рассылок», список «Сегодня»,
    // календарь клиента, отмена), поэтому метка ставится в одном месте.
    _stampMarkZoneByName(client, targetIso, status);
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
// Obsolete: data is global now. Guarded so it can NEVER move/copy data again once
// globalization has run (the user forbade any automatic data relocation).
(function(){
  if(localStorage.getItem('dc_globalized_v1')) return;
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

// ── Удалённые вручную задачи из ClickUp ──────────────────────────────────────
// Синк с ClickUp бежит каждые 15 минут и больше ничего не удаляет сам, поэтому
// задачу, убранную руками, он бы возвращал снова и снова. Запоминаем её id, и
// pending-inject.js такую задачу заново не добавляет.
function _injectRemovedList(){
  try{ var l=JSON.parse(localStorage.getItem('dc_inject_removed')||'[]'); return Array.isArray(l)?l:[]; }catch(e){ return []; }
}
function _rememberRemovedInject(t){
  if(!t || !t.injectId) return;
  var l=_injectRemovedList();
  if(l.indexOf(t.injectId)<0){ l.push(t.injectId); try{ localStorage.setItem('dc_inject_removed', JSON.stringify(l)); }catch(e){} }
}

// ── Стрик: дни подряд без проваленных сроков ─────────────────────────────────
// Провален день, у которого был дедлайн (задача с deadline на этот день), а задача
// к его концу не была сделана. Сегодняшний день ещё идёт: незакрытый дедлайн на
// сегодня — не провал, а «стрик под угрозой» (см. _streakRisk).
function _deadlineTasks(){
  var out=[];
  try{
    var t=JSON.parse(localStorage.getItem('dc_plantasks')||'{}')||{};
    Object.keys(t).forEach(function(k){
      var x=t[k]; if(!x||x.gone||!x.deadline) return;
      out.push(x);
    });
  }catch(e){}
  return out;
}
// Задача со статусом «Later» (отложено) срок не срывает — ты сам решил перенести
function _postponed(x){ return !!x && x.status==='draft'; }

// Сколько дедлайнов этого дня осталось незакрытыми (0 = день чистый)
function _missedOn(iso, tasks){
  tasks=tasks||_deadlineTasks();
  var n=0;
  tasks.forEach(function(x){
    if(x.deadline!==iso) return;
    if(_postponed(x)) return;                          // отложено — не провал
    if(!x.done) { n++; return; }                       // не сделана вовсе
    if(x.doneDate && x.doneDate>iso) n++;              // сделана позже срока
  });
  return n;
}
// Что реально угрожает стрику: сроки, которые УЖЕ прошли и не закрыты. Сегодняшний
// день ещё идёт, поэтому сроки на сегодня в угрозу не идут — их показываем отдельно
// (_dueToday) как обычную работу на день.
function _streakRisk(){
  var today=isoToday(), tasks=_deadlineTasks(), risk=[];
  tasks.forEach(function(x){
    if(x.done || _postponed(x)) return;
    if(x.deadline<today) risk.push(x);
  });
  return risk;
}
// Сроки, которые истекают сегодня: ещё не провал, но закрыть надо до конца дня
function _dueToday(){
  var today=isoToday(), out=[];
  _deadlineTasks().forEach(function(x){
    if(x.done || _postponed(x)) return;
    if(x.deadline===today) out.push(x);
  });
  return out;
}
// Дни подряд без провалов. Идём назад от сегодня; сегодня учитывается только если
// на сегодня нет незакрытых дедлайнов. Пустой день (дедлайнов не было) стрик не рвёт.
function _streakDays(){
  var tasks=_deadlineTasks();
  if(!tasks.length) return 0;                       // сроков не было — стрику неоткуда начаться
  // Раньше самого первого срока считать нечего, иначе «чистыми» выглядят все дни
  // до начала работы и стрик упирался в предел цикла.
  var first=tasks.reduce(function(m,x){ return (!m||x.deadline<m)?x.deadline:m; }, '');
  var streak=0, d=new Date(getTODAY());
  var todayIso=isoToday();
  for(var i=0;i<400;i++){
    var iso=toISO(d);
    if(iso<first) break;
    if(iso===todayIso){
      // сегодня засчитывается, если нет просроченных хвостов; сроки, истекающие
      // сегодня, серию не портят — день ещё не кончился
      if(_streakRisk().length===0) streak++;
    } else {
      if(_missedOn(iso,tasks)>0) break;
      streak++;
    }
    d.setDate(d.getDate()-1);
  }
  return streak;
}
// Показывали ли уже сегодня напоминание про стрик (чтобы не долбить)
function _streakNudgeShown(kind){
  try{ return localStorage.getItem('dc_streak_nudge_'+kind)===isoToday(); }catch(e){ return false; }
}
function _markStreakNudge(kind){
  try{ localStorage.setItem('dc_streak_nudge_'+kind, isoToday()); }catch(e){}
}

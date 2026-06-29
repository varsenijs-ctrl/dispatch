let clients = load('dc_clients',[]);
let log = load('dc_log',{});
let historyData = load('dc_history',{});
let view = 'home';

function saveAll(){
  save('dc_clients',clients);
  save('dc_log',log);
  save('dc_history',historyData);
}

function switchMonth(mk){
  saveAll();
  activeMonth = mk;
  setActiveMonth(mk);
  clients = load('dc_clients',[]);
  log = load('dc_log',{});
  historyData = load('dc_history',{});
  try{ _dedupeFlowTasks(); }catch(e){}   // repair duplicate flow tasks for this month
  try{ _migrateManualDone(); }catch(e){}
  renderMonthBar();
  render();
}

// "Done" in Рассылки is now a persistent per-client flag {cid:true} (no daily
// reset). This migrates the old date-keyed shape {iso:{cid:true}} → flat by
// union, so previously-checked companies stay checked. Idempotent.
function _migrateManualDone(){
  var m=load('dc_manual_done',{});
  var hasDateShape=Object.keys(m).some(function(k){return m[k]&&typeof m[k]==='object';});
  if(!hasDateShape) return;
  var flat={};
  Object.keys(m).forEach(function(k){
    var v=m[k];
    if(v&&typeof v==='object'){ Object.keys(v).forEach(function(cid){ if(v[cid]) flat[cid]=true; }); }
    else if(v){ flat[k]=true; }
  });
  save('dc_manual_done',flat);
}

function addNewMonth(){
  const input = prompt('Введи месяц (например: 2026-07 или "июль 2026"):');
  if(!input) return;
  let mk = input.trim();
  const monthNames = ['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'];
  const m = mk.toLowerCase().match(/([а-яё]+)\s+(\d{4})/);
  if(m){
    const mi = monthNames.findIndex(n=>n.startsWith(m[1].slice(0,3)));
    if(mi>=0) mk = `${m[2]}-${String(mi+1).padStart(2,'0')}`;
  }
  if(!/^\d{4}-\d{2}$/.test(mk)){ alert('Неверный формат. Введи например: 2026-07'); return; }
  const months = getMonths();
  if(!months.includes(mk)) months.push(mk);
  months.sort();
  saveMonths(months);
  switchMonth(mk);
}

function renderMonthBar(){
  const bar = document.getElementById('month-bar');
  if(!bar) return;
  let months = getMonths();
  if(!months.includes(activeMonth)){ months.push(activeMonth); months.sort(); saveMonths(months); }
  const monthNames = MONTHS_RU;

  bar.innerHTML = '';

  months.forEach((mk, idx)=>{
    const [y,m] = mk.split('-');
    const label = `${monthNames[parseInt(m)-1]} ${y}`;
    const isActive = mk === activeMonth || (!activeMonth && mk === months[0]);

    const wrap = document.createElement('div');
    wrap.className = 'month-tab-wrap' + (isActive ? ' active' : '');
    wrap.draggable = true;
    wrap.dataset.mk = mk;
    wrap.dataset.idx = idx;
    wrap.style.cssText = 'display:flex;align-items:center;gap:0;flex-shrink:0;border-radius:16px;transition:opacity .15s;';

    const btn = document.createElement('button');
    btn.className = 'month-tab' + (isActive ? ' active' : '');
    btn.textContent = label;
    btn.onclick = () => { switchMonth(mk); };

    const del = document.createElement('button');
    del.className = 'month-tab-del';
    del.textContent = '×';
    del.title = 'Удалить месяц';
    del.onclick = (e) => { e.stopPropagation(); deleteMonth(mk); };

    wrap.appendChild(btn);
    wrap.appendChild(del);

    wrap.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', mk);
      wrap.style.opacity = '0.4';
    });
    wrap.addEventListener('dragend', () => { wrap.style.opacity = '1'; });
    wrap.addEventListener('dragover', e => { e.preventDefault(); wrap.style.background='rgba(var(--accent-rgb),.1)'; });
    wrap.addEventListener('dragleave', () => { wrap.style.background=''; });
    wrap.addEventListener('drop', e => {
      e.preventDefault();
      wrap.style.background = '';
      const fromMk = e.dataTransfer.getData('text/plain');
      if(fromMk === mk) return;
      const mos = getMonths();
      const fi = mos.indexOf(fromMk);
      const ti = mos.indexOf(mk);
      if(fi<0||ti<0) return;
      mos.splice(fi,1);
      mos.splice(ti,0,fromMk);
      saveMonths(mos);
      renderMonthBar();
    });

    bar.appendChild(wrap);
  });

  const sep = document.createElement('div');
  sep.className = 'month-bar-sep';
  bar.appendChild(sep);

  const addBtn = document.createElement('button');
  addBtn.className = 'month-tab-add';
  addBtn.textContent = '+';
  addBtn.title = 'Добавить месяц';
  addBtn.onclick = addNewMonth;
  bar.appendChild(addBtn);
}

function deleteMonth(mk){
  const months = getMonths();
  if(months.length <= 1){ _sfx.play('error');alert('Нельзя удалить последний месяц'); return; }
  if(!confirm(`Удалить «${mk}»? Все данные этого месяца удалятся.`)) return;
  const KEYS = ['dc_clients','dc_log','dc_history','dc_plans','dc_plantasks','dc_manual_done','dc_sms_days','dc_pay_disabled','dc_flows'];
  KEYS.forEach(k => localStorage.removeItem(k+'__'+mk));
  const newMonths = months.filter(m => m !== mk);
  saveMonths(newMonths);
  if(activeMonth === mk){
    const next = newMonths[0];
    activeMonth = next;
    setActiveMonth(next);
    clients = load('dc_clients',[]);
    log = load('dc_log',{});
    historyData = load('dc_history',{});
  }
  renderMonthBar();
  render();
}

const PRELOAD_HISTORY = {"Phygitals":{"2026-06-01":"no","2026-06-03":"no","2026-06-05":"no","2026-06-07":"no","2026-06-09":"no","2026-06-10":"no","2026-06-12":"no","2026-06-13":"no","2026-06-15":"no","2026-06-17":"no","2026-06-19":"no","2026-06-22":"no","2026-06-23":"no","2026-06-25":"no","2026-06-27":"no","2026-06-28":"no"},"Wild Harvest©":{"2026-06-01":"draft","2026-06-02":"yes","2026-06-03":"yes","2026-06-05":"yes","2026-06-07":"yes","2026-06-09":"yes","2026-06-11":"yes","2026-06-12":"yes","2026-06-14":"no","2026-06-16":"no","2026-06-18":"no","2026-06-20":"no","2026-06-21":"no","2026-06-23":"no","2026-06-25":"no","2026-06-26":"no","2026-06-28":"no"},"VitalynLab":{"2026-06-01":"draft","2026-06-03":"yes","2026-06-05":"yes","2026-06-07":"yes","2026-06-09":"yes","2026-06-11":"yes","2026-06-13":"no","2026-06-15":"no","2026-06-17":"no","2026-06-19":"no","2026-06-21":"no","2026-06-22":"no","2026-06-24":"no","2026-06-26":"no","2026-06-27":"no","2026-06-29":"no"},"Sunlight":{"2026-06-01":"no","2026-06-03":"no","2026-06-05":"no","2026-06-07":"no","2026-06-09":"no","2026-06-11":"no","2026-06-13":"no","2026-06-15":"no","2026-06-17":"no","2026-06-19":"no","2026-06-21":"no","2026-06-23":"no","2026-06-25":"no","2026-06-27":"no","2026-06-29":"no"},"Gala":{"2026-06-01":"no","2026-06-03":"no","2026-06-05":"no","2026-06-07":"no","2026-06-09":"no","2026-06-11":"no","2026-06-13":"no","2026-06-15":"no","2026-06-17":"no","2026-06-19":"no","2026-06-21":"no","2026-06-23":"no","2026-06-25":"no","2026-06-27":"no","2026-06-29":"no"},"Heyluna.sto":{"2026-06-01":"yes"},"Ovia":{"2026-06-01":"no","2026-06-02":"yes","2026-06-03":"no","2026-06-04":"yes","2026-06-05":"no","2026-06-06":"yes","2026-06-07":"no","2026-06-09":"draft","2026-06-11":"draft","2026-06-12":"draft","2026-06-14":"no","2026-06-16":"no","2026-06-18":"no","2026-06-20":"no","2026-06-22":"no","2026-06-23":"no","2026-06-25":"no","2026-06-27":"no","2026-06-28":"no"},"Steeli":{"2026-06-01":"no","2026-06-03":"no","2026-06-05":"no","2026-06-07":"no","2026-06-09":"no","2026-06-11":"no","2026-06-13":"no","2026-06-15":"no","2026-06-17":"no","2026-06-19":"no","2026-06-21":"no","2026-06-22":"no","2026-06-24":"no","2026-06-26":"no","2026-06-27":"no","2026-06-29":"no"},"LifeList Lab":{"2026-06-01":"no","2026-06-02":"yes","2026-06-03":"no","2026-06-04":"yes","2026-06-05":"no","2026-06-06":"yes","2026-06-07":"no","2026-06-09":"draft","2026-06-10":"draft","2026-06-12":"draft","2026-06-13":"no","2026-06-15":"no","2026-06-17":"no","2026-06-19":"no","2026-06-21":"no","2026-06-22":"no","2026-06-24":"no","2026-06-26":"no","2026-06-28":"no"},"MEDVI QUAD":{"2026-06-01":"no","2026-06-03":"no","2026-06-05":"no","2026-06-07":"no","2026-06-09":"no","2026-06-11":"no","2026-06-13":"no","2026-06-15":"no","2026-06-17":"no","2026-06-19":"no","2026-06-21":"no","2026-06-23":"no","2026-06-25":"no","2026-06-27":"no","2026-06-29":"no"},"Ruckusball":{"2026-06-01":"draft","2026-06-03":"draft","2026-06-05":"draft","2026-06-07":"draft","2026-06-09":"draft","2026-06-11":"draft","2026-06-12":"draft","2026-06-14":"no","2026-06-16":"no","2026-06-18":"no","2026-06-20":"no","2026-06-22":"no","2026-06-24":"no","2026-06-25":"no","2026-06-27":"no","2026-06-29":"no"},"orvani":{"2026-06-01":"draft","2026-06-03":"draft","2026-06-05":"draft","2026-06-07":"draft","2026-06-09":"draft","2026-06-10":"draft","2026-06-12":"draft","2026-06-13":"no","2026-06-15":"no","2026-06-17":"no","2026-06-19":"no","2026-06-21":"no","2026-06-22":"no","2026-06-24":"no","2026-06-26":"no","2026-06-28":"no"},"Lunavo":{"2026-06-01":"draft","2026-06-03":"draft","2026-06-05":"draft","2026-06-06":"draft","2026-06-08":"draft","2026-06-10":"draft","2026-06-12":"draft","2026-06-14":"no","2026-06-16":"no","2026-06-18":"no","2026-06-20":"no","2026-06-21":"no","2026-06-23":"no","2026-06-25":"no","2026-06-26":"no","2026-06-28":"no"},"BloomieBlankets":{"2026-06-01":"no","2026-06-03":"no","2026-06-04":"no","2026-06-05":"draft","2026-06-06":"no","2026-06-07":"draft","2026-06-08":"no","2026-06-09":"draft","2026-06-10":"no","2026-06-11":"draft","2026-06-13":"no","2026-06-15":"no","2026-06-17":"no","2026-06-19":"no","2026-06-21":"no","2026-06-22":"no","2026-06-24":"no","2026-06-25":"no","2026-06-27":"no","2026-06-29":"no"},"GRXY STUDIO":{"2026-06-01":"yes","2026-06-03":"yes","2026-06-05":"yes","2026-06-07":"yes","2026-06-09":"yes","2026-06-11":"yes","2026-06-13":"no","2026-06-15":"no","2026-06-17":"no","2026-06-19":"no","2026-06-21":"no","2026-06-22":"no","2026-06-24":"no","2026-06-25":"no","2026-06-27":"no","2026-06-29":"no"},"BareRitual":{"2026-06-01":"no","2026-06-02":"yes","2026-06-03":"no","2026-06-04":"yes","2026-06-05":"no","2026-06-06":"yes","2026-06-08":"draft","2026-06-09":"draft","2026-06-11":"draft","2026-06-13":"no","2026-06-15":"no","2026-06-17":"no","2026-06-19":"no","2026-06-21":"no","2026-06-22":"no","2026-06-24":"no","2026-06-26":"no","2026-06-28":"no"},"RISE":{"2026-06-01":"no","2026-06-02":"yes","2026-06-03":"no","2026-06-04":"yes","2026-06-05":"no","2026-06-06":"yes","2026-06-08":"draft","2026-06-09":"draft","2026-06-11":"draft","2026-06-13":"no","2026-06-15":"no","2026-06-17":"no","2026-06-19":"no","2026-06-21":"no","2026-06-22":"no","2026-06-24":"no","2026-06-26":"no","2026-06-28":"no"},"olevra":{"2026-06-01":"no","2026-06-03":"no","2026-06-05":"no","2026-06-07":"no","2026-06-09":"no","2026-06-10":"no","2026-06-12":"no","2026-06-13":"no","2026-06-15":"no","2026-06-17":"no","2026-06-19":"no","2026-06-20":"no","2026-06-21":"no","2026-06-23":"no","2026-06-25":"no","2026-06-27":"no","2026-06-29":"no"},"Lumine (Uncle Stiffy)":{"2026-06-01":"no","2026-06-03":"no","2026-06-05":"yes","2026-06-07":"yes","2026-06-08":"yes","2026-06-10":"yes","2026-06-11":"yes","2026-06-13":"no","2026-06-15":"no","2026-06-17":"no","2026-06-19":"no","2026-06-21":"no","2026-06-22":"no","2026-06-24":"no","2026-06-26":"no","2026-06-28":"no"},"Ascendant":{"2026-06-01":"no","2026-06-03":"no","2026-06-05":"no","2026-06-07":"yes","2026-06-09":"yes","2026-06-10":"yes","2026-06-12":"yes","2026-06-13":"no","2026-06-15":"no","2026-06-17":"no","2026-06-19":"no","2026-06-21":"no","2026-06-22":"no","2026-06-24":"no","2026-06-26":"no","2026-06-28":"no"},"FaithIsMade":{"2026-06-01":"yes","2026-06-03":"no","2026-06-05":"no","2026-06-07":"yes","2026-06-08":"yes","2026-06-10":"yes","2026-06-11":"yes","2026-06-13":"no","2026-06-15":"no","2026-06-17":"no","2026-06-19":"no","2026-06-21":"no","2026-06-22":"no","2026-06-24":"no","2026-06-26":"no","2026-06-28":"no"},"Undercare":{"2026-06-01":"no","2026-06-02":"no","2026-06-03":"no","2026-06-04":"no","2026-06-05":"yes","2026-06-07":"yes","2026-06-08":"yes","2026-06-10":"no","2026-06-12":"no","2026-06-14":"no","2026-06-16":"no","2026-06-18":"no","2026-06-20":"no","2026-06-21":"no","2026-06-23":"no","2026-06-25":"no","2026-06-26":"no","2026-06-28":"no"},"pokesource":{"2026-06-02":"draft","2026-06-03":"draft","2026-06-05":"draft","2026-06-07":"draft","2026-06-08":"draft","2026-06-10":"draft","2026-06-12":"no","2026-06-14":"no","2026-06-16":"no","2026-06-18":"no","2026-06-20":"no","2026-06-22":"no","2026-06-24":"no","2026-06-26":"no","2026-06-28":"no","2026-06-29":"no"},"Kerablend":{"2026-06-02":"draft","2026-06-04":"draft","2026-06-06":"draft","2026-06-08":"draft","2026-06-09":"no","2026-06-11":"no","2026-06-12":"no","2026-06-14":"no","2026-06-16":"no","2026-06-18":"no","2026-06-20":"no","2026-06-21":"no","2026-06-22":"no","2026-06-24":"no","2026-06-26":"no","2026-06-28":"no"},"Drinkretros.com":{"2026-06-02":"no","2026-06-04":"no","2026-06-06":"no","2026-06-07":"no","2026-06-09":"no","2026-06-11":"no","2026-06-13":"no","2026-06-15":"no","2026-06-17":"no","2026-06-19":"no","2026-06-21":"no","2026-06-23":"no","2026-06-25":"no","2026-06-27":"no","2026-06-29":"no"},"MEDVI GLP":{"2026-06-02":"no","2026-06-04":"no","2026-06-06":"no","2026-06-08":"no","2026-06-10":"no","2026-06-12":"no","2026-06-14":"no","2026-06-16":"no","2026-06-18":"no","2026-06-20":"no","2026-06-22":"no","2026-06-24":"no","2026-06-26":"no","2026-06-28":"no"},"MEDVI MEALS":{"2026-06-03":"no","2026-06-06":"no","2026-06-09":"no","2026-06-12":"no","2026-06-15":"no","2026-06-18":"no","2026-06-21":"no","2026-06-24":"no","2026-06-27":"no"},"Garden's Pulse":{"2026-06-03":"draft","2026-06-05":"yes","2026-06-07":"yes","2026-06-09":"yes","2026-06-10":"yes","2026-06-12":"yes","2026-06-13":"no","2026-06-15":"no","2026-06-17":"no","2026-06-19":"no","2026-06-21":"no","2026-06-23":"no","2026-06-25":"no","2026-06-27":"no","2026-06-29":"no"},"Orvia Labs":{"2026-06-03":"no","2026-06-05":"no","2026-06-07":"draft","2026-06-09":"draft","2026-06-10":"draft","2026-06-12":"no","2026-06-13":"no","2026-06-15":"no","2026-06-17":"no","2026-06-19":"no","2026-06-21":"no","2026-06-23":"no","2026-06-25":"no","2026-06-27":"no","2026-06-29":"no"},"Mizuro":{"2026-06-03":"no","2026-06-05":"no","2026-06-07":"yes","2026-06-09":"draft","2026-06-11":"draft","2026-06-13":"no","2026-06-15":"no","2026-06-17":"no","2026-06-19":"no","2026-06-21":"no","2026-06-23":"no","2026-06-24":"no","2026-06-26":"no","2026-06-28":"no","2026-06-29":"no"},"BikerVision":{"2026-06-05":"no","2026-06-07":"no","2026-06-08":"no","2026-06-10":"no","2026-06-12":"no","2026-06-14":"no","2026-06-16":"no","2026-06-18":"no","2026-06-20":"no","2026-06-21":"no","2026-06-23":"no","2026-06-25":"no","2026-06-27":"no","2026-06-29":"no"}};
const PRELOAD_CLIENTS = [{"id":"c_preload_000","name":"Phygitals","active":true,"smsEnabled":false,"schedule":"","deadline":null},{"id":"c_preload_001","name":"Wild Harvest©","active":true,"smsEnabled":false,"schedule":"","deadline":null},{"id":"c_preload_002","name":"VitalynLab","active":true,"smsEnabled":false,"schedule":"","deadline":null},{"id":"c_preload_003","name":"Sunlight","active":true,"smsEnabled":false,"schedule":"","deadline":null},{"id":"c_preload_004","name":"Gala","active":true,"smsEnabled":false,"schedule":"","deadline":null},{"id":"c_preload_005","name":"Heyluna.sto","active":true,"smsEnabled":false,"schedule":"","deadline":null},{"id":"c_preload_006","name":"Ovia","active":true,"smsEnabled":false,"schedule":"","deadline":null},{"id":"c_preload_007","name":"Steeli","active":true,"smsEnabled":false,"schedule":"","deadline":null},{"id":"c_preload_008","name":"LifeList Lab","active":true,"smsEnabled":false,"schedule":"","deadline":null},{"id":"c_preload_009","name":"MEDVI QUAD","active":true,"smsEnabled":false,"schedule":"","deadline":null},{"id":"c_preload_010","name":"Ruckusball","active":true,"smsEnabled":false,"schedule":"","deadline":null},{"id":"c_preload_011","name":"orvani","active":true,"smsEnabled":false,"schedule":"","deadline":null},{"id":"c_preload_012","name":"Lunavo","active":true,"smsEnabled":false,"schedule":"","deadline":null},{"id":"c_preload_013","name":"BloomieBlankets","active":true,"smsEnabled":false,"schedule":"","deadline":null},{"id":"c_preload_014","name":"GRXY STUDIO","active":true,"smsEnabled":false,"schedule":"","deadline":null},{"id":"c_preload_015","name":"BareRitual","active":true,"smsEnabled":false,"schedule":"","deadline":null},{"id":"c_preload_016","name":"RISE","active":true,"smsEnabled":false,"schedule":"","deadline":null},{"id":"c_preload_017","name":"olevra","active":true,"smsEnabled":false,"schedule":"","deadline":null},{"id":"c_preload_018","name":"Lumine (Uncle Stiffy)","active":true,"smsEnabled":false,"schedule":"","deadline":null},{"id":"c_preload_019","name":"Ascendant","active":true,"smsEnabled":false,"schedule":"","deadline":null},{"id":"c_preload_020","name":"FaithIsMade","active":true,"smsEnabled":false,"schedule":"","deadline":null},{"id":"c_preload_021","name":"Undercare","active":true,"smsEnabled":false,"schedule":"","deadline":null},{"id":"c_preload_022","name":"pokesource","active":true,"smsEnabled":false,"schedule":"","deadline":null},{"id":"c_preload_023","name":"Kerablend","active":true,"smsEnabled":false,"schedule":"","deadline":null},{"id":"c_preload_024","name":"Drinkretros.com","active":true,"smsEnabled":false,"schedule":"","deadline":null},{"id":"c_preload_025","name":"MEDVI GLP","active":true,"smsEnabled":false,"schedule":"","deadline":null},{"id":"c_preload_026","name":"MEDVI MEALS","active":true,"smsEnabled":false,"schedule":"","deadline":null},{"id":"c_preload_027","name":"Garden's Pulse","active":true,"smsEnabled":false,"schedule":"","deadline":null},{"id":"c_preload_028","name":"Orvia Labs","active":true,"smsEnabled":false,"schedule":"","deadline":null},{"id":"c_preload_029","name":"Mizuro","active":true,"smsEnabled":false,"schedule":"","deadline":null},{"id":"c_preload_030","name":"BikerVision","active":true,"smsEnabled":false,"schedule":"","deadline":null}];

function initPreload(){
  if(activeMonth !== '2026-06') return;
  const existing=load('dc_clients',[]);
  if(!existing.length){save('dc_clients',PRELOAD_CLIENTS);clients=[...PRELOAD_CLIENTS];}
  const existingHist=load('dc_history',{});
  const merged={};
  Object.keys(PRELOAD_HISTORY).forEach(name=>{merged[name]=Object.assign({},PRELOAD_HISTORY[name]);});
  Object.keys(existingHist).forEach(name=>{if(!merged[name])merged[name]={};Object.assign(merged[name],existingHist[name]);});
  save('dc_history',merged);
  historyData=merged;
}
function getLog(date,cid){
  if(!log[date])log[date]={};
  if(!log[date][cid])log[date][cid]={email:false,sms:false,blocked:false,note:''};
  return log[date][cid];
}
function isoToday(){const d=getTODAY();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function isDueToday(c){
  if(!c.active)return false;
  if(!c.schedule)return true;
  const dow=getTODAY().getDay();
  if(c.schedule==='weekly')return c.daysOfWeek&&c.daysOfWeek.includes(dow);
  if(c.schedule==='interval'){
    if(!c.startDate)return false;
    const start=new Date(c.startDate+'T00:00:00');
    const diff=Math.floor((new Date(getTODAY().toDateString())-start)/86400000);
    return diff>=0&&diff%(c.interval||2)===0;
  }
  return true;
}
function scheduleLabel(c){
  let s='';
  if(c.schedule==='monthly')s='каждый день';
  else if(c.schedule==='interval')s=`каждые ${c.interval||2} дня`;
  else if(c.schedule==='weekly'){const n=['вс','пн','вт','ср','чт','пт','сб'];s=(c.daysOfWeek||[]).map(d=>n[d]).join(', ');}
  if(c.deadline){
    const dl=new Date(c.deadline+'T00:00:00');
    const diff=Math.ceil((dl-new Date(getTODAY().toDateString()))/86400000);
    const ds=fmtDate(dl);
    if(diff<0)s+=(s?' · ':'')+`дедлайн просрочен`;
    else if(diff===0)s+=(s?' · ':'')+`дедлайн сегодня`;
    else s+=(s?' · ':'')+`дедлайн ${ds} (${diff}д)`;
  }
  return s;
}
function deadlineBadge(c, skipIfDone){
  if(!c.deadline)return '';
  // If client is marked done today — don't show overdue badge
  if(skipIfDone){
    if(load('dc_manual_done',{})[c.id]) return '';
  }
  const dl=new Date(c.deadline+'T00:00:00');
  const diff=Math.ceil((dl-new Date(getTODAY().toDateString()))/86400000);
  if(diff<0)return `<span class="badge badge-blocked" style="margin-left:6px">просрочен</span>`;
  if(diff===0)return `<span class="badge badge-pending" style="margin-left:6px">дедлайн сегодня!</span>`;
  if(diff<=3)return `<span class="badge badge-pending" style="margin-left:6px">${diff}д</span>`;
  return '';
}
function lastDoneInfo(c){
  const hist=historyData[c.name]||{};
  const logDates={};
  Object.entries(log).forEach(([ds,entries])=>{const e=entries[c.id];if(e&&e.email){const p=ds.split('.');if(p.length===3)logDates[`${p[2]}-${p[1]}-${p[0]}`]='yes';}});
  const all=Object.assign({},hist,logDates);
  const yesDates=Object.keys(all).filter(d=>all[d]==='yes').sort().reverse();
  if(!yesDates.length)return{text:'нет данных',cls:'old'};
  const last=yesDates[0];const lastDate=new Date(last+'T00:00:00');
  const diff=Math.floor((new Date(getTODAY().toDateString())-lastDate)/86400000);
  if(diff===0)return{text:'сегодня',cls:'fresh'};
  if(diff===1)return{text:'вчера',cls:'fresh'};
  if(diff<=7)return{text:`${diff}д назад`,cls:'stale'};
  return{text:fmtDate(lastDate),cls:'old'};
}
function clientSentCount(c){
  const hist=historyData[c.name]||{};
  let count=Object.values(hist).filter(v=>v==='yes').length;
  Object.entries(log).forEach(([ds,entries])=>{const e=entries[c.id];if(e&&e.email)count++;});
  return count;
}

// ── ensure the active month is registered in the months list ──
(function(){
  let months = getMonths();
  if(!months.includes(activeMonth)){
    months.push(activeMonth);
    months.sort();
    saveMonths(months);
  }
})();

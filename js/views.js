function updateSidebar(){

  const activeCl2=_zac();
  const manual2=load('dc_manual_done',{});
  const doneToday=activeCl2.filter(c=>manual2[c.id]).length;
  const pendingToday=activeCl2.length-doneToday;
  const _sp=document.getElementById('s-pending'); if(_sp)_sp.textContent=pendingToday;
  const _sd=document.getElementById('s-done'); if(_sd)_sd.textContent=doneToday;
  const _tb=document.getElementById('s-today-bar'); if(_tb){const _tt=doneToday+pendingToday; _tb.style.width=(_tt?Math.round(doneToday/_tt*100):0)+'%';}
  const _sb=document.getElementById('s-blocked'); if(_sb)_sb.textContent=0;
  const _sdSms=load('dc_sms_days',{});
  const activeCl=_zac();
  let em=0, sm=0;
  activeCl.forEach(c=>{
    const hist=historyData[c.name]||{};
    const cidSms=_sdSms[c.id]||{};
    Object.entries(hist).forEach(([iso,v])=>{
      if(!_markInActiveZone(c.id, iso)) return;   // same zone rule as Finance — counts agree, don't jump
      if(v==='yes'||v==='draft'){                 // ONLY sent + drafts (never 'no') — matches build "сайдбар-как-финансы" (446)
        em++;
        if(cidSms[iso]) sm++;
      }
    });
  });
  const _em=document.getElementById('s-email-month'); if(_em)_em.textContent=em;
  const _sm=document.getElementById('s-sms-month'); if(_sm)_sm.textContent=sm;
  const withSmsClients=activeCl.filter(c=>{
    if(c.smsEnabled) return true;
    const cidSms=_sdSms[c.id]||{};
    return Object.values(cidSms).some(Boolean);
  }).length;
  const withoutSmsClients=activeCl.length-withSmsClients;
  const _ws=document.getElementById('s-with-sms'); if(_ws)_ws.textContent=withSmsClients;
  const _wo=document.getElementById('s-without-sms'); if(_wo)_wo.textContent=withoutSmsClients;
  const _wm=document.getElementById('s-sms-missing'); if(_wm)_wm.textContent=withoutSmsClients;
  const _tot=document.getElementById('s-total'); if(_tot)_tot.textContent=activeCl.length;
}
const VIEW_TITLES={home:'Обзор',day_today:'Сегодня',today:'Рассылки',planner:'Планировщик',history:'История',clients:'Клиенты',finance:'Финансы',flows:'Флоу',invoices:'Инвойсы'};
function updateTopbar(){
  const t=document.getElementById('topbar-tabtitle'); if(t)t.textContent=VIEW_TITLES[view]||'';
  const z=document.getElementById('topbar-zone'); if(z)z.textContent=(typeof _finZoneLabel==='function'?_finZoneLabel():activeMonth);
}
// Context-aware "Добавить" button in the topbar.
function topbarAdd(){
  if(typeof _sfx!=='undefined'&&_sfx.play)_sfx.play('click');
  if(view==='clients'){ const i=document.getElementById('new-client-name'); if(i){i.focus();return;} }
  if(view==='flows'){ return; }              // flows are added per-client on that tab
  if(typeof openDayModal==='function'){ openDayModal(isoToday()); return; }  // default: add a task for today
}
function render(){
  const _now=getTODAY();
  const dateEl=document.getElementById('topbar-date');
  if(dateEl) dateEl.textContent=fmtDate(_now)+' '+DAYS_RU[_now.getDay()]+' · '+MONTHS_RU[_now.getMonth()];
  updateTopbar();
  updateSidebar();
  const el=document.getElementById('main-content');
  try{
  // Views with UI-only state (open panels, filters, expanded rows) must never come from
  // the data-version cache — toggling a flag doesn't bump _rv, so cached HTML would win
  // and the panel would never open (this is what broke «Импорт вставкой»).
  const _noC=['today','day_today','planner','finance','history','flows','invoices','clients'];
  const _rmap={home:renderHome,day_today:renderDayToday,today:renderToday,
    planner:renderPlanner,history:renderHistory,clients:renderClients,
    finance:renderFinance,flows:renderFlows,invoices:renderInvoices};
  const _rfn=_rmap[view];
  if(_rfn) el.innerHTML=_noC.includes(view)?_rfn():_cached(view,_rfn);
  }catch(err){
    el.innerHTML='<div style="padding:30px;color:var(--red);font-family:monospace;font-size:12px;background:rgba(255,0,0,.05);border-radius:18px;border:1px solid rgba(255,0,0,.2)"><div style="font-weight:700;margin-bottom:8px">⚠ Ошибка рендера: '+err.message+'</div><pre style="opacity:.7;font-size:11px">'+err.stack+'</pre></div>';
    console.error('Render error:', err);
  }
  bindEvents();
}

function togglePayDisabled(cid,iso){
  const dis=load('dc_pay_disabled',{});
  if(!dis[cid])dis[cid]={};
  if(dis[cid][iso])delete dis[cid][iso];else dis[cid][iso]=true;
  save('dc_pay_disabled',dis);render();
}

function toggleDaySms(cid,iso){
  const smsDays=load('dc_sms_days',{});
  if(!smsDays[cid])smsDays[cid]={};
  if(smsDays[cid][iso])delete smsDays[cid][iso];else smsDays[cid][iso]=true;
  save('dc_sms_days',smsDays);
  renderCalModal(cid);updateSidebar();
}

// ── Home (Обзор) — redesign v2 ───────────────────────────────
function _homeToggleTask(id){const t=load('dc_plantasks',{});if(t[id]){t[id].done=!t[id].done;save('dc_plantasks',t);render();}}
function renderHome(){
  const iso=isoToday();const mk=activeMonth;   // Home reflects the ACTIVE zone
  const ac=_zac();                              // only THIS zone's clients
  const manual=load('dc_manual_done',{});
  const doneTodayCount=ac.filter(c=>manual[c.id]).length;
  const totalToday=ac.length;const pendingToday=totalToday-doneTodayCount;
  let streak=0;
  for(let i=0;i<60;i++){const d=new Date(getTODAY());d.setDate(d.getDate()-i);const diso=toISO(d);const dman=load('dc_manual_done',{})[diso];const hasManual=dman&&Object.keys(dman).length>0;const hasHist=ac.some(c=>historyData[c.name]&&historyData[c.name][diso]==='yes');if(hasManual||hasHist)streak++;else if(i>0)break;}
  const deadlines=ac.filter(c=>c.deadline).map(c=>{const dl=new Date(c.deadline+'T00:00:00');const diff=Math.ceil((dl-new Date(getTODAY().toDateString()))/86400000);return{c,diff,dl};}).filter(x=>x.diff>=0&&x.diff<=14).sort((a,b)=>a.diff-b.diff);
  const _tasks=load('dc_plantasks',{});
  const todayTasks=Object.values(_tasks).filter(t=>!t.flowId&&!_isTaskClientPaused(t)&&t.startIso===iso).sort((a,b)=>(+b.prio||0)-(+a.prio||0));
  const todayTasksDone=todayTasks.filter(t=>t.done).length;
  const overdueHome=Object.values(_tasks).filter(t=>!t.flowId&&!_isTaskClientPaused(t)&&_overdue(t)).length;   // tasks are a global to-do
  const _T=computeFinanceTotals(financeScope);   // same source of truth as Finance
  const earnedUSD=_T.earned.toFixed(2), potentialUSD=_T.potential.toFixed(2);
  const earnPct=_T.potential?Math.round(_T.earned/_T.potential*100):0;
  const monthSends=_T.sentCount;
  const hh=new Date().getHours();const greet=hh<12?'Доброе утро':hh<17?'Добрый день':'Добрый вечер';
  const topMoney=ac.map(c=>{const p=_clientFinanceParts(c);return{c,m:p.email.e+p.sms.e+p.flows.e};}).filter(x=>x.m>0).sort((a,b)=>b.m-a.m).slice(0,6);
  const maxM=topMoney.length?topMoney[0].m:1;
  const P=_T.parts||{email:0,sms:0,flows:0,inv:0};
  const emailCnt=Math.round(P.email/0.5), smsCnt=Math.round(P.sms/0.1), flowCnt=Math.round(P.flows/0.6), invCnt=Math.round(P.inv/0.5);

  const CARD='background:linear-gradient(180deg,rgba(118,118,128,.20),rgba(118,118,128,.08));border:1px solid rgba(255,255,255,.08);border-radius:22px;backdrop-filter:blur(30px);-webkit-backdrop-filter:blur(30px);box-shadow:0 1px 0 rgba(255,255,255,.07) inset';
  const stat=(icon,color,label,value,sub,onclick)=>`<div style="${CARD};border-radius:20px;padding:17px 18px;box-shadow:0 1px 0 rgba(255,255,255,.07) inset,0 10px 30px rgba(0,0,0,.28)${onclick?';cursor:pointer':''}"${onclick?` onclick="${onclick}"`:''}><div style="display:flex;align-items:center;gap:7px"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icon}</svg><div style="font-size:11px;font-weight:580;letter-spacing:.2px;color:var(--text2)">${label}</div></div><div style="font-family:var(--mono);font-size:34px;font-weight:600;letter-spacing:-1.4px;margin-top:9px;color:${color}">${value}</div><div style="font-size:11.5px;color:var(--text3);margin-top:3px">${sub}</div></div>`;
  const icPlane='<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>';
  const icMoney='<path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>';
  const icFlame='<path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 002.5 2.5z"/>';
  const icCheck='<path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/>';
  const statCards=[
    stat(icPlane,'var(--text)','Рассылки',monthSends,'за '+MONTHS_SHORT[getTODAY().getMonth()],"setView('today')"),
    stat(icMoney,'var(--green)','Этот месяц','$'+earnedUSD,'заработано',"setView('finance')"),
    stat(icFlame,'var(--amber)','Стрик',streak,'дней подряд',''),
    stat(icCheck,'var(--accent)','Задачи сегодня',todayTasks.length,(overdueHome?overdueHome+' просрочено':todayTasksDone+' выполнено'),"setView('day_today')")
  ].join('');

  let deadlineRows='';
  deadlines.forEach(({c,diff,dl})=>{
    const col=diff===0?'var(--red)':diff<=3?'var(--amber)':'var(--text2)';
    const halo=diff===0?'rgba(255,69,58,.18)':diff<=3?'rgba(255,214,10,.18)':'rgba(255,255,255,.08)';
    const when=diff===0?'сегодня':diff===1?'завтра':dl.getDate()+' '+MONTHS_SHORT[dl.getMonth()];
    deadlineRows+=`<div onclick="openCal('${c.id}')" style="display:flex;align-items:center;gap:11px;padding:7px 9px;margin:0 -9px;border-radius:11px;cursor:pointer"><div style="width:7px;height:7px;border-radius:980px;flex:none;background:${col};box-shadow:0 0 0 3px ${halo}"></div><div style="flex:1;font-size:13px;letter-spacing:-.1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.name)}</div><div style="font-family:var(--mono);font-size:11.5px;font-weight:560;color:${col}">${when}</div></div>`;
  });

  const PRIO={4:['ВЫСОКИЙ','var(--red)','rgba(255,69,58,.16)'],3:['ВЫСОКИЙ','var(--amber)','rgba(255,214,10,.16)'],2:['СРЕДНИЙ','var(--blue)','rgba(10,132,255,.16)'],1:['НИЗКИЙ','var(--text3)','rgba(255,255,255,.08)']};
  let taskRows='';
  todayTasks.slice(0,6).forEach(t=>{
    const pr=PRIO[+t.prio||0];
    const chip=pr?`<div style="font-size:10px;font-weight:640;letter-spacing:.3px;padding:3px 8px;border-radius:980px;background:${pr[2]};color:${pr[1]}">${pr[0]}</div>`:'';
    const box=t.done?`<div style="width:16px;height:16px;border-radius:6px;flex:none;background:var(--green);display:flex;align-items:center;justify-content:center"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#06371a" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg></div>`:`<div style="width:16px;height:16px;border-radius:6px;flex:none;border:1.5px solid rgba(255,255,255,.22)"></div>`;
    taskRows+=`<div style="display:flex;align-items:center;gap:11px;padding:7px 9px;margin:0 -9px;border-radius:11px"><div onclick="_homeToggleTask('${t.id}')" style="cursor:pointer">${box}</div><div style="flex:1;font-size:13px;letter-spacing:-.1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;${t.done?'opacity:.5;text-decoration:line-through':''}">${esc(t.text)}${t.clientName?`<span style="color:var(--accent);font-size:10px;margin-left:6px">${esc(t.clientName)}</span>`:''}</div>${chip}</div>`;
  });

  let topRows='';
  topMoney.forEach(({c,m})=>{topRows+=`<div onclick="openCal('${c.id}')" style="cursor:pointer"><div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:6px"><span style="font-size:13px;letter-spacing:-.1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.name)}</span><span style="font-family:var(--mono);font-size:12.5px;font-weight:600">$${m.toFixed(2)}</span></div><div style="height:5px;border-radius:980px;background:rgba(255,255,255,.06);overflow:hidden"><div style="height:100%;border-radius:980px;background:var(--accent);box-shadow:0 1px 0 rgba(255,255,255,.3) inset;width:${Math.round(m/maxM*100)}%"></div></div></div>`;});

  const brk=[['Имейлы','var(--accent)',emailCnt,P.email],['SMS-надбавка','var(--blue)',smsCnt,P.sms],['Флоу','var(--purple)',flowCnt,P.flows],['Инвойсы','var(--green)',invCnt,P.inv]];
  let brkRows='';
  brk.forEach(([label,color,cnt,money])=>{brkRows+=`<div style="display:flex;align-items:center;gap:10px;padding:7px 0"><div style="width:9px;height:9px;border-radius:3px;flex:none;background:${color}"></div><div style="flex:1;font-size:13px">${label}</div><div style="font-family:var(--mono);font-size:11.5px;color:var(--text3);min-width:28px;text-align:right">${cnt}</div><div style="font-family:var(--mono);font-size:12.5px;min-width:56px;text-align:right">$${money.toFixed(2)}</div></div>`;});

  return `<div style="max-width:1220px">
    <div style="margin-bottom:22px"><div style="font-size:30px;font-weight:680;letter-spacing:-1px">${greet} 👋</div><div style="font-family:var(--mono);font-size:12.5px;color:var(--text3);margin-top:6px">${fmtDate(getTODAY())} · ${DAYS_RU[getTODAY().getDay()]} · ${pendingToday} клиентов ждут отметки</div></div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:12px">${statCards}</div>
    <div style="${CARD};border-radius:24px;padding:22px 24px;margin-bottom:12px;box-shadow:0 1px 0 rgba(255,255,255,.07) inset,0 14px 40px rgba(0,0,0,.3)">
      <div style="display:flex;align-items:flex-end;gap:44px;flex-wrap:wrap">
        <div><div style="font-size:11px;font-weight:580;letter-spacing:.3px;color:var(--text2)">ЗАРАБОТАНО</div><div style="font-family:var(--mono);font-size:46px;font-weight:600;letter-spacing:-2px;color:var(--green);margin-top:5px;line-height:1">$${earnedUSD}</div></div>
        <div style="padding-bottom:8px"><div style="font-size:11px;font-weight:580;letter-spacing:.3px;color:var(--text2)">МАКСИМУМ</div><div style="font-family:var(--mono);font-size:22px;font-weight:600;letter-spacing:-.7px;color:var(--text2);margin-top:4px">$${potentialUSD}</div></div>
        <div style="flex:1"></div>
        <div style="padding-bottom:8px;text-align:right"><div style="font-size:11px;font-weight:580;letter-spacing:.3px;color:var(--text2)">% ВЫПОЛНЕНО</div><div style="font-family:var(--mono);font-size:22px;font-weight:600;letter-spacing:-.7px;margin-top:4px">${earnPct}%</div></div>
      </div>
      <div style="height:10px;border-radius:980px;background:rgba(255,255,255,.06);margin-top:18px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,.4) inset"><div style="height:100%;border-radius:980px;background:linear-gradient(90deg,rgba(48,209,88,.75),#30d158);box-shadow:0 1px 0 rgba(255,255,255,.35) inset;transition:width .6s cubic-bezier(.2,.8,.2,1);width:${earnPct}%"></div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
      <div style="${CARD};padding:18px 20px"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px"><div style="font-size:14px;font-weight:640;letter-spacing:-.25px">Дедлайны</div><div style="font-family:var(--mono);font-size:11px;color:var(--text3)">${deadlines.length}</div></div><div style="display:flex;flex-direction:column;gap:2px">${deadlineRows||'<div style="color:var(--text3);font-size:12px;font-family:var(--mono);padding:4px 0">Нет дедлайнов</div>'}</div></div>
      <div style="${CARD};padding:18px 20px"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;cursor:pointer" onclick="setView('planner')"><div style="font-size:14px;font-weight:640;letter-spacing:-.25px">Задачи сегодня</div><div style="font-family:var(--mono);font-size:11px;color:${overdueHome?'var(--red)':'var(--text3)'}">${overdueHome?'⚠ '+overdueHome:todayTasks.length}</div></div><div style="display:flex;flex-direction:column;gap:2px">${taskRows||'<div style="color:var(--text3);font-size:12px;font-family:var(--mono);padding:4px 0">Нет задач на сегодня</div>'}</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1.35fr 1fr;gap:12px">
      <div style="${CARD};padding:18px 20px"><div style="font-size:14px;font-weight:640;letter-spacing:-.25px;margin-bottom:15px">Топ-клиенты</div><div style="display:flex;flex-direction:column;gap:12px">${topRows||'<div style="color:var(--text3);font-size:12px;font-family:var(--mono)">Нет данных</div>'}</div></div>
      <div style="${CARD};padding:18px 20px"><div style="font-size:14px;font-weight:640;letter-spacing:-.25px;margin-bottom:8px">Разбивка месяца</div>${brkRows}</div>
    </div>
  </div>`;
}

// ── Task drag & edit ─────────────────────────────────────────
var _dragId = null;

function _startDrag(el, e){
  var item = el.closest('[data-tid]');
  _dragId = item.dataset.tid;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', _dragId);
  setTimeout(function(){ if(item) item.style.opacity='.35'; }, 0);
}
function _endDrag(el){
  _dragId = null;
  document.querySelectorAll('[data-tid]').forEach(function(el){
    el.style.opacity='1';
    el.style.borderTop='';
    el.style.borderBottom='';
  });
}
function _dragOver(el, e){
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  var over = el.closest('[data-tid]');
  if(!over) return;
  // Visual indicator
  document.querySelectorAll('[data-tid]').forEach(function(x){ x.style.borderTop=''; x.style.borderBottom=''; });
  var rect = over.getBoundingClientRect();
  var mid  = rect.top + rect.height/2;
  if(e.clientY < mid) over.style.borderTop    = '2px solid var(--accent)';
  else                over.style.borderBottom  = '2px solid var(--accent)';
}
function _dragLeave(el){
  var item = el.closest('[data-tid]');
  if(item){ item.style.borderTop=''; item.style.borderBottom=''; }
}
function _drop(el, e){
  e.preventDefault();
  var over = el.closest('[data-tid]');
  if(!over || !_dragId || over.dataset.tid===_dragId) return;
  var tasks = load('dc_plantasks',{});
  // Rebuild the list in the SAME order the view shows (priority → manual → date), so
  // the reassigned sortOrder reflects what's on screen plus the move.
  var _pr=function(t){return +t.prio||0;};
  var _so=function(t){return t.sortOrder==null?1e9:t.sortOrder;};
  var _due=function(t){return t.deadline||t.startIso;};
  var sorted = Object.values(tasks)
    .sort(function(a,b){ return _pr(b)-_pr(a) || _so(a)-_so(b) || _due(a).localeCompare(_due(b)); });
  var fromIdx = sorted.findIndex(function(t){ return t.id===_dragId; });
  var toIdx   = sorted.findIndex(function(t){ return t.id===over.dataset.tid; });
  if(fromIdx<0||toIdx<0) return;
  // Determine insert position
  var rect = over.getBoundingClientRect();
  if(e.clientY > rect.top + rect.height/2) toIdx++;
  var item = sorted.splice(fromIdx,1)[0];
  if(toIdx > fromIdx) toIdx--;
  sorted.splice(toIdx,0,item);
  sorted.forEach(function(t,i){ tasks[t.id].sortOrder=i; });
  save('dc_plantasks',tasks);
  _sfx.play('click');
  render();
}
var _editTaskId = null;

function _editTask(id){
  var tasks = load('dc_plantasks',{});
  var t = tasks[id]; if(!t) return;
  _editTaskId = id;
  document.getElementById('et-text').value  = t.text||'';
  document.getElementById('et-from').value  = t.timeFrom||'';
  document.getElementById('et-to').value    = t.timeTo||'';
  document.getElementById('et-until').value = t.until||'';
  if(document.getElementById('et-deadline')) document.getElementById('et-deadline').value = t.deadline||'';
  document.getElementById('et-note').value  = t.note||'';
  // Client select: list EVERY client (incl. paused/inactive — you should be able to
  // reassign a task to anyone), preselecting the task's current client.
  var etCl = document.getElementById('et-client');
  if(etCl){
    // Only THIS zone's clients (no pool duplicates / legacy phantoms), plus the task's
    // current client if it lives outside the zone — so the current selection stays valid.
    var list = _zoneClients().map(function(c){return {id:c.id,name:c.name,active:c.active!==false};});
    var pool = (typeof clients!=='undefined'?clients:[]);
    var cur = null;
    if(t.cid) cur = pool.find(function(c){return c.id===t.cid;}) || list.find(function(c){return c.id===t.cid;});
    if(!cur && t.clientName) cur = pool.find(function(c){return c.name===t.clientName;});
    var curId   = cur ? cur.id   : (t.cid||'');
    var curName = cur ? cur.name : (t.clientName||'');
    if(curId && !list.some(function(c){return c.id===curId;})) list.push({id:curId, name:curName||curId, active:true});
    list.sort(function(a,b){return a.name.localeCompare(b.name,'ru');});
    var html = '<option value="">— без клиента —</option>' +
      list.map(function(c){return '<option value="'+esc(c.id)+'"'+(c.id===curId?' selected':'')+'>'+esc(c.name)+(c.active===false?' (пауза)':'')+'</option>';}).join('');
    etCl.innerHTML = html;
    etCl.value = curId || '';
  }
  // Set tod buttons (exclude the priority buttons, which share the .tod-btn style)
  document.querySelectorAll('#edit-task-modal .tod-btn:not([data-prio])').forEach(function(b){
    b.classList.toggle('active', b.dataset.tod===(t.tod||''));
  });
  // Set priority button
  var curPrio = String(+t.prio||0);
  document.querySelectorAll('#et-prio-row .tod-btn').forEach(function(b){
    b.classList.toggle('active', b.dataset.prio===curPrio);
  });
  var modal = document.getElementById('edit-task-modal');
  modal.style.display='flex';
  _sfx.play('open');
  setTimeout(function(){document.getElementById('et-text').focus();},100);
}
function _etSetTod(btn){
  var wasActive = btn.classList.contains('active');
  document.querySelectorAll('#edit-task-modal .tod-btn:not([data-prio])').forEach(function(b){b.classList.remove('active');});
  if(!wasActive) btn.classList.add('active');
}
function _etSetPrio(btn){
  document.querySelectorAll('#et-prio-row .tod-btn').forEach(function(b){b.classList.remove('active');});
  btn.classList.add('active');
}
function closeEditTask(){
  document.getElementById('edit-task-modal').style.display='none';
  _editTaskId=null;
  _sfx.play('close');
}
function saveEditTask(){
  if(!_editTaskId) return;
  var tasks = load('dc_plantasks',{});
  var t = tasks[_editTaskId]; if(!t) return;
  var text = document.getElementById('et-text').value.trim();
  if(!text) return;
  t.text      = text;
  t.timeFrom  = document.getElementById('et-from').value||'';
  t.timeTo    = document.getElementById('et-to').value||'';
  t.note      = document.getElementById('et-note').value||'';
  var activeTod = document.querySelector('#edit-task-modal .tod-btn.active:not([data-prio])');
  t.tod = activeTod ? activeTod.dataset.tod : '';
  var activePrio = document.querySelector('#et-prio-row .tod-btn.active');
  t.prio = activePrio ? (+activePrio.dataset.prio||0) : 0;
  var untilVal = document.getElementById('et-until').value||null;
  // Night: auto-extend to next day if no explicit until
  if(t.tod==='night'&&!untilVal){
    var nd=new Date(t.startIso+'T00:00:00');nd.setDate(nd.getDate()+1);
    untilVal=toISO(nd);
  }
  t.until = untilVal;
  t.deadline = (document.getElementById('et-deadline')||{}).value||'';
  // Client (re)assignment
  var etCl = document.getElementById('et-client');
  if(etCl){
    t.cid = etCl.value||'';
    var opt = etCl.options[etCl.selectedIndex];
    // the option's text IS the client name (works even if the client is in another zone)
    t.clientName = (opt && opt.value) ? opt.textContent.replace(/\s*\(пауза\)\s*$/,'').trim() : '';
  }
  save('dc_plantasks',tasks);
  closeEditTask();
  _sfx.play('done');
  // if the day window is open (planner), refresh its list too
  var dm=document.getElementById('day-modal');
  if(dm && dm.style.display!=='none' && typeof renderDayTasks==='function' && typeof currentDayIso!=='undefined') renderDayTasks(currentDayIso);
  render();
}

function isTodOverdue(tod, timeFrom, taskStartIso){
  var now = new Date();
  var h = now.getHours(), m = now.getMinutes();
  var nowMin = h*60+m;
  var iso = isoToday();
  if(timeFrom){
    var parts=timeFrom.split(':');
    var fromMin=parseInt(parts[0])*60+parseInt(parts[1]||0);
    return nowMin > fromMin;
  }
  if(tod==='morning') return nowMin >= 12*60;
  if(tod==='day')     return nowMin >= 17*60;
  if(tod==='evening') return nowMin >= 21*60;
  // Night: overdue only after 06:00 the day AFTER the task was created
  if(tod==='night'){
    if(!taskStartIso) return nowMin >= 6*60 && nowMin < 18*60;
    // If we're still on the same day as the task — never overdue yet
    if(taskStartIso >= iso) return false;
    // Next day after 6am = overdue
    return nowMin >= 6*60;
  }
  return false;
}

var todayFilter='all';   // all | overdue | today | deadline | next
// ── Сегодня ──────────────────────────────────────────────────
// Design screen: today's marking list (status segment per client + an inline month
// calendar). The task list is kept below it — nothing from the old tab is lost.
let dayMarkFilter='all';     // all | left | done | overdue
let dayExpandedCid=null;     // client whose inline calendar is open (one at a time)
function _dayToggleExpand(cid){ _sfx.play('click'); dayExpandedCid=(dayExpandedCid===cid?null:cid); render(); }
// Set a status directly (clicking the active one clears it). Same plumbing as the
// calendar modal: history + undo + action log + Google Sheet.
function _setDayMark(cid,iso,val){
  const c=clients.find(x=>x.id===cid); if(!c) return;
  _sfx.play('click');
  if(!historyData[c.name]) historyData[c.name]={};
  const prev=historyData[c.name][iso]||'';
  _undoStack.push({cid:cid,name:c.name,iso:iso,prev:prev}); if(_undoStack.length>MAX_UNDO)_undoStack.shift();
  const next=(prev===val)?'':val;
  if(next==='') delete historyData[c.name][iso]; else historyData[c.name][iso]=next;
  saveAll();
  try{ _logAct(c.name,iso,next); }catch(e){}
  try{ if(typeof _sheetPush==='function') _sheetPush(c.name,iso,next); }catch(e){}
  render();
}
// Inline calendar cell: пусто → yes → draft → нет → пусто
function _dayCycleInline(cid,iso){
  const c=clients.find(x=>x.id===cid); if(!c) return;
  const prev=(historyData[c.name]||{})[iso]||'';
  _setDayMark(cid,iso,{'':'yes','yes':'draft','draft':'no','no':''}[prev]);
}
function _dayToggleSmsInline(cid,iso){
  const smsDays=load('dc_sms_days',{});
  if(!smsDays[cid])smsDays[cid]={};
  if(smsDays[cid][iso])delete smsDays[cid][iso];else smsDays[cid][iso]=true;
  save('dc_sms_days',smsDays); _sfx.play('click'); render();
}
// The month calendar shown under an expanded client row (active zone's month).
function _dayInlineCalendar(c){
  const parts=activeMonth.split('-'); const y=+parts[0], m=+parts[1];
  const daysInMonth=new Date(y,m,0).getDate();
  const offset=(new Date(y,m-1,1).getDay()+6)%7;      // ПН-first
  const hist=historyData[c.name]||{};
  const cidSms=(load('dc_sms_days',{})[c.id])||{};
  const cidDis=(load('dc_pay_disabled',{})[c.id])||{};
  const tIso=isoToday();
  let marks=0, money=0;
  Object.keys(hist).forEach(function(k){
    if(k.slice(0,7)!==activeMonth) return;
    const v=hist[k]; if(!v) return; marks++;
    if((v==='yes'||v==='draft')&&!cidDis[k]) money+=cidSms[k]?SMS_DAY_RATE:EMAIL_RATE;
  });
  let cells='';
  for(let i=0;i<offset;i++) cells+='<div class="dday empty"></div>';
  for(let d=1;d<=daysInMonth;d++){
    const iso=y+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    const v=hist[iso]||'';
    const cls='dday'+(v?' st-'+v:'')+(iso===tIso?' today':'');
    const sms=!!cidSms[iso];
    const smsToggle=v?`<span class="dday-sms${sms?' on':''}" onclick="event.stopPropagation();_dayToggleSmsInline('${c.id}','${iso}')" title="${sms?'SMS есть — убрать':'SMS нет — добавить'}"><i></i></span>`:'';
    cells+=`<button class="${cls}" onclick="_dayCycleInline('${c.id}','${iso}')" title="${iso}${v?' · '+v:''}">
      <span class="dday-num">${d}</span><span class="dday-dot"></span>${smsToggle}</button>`;
  }
  return `<div style="padding:4px 17px 20px">
    <div class="dsunk" style="padding:16px 18px 18px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;flex-wrap:wrap">
        <div style="font-size:13px;font-weight:620;letter-spacing:-.2px">${MONTHS_RU[m-1]} ${y} · ${esc(c.name)}</div>
        <div class="dmeta">${marks} отмечено · $${money.toFixed(2)}</div>
        <div style="flex:1"></div>
        <button class="dbtn dbtn-sm" onclick="event.stopPropagation();openCal('${c.id}')" title="Открыть полный календарь (3 месяца)">📅 все месяцы</button>
        <div style="font-size:11.5px;color:var(--text3)">Клик по дню: да → черновик → нет → пусто</div>
      </div>
      <div class="dcal" style="margin-bottom:6px">${['ПН','ВТ','СР','ЧТ','ПТ','СБ','ВС'].map(w=>`<div class="dcal-dow">${w}</div>`).join('')}</div>
      <div class="dcal">${cells}</div>
    </div>
  </div>`;
}
function renderDayToday(){
  const iso=isoToday(), d=getTODAY();
  const ac=_zac().sort((a,b)=>a.name.localeCompare(b.name,'ru'));   // only THIS zone's clients
  const smsDays=load('dc_sms_days',{}), disAll=load('dc_pay_disabled',{});
  const markOf=c=>((historyData[c.name]||{})[iso]||'');
  const rateOf=c=>{ const s=(smsDays[c.id]||{})[iso], dis=(disAll[c.id]||{})[iso]; return dis?0:(s?SMS_DAY_RATE:EMAIL_RATE); };
  const overdueCl=ac.filter(c=>c.deadline&&c.deadline<iso);
  const leftCl=ac.filter(c=>!markOf(c));
  const doneCl=ac.filter(c=>{const m=markOf(c);return m==='yes'||m==='draft';});

  let html=`<div style="max-width:1040px">`;

  // ── marking list ──────────────────────────────────────────
  const MF=[['all','Все',ac.length],['left','Осталось',leftCl.length],['done','Готово',doneCl.length],['overdue','Просрочки',overdueCl.length]];
  if(!MF.some(f=>f[0]===dayMarkFilter)) dayMarkFilter='all';
  html+=`<div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;flex-wrap:wrap">`+
    MF.map(f=>`<button class="dpill ${dayMarkFilter===f[0]?'active':''}" onclick="dayMarkFilter='${f[0]}';render()">${f[1]}<span class="n">${f[2]}</span></button>`).join('')+
    `<div style="flex:1"></div><button class="dbtn dbtn-sm" onclick="setView('today')" title="Сетка-календарь всех клиентов">▦ сетка</button></div>`;

  if(overdueCl.length){
    const names=overdueCl.slice(0,4).map(c=>esc(c.name)+' ('+fmtDate(new Date(c.deadline+'T00:00:00')).slice(0,5)+')').join(', ');
    html+=`<div style="display:flex;align-items:center;gap:11px;padding:12px 16px;border-radius:16px;background:linear-gradient(180deg,rgba(255,69,58,.18),rgba(255,69,58,.08));border:1px solid rgba(255,69,58,.22);margin-bottom:14px;box-shadow:0 1px 0 rgba(255,255,255,.08) inset">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff453a" stroke-width="2" stroke-linecap="round" style="flex:none"><path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/></svg>
      <div style="font-size:13px;color:#ff8078;font-weight:540">${overdueCl.length} просрочк${overdueCl.length===1?'а':overdueCl.length<5?'и':''}: ${names}${overdueCl.length>4?' …':''}</div>
    </div>`;
  }

  const shown = dayMarkFilter==='left'?leftCl : dayMarkFilter==='done'?doneCl : dayMarkFilter==='overdue'?overdueCl : ac;
  if(!ac.length){
    // Пустая зона: переносим состав клиентов из прошлой прямо отсюда — иначе кажется,
    // что приложение «работает только в одной зоне».
    const _rmT=_rosterMap();
    const _pz=Object.keys(_rmT).filter(k=>k<activeMonth&&Array.isArray(_rmT[k])&&_rmT[k].length).sort().pop()
           || Object.keys(_rmT).filter(k=>Array.isArray(_rmT[k])&&_rmT[k].length).sort()[0];
    const _pl=_pz?(()=>{const p=_pz.split('-');return `${MONTHS_RU[+p[1]-1]} ${p[0]}`;})():'';
    html+=`<div class="dcard dcard-p" style="text-align:center;padding:30px 20px;color:var(--text3);font-family:var(--mono);font-size:13px;line-height:1.7">В зоне «${_finZoneLabel()}» нет клиентов.
      ${_pz?`<br>Перенеси список из прошлой зоны или добавь на вкладке «Клиенты».
      <div style="margin-top:14px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
        <button class="dbtn dbtn-primary" style="font-family:var(--font)" onclick="copyRosterFromPrevZone()">↩ Перенести ${_rmT[_pz].length} ${_plural(_rmT[_pz].length,'клиента','клиентов','клиентов')} из «${_pl}»</button>
        <button class="dbtn" style="font-family:var(--font)" onclick="setView('clients')">→ Клиенты</button>
      </div>`
      :`<br>Добавь их на вкладке «Клиенты».<br><button class="dbtn dbtn-primary" style="margin-top:14px" onclick="setView('clients')">→ Клиенты</button>`}
    </div>`;
  } else if(!shown.length){
    html+=`<div class="dcard dcard-p" style="text-align:center;padding:28px;color:var(--text3);font-family:var(--mono);font-size:13px">Здесь пусто.</div>`;
  } else {
    html+=`<div class="dcard" style="overflow:hidden;margin-bottom:22px">`;
    shown.forEach(c=>{
      const mk=markOf(c);
      const dot=mk==='yes'?'var(--green)':mk==='draft'?'#bf5af2':mk==='no'?'var(--red)':'rgba(255,255,255,.22)';
      const halo=mk==='yes'?'rgba(48,209,88,.18)':mk==='draft'?'rgba(191,90,242,.18)':mk==='no'?'rgba(255,69,58,.18)':'rgba(255,255,255,.06)';
      const exp=dayExpandedCid===c.id;
      const nFlows=getFlows(c.id).length;
      const meta=[];
      if(c.deadline){ const dl=new Date(c.deadline+'T00:00:00'); meta.push((c.deadline<iso?'просрочен ':'дедлайн ')+dl.getDate()+' '+_MSHORT[dl.getMonth()]); }
      // отметки ЭТОЙ зоны (отправлено + черновики) — та же логика, что в сайдбаре и Финансах,
      // иначе у клиента с одними черновиками показывалось «0 отправлено»
      const zHist=historyData[c.name]||{};
      let zSent=0, zDraft=0;
      Object.keys(zHist).forEach(k=>{ if(!_markInActiveZone(c.id,k))return; if(zHist[k]==='yes')zSent++; else if(zHist[k]==='draft')zDraft++; });
      meta.push(zSent+' отправлено'+(zDraft?' · '+zDraft+' черновик'+(zDraft>=2&&zDraft<=4?'а':zDraft>=5?'ов':''):''));
      if(nFlows) meta.push(nFlows+' флоу');
      if(c.paused) meta.push('на паузе');
      const pay=(mk==='yes'||mk==='draft')?('$'+rateOf(c).toFixed(2)):'—';
      const payCol=(mk==='yes'||mk==='draft')?'var(--green)':'var(--text3)';
      const smsChip=c.smsEnabled?`<div class="dchip dchip-sms">SMS</div>`:'';
      const seg=[['yes','Да','on-yes'],['draft','Черновик','on-draft'],['no','Нет','on-no']].map(o=>
        `<button class="${mk===o[0]?'on '+o[2]:''}" onclick="event.stopPropagation();_setDayMark('${c.id}','${iso}','${o[0]}')" title="${mk===o[0]?'Нажми ещё раз, чтобы снять':''}">${o[1]}</button>`).join('');
      html+=`<div style="border-bottom:1px solid rgba(255,255,255,.05)">
        <div class="dclient-row" onclick="_dayToggleExpand('${c.id}')" style="display:flex;align-items:center;gap:13px;padding:13px 17px;cursor:pointer;${c.paused?'opacity:.5;':''}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.32)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" style="flex:none;transition:transform .2s ease;transform:rotate(${exp?90:0}deg)"><path d="M9 6l6 6-6 6"/></svg>
          <div style="width:8px;height:8px;border-radius:980px;flex:none;background:${dot};box-shadow:0 0 0 3px ${halo}"></div>
          <div style="flex:1;min-width:0">
            <div style="font-size:13.5px;font-weight:540;letter-spacing:-.15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.name)}</div>
            <div class="dmeta" style="margin-top:3px">${meta.join(' · ')}</div>
          </div>
          ${smsChip}
          <div class="dseg">${seg}</div>
          <div style="font-family:var(--mono);font-size:12.5px;font-weight:600;width:48px;flex:none;text-align:right;color:${payCol}">${pay}</div>
        </div>
        ${exp?_dayInlineCalendar(c):''}
      </div>`;
    });
    html+=`</div>`;
  }


  // ── tasks (kept from the old tab, restyled) ───────────────
  const tasks=load('dc_plantasks',{});
  const todEmoji={morning:'🌅',day:'☀️',evening:'🌇',night:'🌙'};
  const due=t=>t.deadline||t.startIso;
  const G={overdue:[],today:[],next:[]}; const done=[]; const withDeadline=[];
  Object.values(tasks).forEach(t=>{
    if(t.flowId) return;                               // flows live in the Флоу tab
    if(_isTaskClientPaused(t)) return;
    if(t.done){ if(t.doneDate===iso||t.startIso===iso) done.push(t); return; }
    if(t.deadline) withDeadline.push(t);
    if(_overdue(t)) G.overdue.push(t);
    else if(t.startIso===iso||t.deadline===iso) G.today.push(t);
    else G.next.push(t);
  });
  const _pr=t=>+t.prio||0, _so=t=>(t.sortOrder==null?1e9:t.sortOrder);
  const _cmp=(a,b)=>_pr(b)-_pr(a)||_so(a)-_so(b)||due(a).localeCompare(due(b));
  G.overdue.sort(_cmp); G.today.sort(_cmp); G.next.sort(_cmp);
  withDeadline.sort((a,b)=>_pr(b)-_pr(a)||(a.deadline||'').localeCompare(b.deadline||''));
  const totalPending=G.overdue.length+G.today.length+G.next.length;

  html+=`<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap">
    <div class="dcard-t" style="font-size:16px">Задачи</div>
    <div class="dmeta">${fmtDate(d)} · ${DAYS_RU[d.getDay()]}</div>
    <div style="flex:1"></div>
    <button class="dbtn dbtn-primary dbtn-sm" onclick="openDayModal('${iso}')">+ задача</button>
  </div>`;

  const TF=[['all','Все',totalPending],['overdue','Просрочено',G.overdue.length],['today','Сегодня',G.today.length],['deadline','С дедлайном',withDeadline.length],['next','Следующие',G.next.length]];
  if(!TF.some(f=>f[0]===todayFilter)) todayFilter='all';
  html+=`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">`+
    TF.map(f=>`<button class="dpill ${todayFilter===f[0]?'active':''}" onclick="todayFilter='${f[0]}';render()">${f[1]}${f[2]?`<span class="n">${f[2]}</span>`:''}</button>`).join('')+`</div>`;

  function taskRow(t){
    const over=_overdue(t);
    const todLate=!over&&(t.tod||t.timeFrom)&&isTodOverdue(t.tod,t.timeFrom,t.startIso);
    const _cl=(t.cid&&clients.find(c=>c.id===t.cid))||(t.clientName&&clients.find(c=>c.name===t.clientName))||null;
    const cname=(_cl&&_cl.name)||t.clientName||'';
    const _open=_cl?`openCal('${_cl.id}')`:(t.cid?`openCal('${t.cid}')`:(cname?`openCalByName('${jsq(cname)}')`:''));
    const clientBadge=cname?`<span class="dchip dchip-sms" style="font-weight:560;letter-spacing:0;${_open?'cursor:pointer':''}" ${_open?`onclick="event.stopPropagation();${_open}"`:''}>${esc(cname)}</span>`:'';
    const meta=[];
    const dt=new Date(t.startIso+'T00:00:00');
    if(t.startIso!==iso) meta.push(`<span style="color:${over&&!t.deadline?'var(--red)':'var(--text3)'}">📅 ${fmtDate(dt)} ${DAYS_RU[dt.getDay()]}</span>`);
    if(t.timeFrom||t.timeTo) meta.push(`<span style="color:var(--accent)">${t.timeFrom||''}${t.timeTo?'–'+t.timeTo:''}</span>`);
    if(t.deadline) meta.push(`<span style="color:${over?'var(--red)':'#ffe066'}">⏳ ${fmtDate(new Date(t.deadline+'T00:00:00'))}</span>`);
    if(over){ const ago=Math.floor((new Date(getTODAY().toDateString())-new Date(due(t)+'T00:00:00'))/86400000); meta.push(`<span style="color:var(--red)">${ago}д назад</span>`); }
    const metaHtml=meta.length?`<div style="font-family:var(--mono);font-size:10px;margin-top:4px;display:flex;flex-wrap:wrap;gap:8px">${meta.join('')}</div>`:'';
    const note=(t.note&&t.note.indexOf('ClickUp')!==0)?`<div style="font-size:11px;color:var(--text3);margin-top:3px">${esc(t.note)}</div>`:'';
    const todIcon=t.tod&&todEmoji[t.tod]?`<span style="font-size:13px;margin-right:5px">${todEmoji[t.tod]}</span>`:'';
    const bc=over?'rgba(255,69,58,.28)':todLate?'rgba(255,69,58,.22)':'rgba(255,255,255,.06)';
    const bg=over?'linear-gradient(180deg,rgba(255,69,58,.14),rgba(255,69,58,.05))':'rgba(255,255,255,.05)';
    return `<div data-tid="${t.id}" draggable="true" ondragstart="_startDrag(this,event)" ondragend="_endDrag(this)" ondragover="_dragOver(this,event)" ondragleave="_dragLeave(this)" ondrop="_drop(this,event)"
      style="display:flex;align-items:flex-start;gap:10px;padding:11px 13px;border:1px solid ${bc};border-radius:14px;margin-bottom:7px;background:${bg}">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.26)" stroke-width="2.4" stroke-linecap="round" style="margin-top:4px;flex:none;cursor:grab" title="Перетащить"><path d="M4 8h16M4 16h16"/></svg>
      <div onclick="toggleDayTask('${t.id}');render()" style="width:16px;height:16px;border-radius:6px;border:1.5px solid ${over?'rgba(255,69,58,.6)':'rgba(255,255,255,.22)'};margin-top:2px;flex:none;cursor:pointer"></div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;flex-wrap:wrap;gap:6px">${prioFlag(t.prio)}${todIcon}<span class="task-text" ondblclick="event.stopPropagation();_editTask('${t.id}')" style="font-size:13px;font-weight:540;letter-spacing:-.1px;cursor:pointer;${over?'color:#ff8078':''}" title="Двойной клик — редактировать">${esc(t.text)}</span>${clientBadge}</div>
        ${metaHtml}${note}
      </div>
      <input type="date" class="dinput dinput-sm ddate" value="${t.startIso}" onclick="event.stopPropagation()" onchange="moveTask('${t.id}',this.value)" title="Перенести на другой день" style="font-size:10px;padding:3px 6px">
      <button class="dicon neutral" onclick="event.stopPropagation();_editTask('${t.id}')" title="Редактировать">✎</button>
      <button class="dicon" onclick="event.stopPropagation();removeDayTask('${t.id}');render()" title="Удалить">✕</button>
    </div>`;
  }

  if(!totalPending&&!done.length){
    html+=`<div class="dcard dcard-p" style="text-align:center;padding:26px;color:var(--text3);font-family:var(--mono);font-size:13px">Задач нет — нажми «+ задача».</div>`;
  } else if(todayFilter==='all'){
    [[G.overdue,'⚠ Просрочено','var(--red)'],[G.today,'📌 Сегодня','var(--green)'],[G.next,'→ Следующие дни','var(--accent)']].forEach(g=>{
      if(g[0].length) html+=`<div class="dmeta" style="color:${g[2]};letter-spacing:.08em;text-transform:uppercase;margin:16px 0 8px">${g[1]} — ${g[0].length}</div>`+g[0].map(taskRow).join('');
    });
  } else {
    const arr=todayFilter==='deadline'?withDeadline:G[todayFilter];
    html+=(arr&&arr.length)?arr.map(taskRow).join(''):`<div class="dcard dcard-p" style="text-align:center;padding:26px;color:var(--text3);font-family:var(--mono);font-size:13px">Здесь пусто.</div>`;
  }

  if(todayFilter==='all'&&done.length){
    html+=`<div style="margin-top:18px;padding-top:14px;border-top:1px solid rgba(255,255,255,.07)"><div class="dmeta" style="text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">✓ Готово сегодня — ${done.length}</div>`;
    done.forEach(t=>{
      const cb=t.clientName?`<span class="dchip dchip-dim">${esc(t.clientName)}</span>`:'';
      html+=`<div style="display:flex;align-items:center;gap:10px;padding:10px 13px;border:1px solid rgba(255,255,255,.06);border-radius:14px;margin-bottom:6px;background:rgba(255,255,255,.04);opacity:.55">
        <div onclick="toggleDayTask('${t.id}');render()" style="width:16px;height:16px;border-radius:6px;background:var(--green);display:flex;align-items:center;justify-content:center;flex:none;cursor:pointer"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#06371a" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg></div>
        <div style="flex:1;display:flex;align-items:center;flex-wrap:wrap;gap:6px"><span style="font-size:13px;text-decoration:line-through;color:var(--text3)">${esc(t.text)}</span>${cb}</div>
        <button class="dicon" onclick="event.stopPropagation();removeDayTask('${t.id}');render()" title="Удалить">✕</button>
      </div>`;
    });
    html+=`</div>`;
  }

  html+=`</div>`;
  return html;
}

// ── Рассылки — сетка клиенты × дни месяца (по макету) ─────────
// Клик по ячейке циклит статус, галочка слева отмечает клиента сделанным за сегодня
// (та же кнопка «готово», что была на старой вкладке), справа — деньги за месяц.
function renderToday(){
  const iso=isoToday();
  const ac=_zac().sort((a,b)=>a.name.localeCompare(b.name,'ru'));   // only THIS zone's clients
  const parts=activeMonth.split('-'); const y=+parts[0], m=+parts[1];
  const daysInMonth=new Date(y,m,0).getDate();
  const smsDays=load('dc_sms_days',{}), disAll=load('dc_pay_disabled',{}), manual=load('dc_manual_done',{});
  const doneCount=ac.filter(c=>manual[c.id]).length;
  const pct=ac.length?Math.round(doneCount/ac.length*100):0;

  let html=`<div>
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:14px;flex-wrap:wrap">
      ${[['Отправлено','#30d158'],['Черновик','#bf5af2'],['Не сделано','#ff453a']].map(l=>
        `<div style="display:flex;align-items:center;gap:7px;flex:none;white-space:nowrap"><div style="width:11px;height:11px;border-radius:4px;flex:none;background:${l[1]}"></div><span style="font-size:12px;color:var(--text2)">${l[0]}</span></div>`).join('')}
      <div style="width:1px;height:14px;background:rgba(255,255,255,.1)"></div>
      <span style="font-size:12px;color:var(--text3)">Клик по ячейке меняет статус · «Готово» отмечает клиента за сегодня</span>
      <div style="flex:1"></div>
      <span class="dmeta">${doneCount}/${ac.length} готово · ${pct}%</span>
      <button class="dbtn dbtn-sm" onclick="setView('day_today')" title="Отметки списком со статусами">☰ списком</button>
    </div>`;

  if(!ac.length){
    return html+`<div class="dcard dcard-p" style="text-align:center;padding:30px;color:var(--text3);font-family:var(--mono);font-size:13px;line-height:1.7">В зоне «${_finZoneLabel()}» нет клиентов.<br><button class="dbtn dbtn-primary" style="margin-top:14px" onclick="setView('clients')">→ Клиенты</button></div></div>`;
  }

  // header: day numbers (today accented)
  const NAMECOL=206, GAP=3;
  let head='';
  for(let d=1;d<=daysInMonth;d++){
    const dIso=y+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    const isT=dIso===iso;
    head+=`<div style="width:26px;flex:none;text-align:center;font-family:var(--mono);font-size:10px;font-weight:600;color:${isT?'var(--accent)':'var(--text3)'}">${d}</div>`;
  }

  let rows='';
  ac.forEach(c=>{
    const hist=historyData[c.name]||{};
    const cidSms=smsDays[c.id]||{}, cidDis=disAll[c.id]||{};
    let money=0, cells='';
    for(let d=1;d<=daysInMonth;d++){
      const dIso=y+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0');
      const v=hist[dIso]||'';
      if((v==='yes'||v==='draft')&&!cidDis[dIso]) money+=cidSms[dIso]?SMS_DAY_RATE:EMAIL_RATE;
      const cls='dgcell'+(v?' g-'+v:'')+(dIso===iso?' today':'');
      const ring=dIso===iso?'box-shadow:0 0 0 1.5px var(--accent)':'';
      cells+=`<button class="${cls}" style="${ring}" onclick="_dayCycleInline('${c.id}','${dIso}')" title="${dIso}${v?' · '+v:''}${cidSms[dIso]?' · SMS':''}"></button>`;
    }
    const isDone=!!manual[c.id];
    rows+=`<div style="display:flex;align-items:center;gap:${GAP}px;margin-bottom:${GAP}px">
      <div style="width:${NAMECOL}px;flex:none;display:flex;align-items:center;gap:8px;padding-right:12px">
        <button class="dgdone${isDone?' on':''}" onclick="${isDone?`undoDoneToday('${c.id}')`:`markDoneToday('${c.id}')`}" title="${isDone?'Снять отметку «сделано сегодня»':'Отметить сделанной'}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
        </button>
        <div onclick="openCal('${c.id}')" style="flex:1;font-size:12.5px;letter-spacing:-.1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;${c.paused?'opacity:.45':''}" title="Открыть календарь клиента">${esc(c.name)}${c.deadline&&c.deadline<iso?' <span style="color:var(--red)">⚠</span>':''}</div>
      </div>
      ${cells}
      <div style="font-family:var(--mono);font-size:12px;font-weight:600;padding-left:16px;color:${money>0?'var(--green)':'var(--text3)'}">$${money.toFixed(2)}</div>
    </div>`;
  });

  html+=`<div class="dcard" style="padding:18px;overflow-x:auto">
    <div style="display:flex;gap:${GAP}px;padding-left:${NAMECOL+GAP}px;margin-bottom:7px">${head}</div>
    ${rows}
  </div></div>`;
  return html;
}

function markDoneToday(cid){ _sfx.play('done');
  const manual=load('dc_manual_done',{});
  manual[cid]=true;                       // persistent: stays checked until unchecked
  save('dc_manual_done',manual);
  _undoStack.push({type:'manual_done',cid,prev:false});
  if(_undoStack.length>MAX_UNDO)_undoStack.shift();
  // NB: this is a personal daily "done" tick — it must NOT write a yes/no status to
  // the Google Sheet (that only comes from the calendar's coloured cells).
  render();
}
function undoDoneToday(cid){ _sfx.play('undo');
  const manual=load('dc_manual_done',{});
  delete manual[cid];
  save('dc_manual_done',manual);
  _undoStack.push({type:'manual_done',cid,prev:true});
  if(_undoStack.length>MAX_UNDO)_undoStack.shift();
  render();
}

let historyDays = 30;
let historySelectedClient = null;
let historySelectedDate = null;   // История: selected action-day (Finance-style master/detail)

function setLog(clientName, iso, val){
  if(!historyData[clientName]) historyData[clientName]={};   // current work space (active zone)
  if(historyData[clientName][iso]===val) delete historyData[clientName][iso];
  else historyData[clientName][iso]=val;
  saveAll();
  const cur=historyData[clientName][iso]||'';
  try{ _logAct(clientName, iso, cur); }catch(e){}          // → action log (История)
  try{ if(typeof _sheetPush==='function') _sheetPush(clientName, iso, cur); }catch(e){}
  render();
}
function _setLogCell(el){
  const cid=el.dataset.slogClient;
  const iso=el.dataset.slogIso;
  const c=clients.find(function(x){return x.id===cid;});
  if(!c) return;
  const cur=(historyData[c.name]||{})[iso]||'';
  const cycle={'':'yes','yes':'draft','draft':'no','no':''};
  const next=cycle[cur]||'yes';
  setLog(c.name,iso,next);
}


// ── History: Finance-style master/detail keyed by the DAY I made the mark ──
// Left = list of dates (the days I worked). Click a date → see everything done
// that day (which client, what status, and the target date if it differs).
// Built from the action log (dc_actlog), grouped by action-day within the month.
// ── История — карточка на каждый рабочий день (по макету) ─────
// Источник тот же: журнал действий (dc_actlog), только клиенты активной зоны.
// В строке: статус · клиент · целевая дата (если отличается) · время · деньги.
// ── История — карточка на каждый день, ровно как в макете ─────
// Строка: точка · «Клиент — имейл + SMS» · время · деньги.
// Собирается из трёх источников активной зоны: отметки (журнал действий),
// выставленные флоу и инвойсы — как в макете, где есть и флоу, и инвойс.
function renderHistory(){
  const mk=activeMonth;
  const parts=mk.split('-'); const yy=+parts[0], mm=+parts[1];
  const monthName=((MONTHS_RU[mm-1]||mk).charAt(0).toUpperCase()+(MONTHS_RU[mm-1]||'').slice(1))+' '+yy;
  const smsAll=load('dc_sms_days',{}), disAll=load('dc_pay_disabled',{});
  const G='#30d158', P='#bf5af2', R='#ff453a', B='#0a84ff';
  const hhmm=t=>{ if(!t) return ''; const d=new Date(t); return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'); };
  const dayMap={};                       // iso → {rows:[], earned:number}
  // force=true — вызывающий уже проверил принадлежность зоне через _markInActiveZone
  // (то же правило, что в Финансах), поэтому суммы Истории и Финансов сходятся.
  const push=(iso,row,force)=>{ if(!iso) return; if(!force&&iso.slice(0,7)!==mk) return; (dayMap[iso]=dayMap[iso]||{rows:[],earned:0}); dayMap[iso].rows.push(row); dayMap[iso].earned+=row.val||0; };

  // 1) отметки рассылок — день = ДАТА РАССЫЛКИ (как в макете: «5 августа» = что ушло
  //    в этот день), а не день, когда я нажал кнопку. Статус берём последний по времени.
  const _zNames=_zoneClientNames();
  const finalMap={};
  gload('dc_actlog',[]).slice().sort((a,b)=>(a.t||0)-(b.t||0)).forEach(e=>{
    if(!e.c||!e.d) return;
    if(!_zNames[String(e.c).toLowerCase()]) return;
    finalMap[e.c+'|'+e.d]=e;                                   // последняя отметка за клиент|дату
  });
  Object.values(finalMap).forEach(e=>{
    if(e.s!=='yes'&&e.s!=='draft'&&e.s!=='no') return;
    const c=clients.find(x=>x.name===e.c);
    if(c&&!_markInActiveZone(c.id,e.d)) return;                 // только эта зона
    if(!c&&e.d.slice(0,7)!==mk) return;
    const sms=c?!!((smsAll[c.id]||{})[e.d]):false;
    const off=c?!!((disAll[c.id]||{})[e.d]):false;
    const val=(e.s==='yes'||e.s==='draft')&&!off?(sms?SMS_DAY_RATE:EMAIL_RATE):0;
    const what=e.s==='yes'?(sms?'имейл + SMS':'имейл'):e.s==='draft'?'черновик':'не сделано';
    push(e.d,{text:esc(e.c)+' — '+what, forDate:'', time:hhmm(e.t), val:(e.s==='draft'||e.s==='no')?0:val,
              money:(e.s==='draft'||e.s==='no')?'—':'$'+val.toFixed(2),
              color:e.s==='yes'?G:e.s==='draft'?P:R, cname:e.c}, true);
  });

  // 2) выставленные флоу
  Object.values(load('dc_plantasks',{})).forEach(t=>{
    if(!t.flowId||!t.done) return;
    if(!_inRoster(t.cid)) return;
    const c=clients.find(x=>x.id===t.cid);
    const fl=(t.cid?getFlows(t.cid):[]).find(f=>f.id===t.flowId);
    const val=fl?fl.count*0.60:0;
    push(t.startIso,{text:(c?esc(c.name):'Без клиента')+' — флоу «'+esc(fl?fl.name:t.text)+'»', time:'', val:val, money:'$'+val.toFixed(2), color:P, cname:c?c.name:''}, _markInActiveZone(t.cid,t.startIso));
  });

  // 3) инвойсы
  loadInvoices().forEach(i=>{
    const val=i.count*INV_RATE;
    push(i.date,{text:'Инвойсы — '+i.count+' шт'+(i.note?' · '+esc(i.note):''), time:'', val:val, money:'$'+val.toFixed(2), color:B, cname:''});
  });

  const days=Object.keys(dayMap).sort((a,b)=>b.localeCompare(a));

  let html=`<div style="max-width:880px">`;
  if(!days.length){
    return html+`<div class="dcard dcard-p" style="text-align:center;padding:34px 22px;color:var(--text3);font-family:var(--mono);font-size:13px;line-height:1.8">В «${monthName}» пока ничего не было.<br>Отмечай статусы на «Сегодня» или «Рассылках» —<br>здесь появятся дни с отметками, флоу и инвойсами.<br><button class="dbtn dbtn-primary" style="margin-top:14px;font-family:var(--font)" onclick="setView('day_today')">→ Сегодня</button></div></div>`;
  }
  html+=`<div style="display:flex;flex-direction:column;gap:10px">`;
  days.forEach(w=>{
    const D=dayMap[w];
    const dt=new Date(w+'T00:00:00');
    const title=dt.getDate()+' '+_MGEN[dt.getMonth()]+', '+_DFULL[dt.getDay()]+(w===isoToday()?' · сегодня':'');
    const rows=D.rows.slice().sort((a,b)=>(a.time||'99').localeCompare(b.time||'99'));
    let rowsHtml='';
    rows.forEach(r=>{
      rowsHtml+=`<div class="drow"${r.cname?` onclick="openCalByName('${jsq(r.cname)}')" style="cursor:pointer"`:''}>
        <div style="width:6px;height:6px;border-radius:980px;flex:none;background:${r.color}"></div>
        <div style="flex:1;min-width:0;font-size:12.5px;color:rgba(255,255,255,.86);letter-spacing:-.1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.text}</div>
        ${r.forDate?`<div style="font-family:var(--mono);font-size:11px;color:rgba(255,255,255,.22)">${r.forDate}</div>`:''}
        <div style="font-family:var(--mono);font-size:11.5px;color:var(--text3)">${r.time}</div>
        <div style="font-family:var(--mono);font-size:12px;font-weight:600;width:48px;text-align:right">${r.money}</div>
      </div>`;
    });
    html+=`<div class="dcard" style="padding:16px 19px;border-radius:20px">
      <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:12px;gap:10px">
        <div class="dcard-t">${title}</div>
        <div style="font-family:var(--mono);font-size:15px;font-weight:600;color:${G}">$${D.earned.toFixed(2)}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:2px">${rowsHtml}</div>
    </div>`;
  });
  html+=`</div></div>`;
  return html;
}


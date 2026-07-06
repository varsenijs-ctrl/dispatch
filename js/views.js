function updateSidebar(){

  const activeCl2=clients.filter(c=>c.active&&!c.paused);
  const manual2=load('dc_manual_done',{});
  const doneToday=activeCl2.filter(c=>manual2[c.id]).length;
  const pendingToday=activeCl2.length-doneToday;
  const _sp=document.getElementById('s-pending'); if(_sp)_sp.textContent=pendingToday;
  const _sd=document.getElementById('s-done'); if(_sd)_sd.textContent=doneToday;
  const _sb=document.getElementById('s-blocked'); if(_sb)_sb.textContent=0;
  const mk=monthKey(getTODAY());
  const _sdSms=load('dc_sms_days',{});
  const activeCl=clients.filter(c=>c.active&&!c.paused);
  let em=0, sm=0;
  activeCl.forEach(c=>{
    const hist=historyData[c.name]||{};
    const cidSms=_sdSms[c.id]||{};
    Object.entries(hist).forEach(([iso,v])=>{
      if(iso.slice(0,7)!==mk) return;
      if(v==='yes'||v==='draft'){
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
function render(){
  const _now=getTODAY();
  const dateEl=document.getElementById('topbar-date');
  if(dateEl) dateEl.textContent=fmtDate(_now)+' '+DAYS_RU[_now.getDay()]+' · '+MONTHS_RU[_now.getMonth()];
  updateSidebar();
  const el=document.getElementById('main-content');
  try{
  const _noC=['today','day_today','planner','finance','history','flows','invoices'];
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

// ── Home ─────────────────────────────────────────────────────
function renderHome(){
  const iso=isoToday();const mk=activeMonth;   // Home reflects the ACTIVE zone
  const ac=clients.filter(c=>c.active&&!c.paused);
  const manual=load('dc_manual_done',{});
  const doneTodayCount=ac.filter(c=>manual[c.id]).length;
  const totalToday=ac.length;const pendingToday=totalToday-doneTodayCount;
  const pct=totalToday?Math.round(doneTodayCount/totalToday*100):0;
  let monthYes=0,monthNo=0,monthDraft=0;
  ac.forEach(c=>{const hist=historyData[c.name]||{};Object.entries(hist).forEach(([d,v])=>{if(!d.startsWith(mk))return;if(v==='yes')monthYes++;else if(v==='no')monthNo++;else if(v==='draft')monthDraft++;});});
  const monthTotal=monthYes+monthNo+monthDraft||1;
  const monthRate=Math.round(monthYes/monthTotal*100);
  let streak=0;
  for(let i=0;i<60;i++){const d=new Date(getTODAY());d.setDate(d.getDate()-i);const diso=toISO(d);const dman=load('dc_manual_done',{})[diso];const hasManual=dman&&Object.keys(dman).length>0;const hasHist=ac.some(c=>historyData[c.name]&&historyData[c.name][diso]==='yes');if(hasManual||hasHist)streak++;else if(i>0)break;}
  const deadlines=ac.filter(c=>c.deadline).map(c=>{const dl=new Date(c.deadline+'T00:00:00');const diff=Math.ceil((dl-new Date(getTODAY().toDateString()))/86400000);return{c,diff};}).filter(x=>x.diff>=0&&x.diff<=14).sort((a,b)=>a.diff-b.diff);
  const clientStats=ac.map(c=>{const hist=historyData[c.name]||{};const yes=Object.entries(hist).filter(([d,v])=>d.startsWith(mk)&&v==='yes').length;const total=Object.entries(hist).filter(([d])=>d.startsWith(mk)).length||1;return{c,yes,rate:Math.round(yes/total*100)};}).sort((a,b)=>b.yes-a.yes).slice(0,5);
  const _tasks=load('dc_plantasks',{});const _iso=isoToday();
  const todayTasks=Object.values(_tasks).filter(t=>!_isTaskClientPaused(t)&&t.startIso===_iso);
  const todayTasksCount=todayTasks.length;const todayTasksDone=todayTasks.filter(t=>t.done).length;
  const _smsDays=load('dc_sms_days',{});const _dis=load('dc_pay_disabled',{});
  // Same source of truth as the Finance tab, so both earnings blocks agree.
  const _T=computeFinanceTotals(financeScope);   // active work-zone (month), consistent with Finance
  const earnedAmt=_T.earned, potentialAmt=_T.potential, earnedCount=_T.sentCount, potentialCount=_T.totalCount;
  const flowEarnedAmt=0; // flows are already folded into earnedAmt
  const earnedUSD=earnedAmt.toFixed(2);const potentialUSD=potentialAmt.toFixed(2);
  const earnPct=potentialAmt?Math.round(earnedAmt/potentialAmt*100):0;
  const leftAmt=(potentialAmt-earnedAmt).toFixed(2);
  const overdueHome=Object.values(_tasks).filter(t=>!_isTaskClientPaused(t)&&_inZone(t.startIso)&&_overdue(t)).length;
  const upcomingTasks=Object.values(_tasks).filter(t=>{if(t.done||_isTaskClientPaused(t)||!_inZone(t.startIso))return false;const d=new Date(t.startIso+'T00:00:00');const diff=Math.ceil((d-new Date(getTODAY().toDateString()))/86400000);return diff>=0&&diff<=6;}).sort((a,b)=>a.startIso.localeCompare(b.startIso)).slice(0,6);
  const h=new Date().getHours();const greet=h<12?'Доброе утро':h<17?'Добрый день':'Добрый вечер';

  let deadlineRows='';
  deadlines.forEach(({c,diff})=>{deadlineRows+=`<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.05);cursor:pointer" onclick="openCal('${c.id}')"><div style="flex:1;font-size:12px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.name)}</div><div style="font-family:var(--mono);font-size:11px;padding:2px 8px;border-radius:16px;white-space:nowrap;background:${diff===0?'rgba(255,69,58,.2)':diff<=3?'rgba(255,214,10,.15)':'rgba(255,255,255,.07)'};color:${diff===0?'var(--red)':diff<=3?'var(--amber)':'var(--text3)'}">${diff===0?'сегодня':diff===1?'завтра':diff+'д'}</div></div>`;});
  let taskRows='';
  upcomingTasks.forEach(t=>{const d=new Date(t.startIso+'T00:00:00');const diff=Math.ceil((d-new Date(getTODAY().toDateString()))/86400000);const label=diff===0?'сегодня':diff===1?'завтра':DAYS_RU[d.getDay()]+' '+d.getDate();taskRows+=`<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.05)"><div style="width:6px;height:6px;border-radius:10px;background:var(--blue);flex-shrink:0"></div><div style="flex:1;font-size:12px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(t.text)}${t.clientName?`<span style="color:var(--blue);font-size:10px;margin-left:6px">${esc(t.clientName)}</span>`:''}</div><div style="font-family:var(--mono);font-size:10px;color:var(--text3);white-space:nowrap">${label}</div></div>`;});
  let topClientRows='';
  clientStats.forEach((s,i)=>{topClientRows+=`<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.05);cursor:pointer" onclick="openCal('${s.c.id}')"><div style="font-family:var(--mono);font-size:11px;color:var(--text3);width:16px;text-align:right">${i+1}</div><div style="flex:1;font-size:12px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(s.c.name)}</div><div style="display:flex;align-items:center;gap:6px"><div style="width:50px;height:3px;background:rgba(255,255,255,.08);border-radius:10px;overflow:hidden"><div style="width:${s.rate}%;height:100%;background:var(--green);border-radius:10px"></div></div><div style="font-family:var(--mono);font-size:10px;color:var(--green);min-width:24px;text-align:right">${s.yes}</div></div></div>`;});

  return `<div style="max-width:820px">
    <div style="margin-bottom:32px"><div style="font-size:24px;font-weight:700;letter-spacing:-.02em;margin-bottom:6px">${greet} 👋</div><div style="color:var(--text3);font-size:14px;font-family:var(--mono)">${fmtDate(getTODAY())} · ${DAYS_RU[getTODAY().getDay()]} · ${MONTHS_RU[getTODAY().getMonth()]}</div></div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px">
      <div style="background:${pct===100?'rgba(var(--accent-rgb),.12)':'rgba(255,255,255,.05)'};border:1px solid ${pct===100?'rgba(var(--accent-rgb),.3)':'rgba(255,255,255,.1)'};border-radius:22px;padding:18px 16px;backdrop-filter:blur(12px);cursor:pointer" onclick="setView('today')">
        <div style="font-size:11px;color:var(--text3);font-family:var(--mono);letter-spacing:.06em;text-transform:uppercase;margin-bottom:10px">Рассылки</div>
        <div style="font-size:36px;font-weight:700;letter-spacing:-.02em;color:${pct===100?'var(--green)':'var(--text)'};line-height:1">${doneTodayCount}<span style="font-size:16px;color:var(--text3);font-weight:400">/${totalToday}</span></div>
        <div style="margin-top:10px;height:3px;background:rgba(255,255,255,.08);border-radius:10px;overflow:hidden"><div style="width:${pct}%;height:100%;background:${pct===100?'var(--green)':'var(--blue)'};border-radius:10px;transition:width .6s"></div></div>
        <div style="margin-top:6px;font-size:11px;color:var(--text3);font-family:var(--mono)">${pendingToday} осталось</div>
      </div>
      <div style="background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);border-radius:22px;padding:18px 16px;backdrop-filter:blur(12px)">
        <div style="font-size:11px;color:var(--text3);font-family:var(--mono);letter-spacing:.06em;text-transform:uppercase;margin-bottom:10px">Этот месяц</div>
        <div style="font-size:36px;font-weight:700;letter-spacing:-.02em;line-height:1;color:var(--green)">${monthYes}<span style="font-size:16px;color:var(--text3);font-weight:400"> отпр.</span></div>
        <div style="margin-top:10px;height:3px;background:rgba(255,255,255,.08);border-radius:10px;overflow:hidden"><div style="width:${monthRate}%;height:100%;background:var(--green);border-radius:10px;box-shadow:0 0 6px var(--green-glow)"></div></div>
        <div style="margin-top:6px;font-size:11px;color:var(--text3);font-family:var(--mono)">${monthRate}% успешных</div>
      </div>
      <div style="background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);border-radius:22px;padding:18px 16px;backdrop-filter:blur(12px)">
        <div style="font-size:11px;color:var(--text3);font-family:var(--mono);letter-spacing:.06em;text-transform:uppercase;margin-bottom:10px">Стрик 🔥</div>
        <div style="font-size:36px;font-weight:700;letter-spacing:-.02em;line-height:1;color:var(--amber)">${streak}<span style="font-size:16px;color:var(--text3);font-weight:400"> дн</span></div>
        <div style="margin-top:16px;font-size:11px;color:var(--text3);font-family:var(--mono)">подряд активных дней</div>
      </div>
      <div style="background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);border-radius:22px;padding:18px 16px;backdrop-filter:blur(12px);cursor:pointer" onclick="setView('day_today')">
        <div style="font-size:11px;color:var(--text3);font-family:var(--mono);letter-spacing:.06em;text-transform:uppercase;margin-bottom:10px">Задачи сегодня</div>
        <div style="font-size:36px;font-weight:700;letter-spacing:-.02em;line-height:1;color:${todayTasksCount?'var(--blue)':'var(--text)'}">${todayTasksCount}</div>
        <div style="margin-top:16px;font-size:11px;color:var(--text3);font-family:var(--mono)">${todayTasksDone} выполнено</div>
      </div>
    </div>
    <div class="earn-card" style="background:linear-gradient(135deg,rgba(var(--accent-rgb),.12),rgba(var(--accent-rgb),.06));border:1px solid rgba(var(--accent-rgb),.2);border-radius:22px;padding:18px 22px;backdrop-filter:blur(12px);margin-bottom:12px;display:flex;align-items:center;gap:24px;flex-wrap:wrap">
      <div><div style="font-size:11px;color:var(--text3);font-family:var(--mono);letter-spacing:.06em;text-transform:uppercase;margin-bottom:6px">Заработано</div><div style="font-size:32px;font-weight:700;letter-spacing:-.02em;color:var(--green);line-height:1">$${earnedUSD}</div><div style="font-size:11px;color:var(--text3);font-family:var(--mono);margin-top:4px">${earnedCount} рассылок · ${financeScope==='all'?'всё время':_finZoneLabel()}</div></div>
      <div style="width:1px;height:48px;background:rgba(255,255,255,.1);flex-shrink:0"></div>
      <div><div style="font-size:11px;color:var(--text3);font-family:var(--mono);letter-spacing:.06em;text-transform:uppercase;margin-bottom:6px">Максимум</div><div style="font-size:32px;font-weight:700;letter-spacing:-.02em;color:var(--text);line-height:1">$${potentialUSD}</div><div style="font-size:11px;color:var(--text3);font-family:var(--mono);margin-top:4px">${potentialCount} записей</div></div>
      <div style="flex:1;min-width:160px"><div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="font-size:11px;color:var(--text3);font-family:var(--mono)">выполнено</span><span style="font-size:11px;color:var(--green);font-family:var(--mono);font-weight:600">${earnPct}%</span></div><div style="height:6px;background:rgba(255,255,255,.08);border-radius:13px;overflow:hidden"><div style="width:${earnPct}%;height:100%;background:linear-gradient(90deg,var(--green),rgba(48,209,88,.6));border-radius:13px;box-shadow:0 0 8px var(--green-glow);transition:width .6s"></div></div><div style="margin-top:6px;font-size:11px;color:var(--text3);font-family:var(--mono)">осталось: <span style="color:var(--amber)">$${leftAmt}</span></div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.09);border-radius:22px;padding:18px 16px;backdrop-filter:blur(12px)">
        <div style="font-size:12px;font-weight:600;margin-bottom:14px;display:flex;align-items:center;gap:8px"><span>Дедлайны</span><span style="font-size:10px;color:var(--text3);font-family:var(--mono)">след. 14 дней</span></div>
        ${deadlineRows||'<div style="color:var(--text3);font-size:12px;font-family:var(--mono);padding:8px 0">Нет дедлайнов</div>'}
      </div>
      <div style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.09);border-radius:22px;padding:18px 16px;backdrop-filter:blur(12px)">
        <div style="font-size:12px;font-weight:600;margin-bottom:14px;display:flex;align-items:center;gap:8px;cursor:pointer" onclick="setView('planner')"><span>Задачи</span>${overdueHome?'<span style="font-family:var(--mono);font-size:10px;padding:2px 7px;border-radius:14px;background:rgba(255,69,58,.15);color:var(--red)">⚠ '+overdueHome+' просроч.</span>':''}<span style="font-size:10px;color:var(--text3);font-family:var(--mono);margin-left:auto">след. 7 дней →</span></div>
        ${taskRows||'<div style="color:var(--text3);font-size:12px;font-family:var(--mono);padding:8px 0">Нет задач</div>'}
      </div>
      <div style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.09);border-radius:22px;padding:18px 16px;backdrop-filter:blur(12px)">
        <div style="font-size:12px;font-weight:600;margin-bottom:14px">Топ клиентов — ${MONTHS_SHORT[getTODAY().getMonth()]}</div>
        ${topClientRows||'<div style="color:var(--text3);font-size:12px">Нет данных</div>'}
      </div>
      <div style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.09);border-radius:22px;padding:18px 16px;backdrop-filter:blur(12px)">
        <div style="font-size:12px;font-weight:600;margin-bottom:14px">Месяц — разбивка</div>
        ${[{label:'Отправлено',val:monthYes,color:'var(--accent)',pct:Math.round(monthYes/monthTotal*100)},{label:'Не отправлено',val:monthNo,color:'var(--red)',pct:Math.round(monthNo/monthTotal*100)},{label:'Черновики',val:monthDraft,color:'var(--purple)',pct:Math.round(monthDraft/monthTotal*100)}].map(row=>`<div style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;margin-bottom:5px"><span style="font-size:12px;color:var(--text2)">${row.label}</span><span style="font-family:var(--mono);font-size:11px;color:${row.color}">${row.val} · ${row.pct}%</span></div><div style="height:4px;background:rgba(255,255,255,.07);border-radius:11px;overflow:hidden"><div style="width:${row.pct}%;height:100%;background:${row.color};border-radius:11px;transition:width .6s"></div></div></div>`).join('')}
        <div style="margin-top:14px;padding-top:12px;border-top:1px solid rgba(255,255,255,.06);display:flex;justify-content:space-between"><span style="font-size:12px;color:var(--text3)">Всего записей</span><span style="font-family:var(--mono);font-size:12px;font-weight:600">${monthYes+monthNo+monthDraft}</span></div>
      </div>
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
  // Rebuild sorted list
  var sorted = Object.values(tasks)
    .filter(function(t){ return t.sortOrder!==undefined||true; })
    .sort(function(a,b){ return (a.sortOrder||0)-(b.sortOrder||0); });
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
    // clients from EVERY zone (deduped by name) so robot tasks pointing at another
    // zone's client still resolve to a NAME, not a raw id.
    var list = _clientsUnion();
    // resolve the task's current client to a name
    var curName = '';
    if(t.cid){ var byId=list.find(function(c){return c.id===t.cid;}); if(byId) curName=byId.name; }
    if(!curName && t.clientName) curName=t.clientName;
    if(curName && !list.some(function(c){return c.name===curName;})) list.push({id:t.cid||curName, name:curName, active:true});
    list.sort(function(a,b){return a.name.localeCompare(b.name,'ru');});
    var html = '<option value="">— без клиента —</option>' +
      list.map(function(c){return '<option value="'+esc(c.id)+'"'+(c.name===curName?' selected':'')+'>'+esc(c.name)+(c.active===false?' (пауза)':'')+'</option>';}).join('');
    etCl.innerHTML = html;
    var selc = list.find(function(c){return c.name===curName;});
    etCl.value = selc ? selc.id : '';
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
function renderDayToday(){
  const iso=isoToday();
  const d=getTODAY();
  const tasks=load('dc_plantasks',{});
  const todEmoji={morning:'🌅',day:'☀️',evening:'🌇',night:'🌙'};

  // ── time-based buckets (mutually exclusive) + a cross-cutting «с дедлайном» lens ──
  const due=t=>t.deadline||t.startIso;
  const G={overdue:[],today:[],next:[]}; const done=[]; const withDeadline=[];
  Object.values(tasks).forEach(t=>{
    if(_isTaskClientPaused(t)) return;                         // paused client → hidden everywhere but Clients tab
    if(!_inZone(t.startIso)) return;                           // active zone only — this zone's tasks
    if(t.done){ if(t.doneDate===iso||t.startIso===iso) done.push(t); return; }
    if(t.deadline) withDeadline.push(t);                       // lens: any task that has a deadline
    if(_overdue(t)) G.overdue.push(t);
    else if(t.startIso===iso || t.deadline===iso) G.today.push(t);
    else G.next.push(t);                                       // everything else upcoming (with or without a deadline)
  });
  // sort by priority DESC first, then by date / manual order
  const _pr=t=>+t.prio||0;
  G.overdue.sort((a,b)=>_pr(b)-_pr(a) || due(a).localeCompare(due(b)));
  G.today.sort((a,b)=>_pr(b)-_pr(a) || (a.sortOrder||0)-(b.sortOrder||0));
  G.next.sort((a,b)=>_pr(b)-_pr(a) || due(a).localeCompare(due(b)));
  withDeadline.sort((a,b)=>_pr(b)-_pr(a) || (a.deadline||'').localeCompare(b.deadline||''));
  const totalPending=G.overdue.length+G.today.length+G.next.length;

  let html=`<div class="section-header"><h2>Сегодня — ${fmtDate(d)}, ${DAYS_RU[d.getDay()]}</h2><button class="toggle-btn" style="font-size:10px;padding:3px 10px" onclick="openDayModal('${iso}')">+ задача</button></div>`;

  // ── segmented sort/filter ──
  const FILTERS=[
    {k:'all',      label:'Все',         n:totalPending},
    {k:'overdue',  label:'Просрочено',  n:G.overdue.length},
    {k:'today',    label:'Сегодня',     n:G.today.length},
    {k:'deadline', label:'С дедлайном', n:withDeadline.length},
    {k:'next',     label:'Следующие',   n:G.next.length},
  ];
  if(!FILTERS.some(f=>f.k===todayFilter)) todayFilter='all';
  html+=`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px">`+
    FILTERS.map(f=>`<button onclick="todayFilter='${f.k}';render()" class="scope-btn ${todayFilter===f.k?'active':''}">${f.label}${f.n?` <span style="opacity:.65;font-family:var(--mono)">${f.n}</span>`:''}</button>`).join('')+`</div>`;

  if(!totalPending && !done.length){ html+=`<div class="empty"><span class="empty-icon">—</span>Задач нет.<br>Нажми «+ задача», чтобы добавить.</div>`; return html; }

  // ── one unified task row ──
  function taskRow(t){
    const over=_overdue(t);
    const todLate=!over&&(t.tod||t.timeFrom)&&isTodOverdue(t.tod,t.timeFrom,t.startIso);
    const _cl=(t.cid&&clients.find(c=>c.id===t.cid))||(t.clientName&&clients.find(c=>c.name===t.clientName))||null;
    const cname=(_cl&&_cl.name)||t.clientName||'';
    // clickable whenever we have any client ref — openCal/openCalByName resolve across zones
    const _open = _cl?`openCal('${_cl.id}')` : (t.cid?`openCal('${t.cid}')` : (cname?`openCalByName('${jsq(cname)}')`:''));
    const clientBadge=cname?`<span style="font-family:var(--mono);font-size:11px;padding:2px 8px;border-radius:14px;background:var(--blue-dim);color:var(--blue);margin-left:8px;white-space:nowrap;${_open?'cursor:pointer':''}" ${_open?`onclick="event.stopPropagation();${_open}"`:''}>${esc(cname)}</span>`:'';
    const meta=[];
    const dt=new Date(t.startIso+'T00:00:00');
    if(t.startIso!==iso) meta.push(`<span style="color:${over&&!t.deadline?'var(--red)':'var(--text3)'}">📅 ${fmtDate(dt)} ${DAYS_RU[dt.getDay()]}</span>`);
    if(t.timeFrom||t.timeTo) meta.push(`<span style="color:var(--accent)">${t.timeFrom||''}${t.timeTo?'–'+t.timeTo:''}</span>`);
    if(t.deadline) meta.push(`<span style="color:${over?'var(--red)':'var(--amber)'}">⏳ ${fmtDate(new Date(t.deadline+'T00:00:00'))}</span>`);
    if(over){ const daysAgo=Math.floor((new Date(getTODAY().toDateString())-new Date(due(t)+'T00:00:00'))/86400000); meta.push(`<span style="color:var(--red)">${daysAgo}д назад</span>`); }
    const metaHtml=meta.length?`<div style="font-family:var(--mono);font-size:10px;margin-top:3px;display:flex;flex-wrap:wrap;gap:8px">${meta.join('')}</div>`:'';
    const note=(t.note&&t.note!=='ClickUp'&&t.note.indexOf('ClickUp')!==0)?`<div style="font-size:11px;color:var(--text3);margin-top:2px">${esc(t.note)}</div>`:'';
    const todIcon=t.tod&&todEmoji[t.tod]?`<span style="font-size:13px;margin-right:5px">${todEmoji[t.tod]}</span>`:'';
    const bc=over?'rgba(255,69,58,.35)':todLate?'rgba(255,69,58,.3)':'var(--glass-border)';
    const bg=over?'rgba(255,69,58,.06)':'var(--glass)';
    return `<div data-tid="${t.id}" draggable="true" ondragstart="_startDrag(this,event)" ondragend="_endDrag(this)" ondragover="_dragOver(this,event)" ondragleave="_dragLeave(this)" ondrop="_drop(this,event)" style="display:flex;align-items:flex-start;gap:10px;padding:11px 13px;border:1px solid ${bc};border-radius:16px;margin-bottom:7px;background:${bg}">
      <div style="cursor:grab;color:var(--text3);font-size:13px;line-height:1.5;user-select:none" title="Перетащить">⠿</div>
      <div onclick="toggleDayTask('${t.id}');render()" style="width:18px;height:18px;border-radius:9px;border:2px solid ${over?'rgba(255,69,58,.6)':'rgba(255,255,255,.25)'};margin-top:1px;flex-shrink:0;cursor:pointer;background:rgba(255,255,255,.06)"></div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;flex-wrap:wrap">${prioFlag(t.prio)}${todIcon}<span class="task-text" ondblclick="event.stopPropagation();_editTask('${t.id}')" style="font-size:13px;font-weight:600;cursor:pointer;${over?'color:var(--red)':''}" title="Двойной клик — редактировать">${esc(t.text)}</span>${clientBadge}</div>
        ${metaHtml}${note}
      </div>
      <input type="date" value="${t.startIso}" onclick="event.stopPropagation()" onchange="moveTask('${t.id}',this.value)" title="Перенести на другой день" style="color-scheme:dark;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:9px;color:var(--text3);font-size:10px;padding:3px 5px;cursor:pointer;outline:none">
      <button onclick="event.stopPropagation();_editTask('${t.id}')" title="Редактировать" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:13px;padding:2px 3px">✎</button>
      <button onclick="event.stopPropagation();removeDayTask('${t.id}');render()" title="Удалить" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:13px;padding:2px 3px">✕</button>
    </div>`;
  }
  // «Все» shows time-based groups; «С дедлайном» is a cross-cutting lens (its tab)
  const GROUPS=[
    {arr:G.overdue, title:'⚠ Просрочено',   col:'var(--red)'},
    {arr:G.today,   title:'📌 Сегодня',      col:'var(--green)'},
    {arr:G.next,    title:'→ Следующие дни', col:'var(--blue)'},
  ];

  if(todayFilter==='all'){
    GROUPS.forEach(g=>{ if(g.arr.length) html+=`<div style="font-family:var(--mono);font-size:10px;color:${g.col};letter-spacing:.08em;text-transform:uppercase;margin:16px 0 8px">${g.title} — ${g.arr.length}</div>`+g.arr.map(taskRow).join(''); });
  } else {
    const arr = todayFilter==='deadline' ? withDeadline : G[todayFilter];
    if(!arr || !arr.length) html+=`<div class="empty" style="padding:40px 20px"><span class="empty-icon">—</span>Здесь пусто.</div>`;
    else arr.forEach(t=>{ html+=taskRow(t); });
  }

  // ── done today (only in the «Все» view) ──
  if(todayFilter==='all' && done.length){
    html+=`<div style="margin-top:18px;padding-top:14px;border-top:1px solid var(--glass-border)"><div style="font-family:var(--mono);font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">✓ Готово сегодня — ${done.length}</div>`;
    done.forEach(t=>{
      const _cl2=t.clientName?clients.find(c=>c.name===t.clientName||c.id===t.cid):null;
      const cb=t.clientName?`<span style="font-family:var(--mono);font-size:11px;padding:2px 8px;border-radius:14px;background:rgba(255,255,255,.07);color:var(--text3);margin-left:8px">${esc(t.clientName)}</span>`:'';
      html+=`<div style="display:flex;align-items:center;gap:10px;padding:9px 13px;border:1px solid var(--glass-border);border-radius:16px;margin-bottom:6px;background:var(--glass);opacity:.5">
        <div onclick="toggleDayTask('${t.id}');render()" style="width:18px;height:18px;border-radius:9px;border:1px solid var(--green);background:var(--green-dim);display:flex;align-items:center;justify-content:center;flex-shrink:0;cursor:pointer"><span style="color:var(--green);font-size:10px">✓</span></div>
        <div style="flex:1;display:flex;align-items:center;flex-wrap:wrap"><span style="font-size:13px;text-decoration:line-through;color:var(--text3)">${esc(t.text)}</span>${cb}</div>
        <button onclick="event.stopPropagation();removeDayTask('${t.id}');render()" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:13px;padding:2px 3px">✕</button>
      </div>`;
    });
    html+=`</div>`;
  }
  return html;
}

function renderToday(){
  const iso=isoToday();
  const ac=clients.filter(c=>c.active&&!c.paused).sort((a,b)=>a.name.localeCompare(b.name,'ru'));
  function isDone(c){return !!load('dc_manual_done',{})[c.id];}
  const pending=ac.filter(c=>!isDone(c));const done=ac.filter(c=>isDone(c));
  const pct=ac.length?Math.round(done.length/ac.length*100):0;
  let html=`<div class="section-header"><h2>Рассылки</h2><span class="badge badge-done">${done.length}/${ac.length}</span></div><div class="progress-wrap"><div class="progress-bar" style="width:${pct}%"></div></div>`;
  if(!ac.length)return html+`<div class="empty"><span class="empty-icon">—</span>Нет клиентов.</div>`;
  function row(c,isDoneItem){
    const ld=lastDoneInfo(c);
    const checkBg=isDoneItem?'rgba(var(--accent-rgb),.25)':'rgba(255,255,255,.07)';
    const checkBorder=isDoneItem?'rgba(48,209,88,.6)':'rgba(255,255,255,.2)';
    const rowBorder=isDoneItem?'rgba(var(--accent-rgb),.2)':'rgba(255,255,255,.1)';
    const rowBg=isDoneItem?'rgba(48,209,88,.05)':'rgba(255,255,255,.04)';
    return `<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid ${rowBorder};border-radius:18px;margin-bottom:6px;background:${rowBg};backdrop-filter:blur(12px);${isDoneItem?'opacity:.55;':''}transition:all .2s;">
      <div style="width:26px;height:26px;border-radius:18px;border:2px solid ${checkBorder};background:${checkBg};display:flex;align-items:center;justify-content:center;flex-shrink:0;cursor:pointer;transition:all .2s;" onclick="${isDoneItem?`undoDoneToday('${c.id}')`:`markDoneToday('${c.id}')`}">${isDoneItem?'<span style="color:var(--green);font-size:14px;font-weight:700;line-height:1">✓</span>':''}</div>
      <div style="flex:1;cursor:pointer;min-width:0" onclick="openCal('${c.id}')">
        <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--text)">${esc(c.name)}${deadlineBadge(c,true)}</div>
        <div style="font-family:var(--mono);font-size:10px;color:var(--text3);margin-top:2px">${ld.text} · ${clientSentCount(c)} отпр.</div>
      </div>
      <div style="cursor:pointer;flex-shrink:0;opacity:.6;transition:opacity .15s" onclick="openCal('${c.id}')" title="Открыть календарь" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=.6"><span style="font-size:18px">📅</span></div>
    </div>`;
  }
  pending.forEach(c=>{html+=row(c,false);});
  if(done.length){
    html+=`<div style="margin-top:16px;padding-top:12px;border-top:1px solid rgba(255,255,255,.08)"><div style="font-family:var(--mono);font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">Готово — ${done.length}</div>`;
    done.forEach(c=>{html+=row(c,true);});
    html+=`</div>`;
  }
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
function renderHistory(){
  const mk = activeMonth;                       // 'YYYY-MM'
  const parts = mk.split('-'); const yy=+parts[0], mm=+parts[1];
  const monthName = (typeof MONTHS_RU!=='undefined'?MONTHS_RU[mm-1]:mk)+' '+yy;
  const smsAll = load('dc_sms_days',{});
  const disAll = load('dc_pay_disabled',{});

  const valFor=(nm,tIso,st)=>{ if(st!=='yes'&&st!=='draft')return 0; const c=clients.find(x=>x.name===nm); if(!c)return EMAIL_RATE; if((disAll[c.id]||{})[tIso])return 0; return (smsAll[c.id]||{})[tIso]?SMS_DAY_RATE:EMAIL_RATE; };

  // group action-log entries by action-day (this month); collapse to final status per client|target
  const actLog = gload('dc_actlog',[]);
  const _pausedN = _pausedClientNames();
  const rawByDay = {};
  actLog.forEach(e=>{ if(!e.w || e.w.slice(0,7)!==mk) return; if(e.c && _pausedN[String(e.c).toLowerCase()]) return; (rawByDay[e.w]=rawByDay[e.w]||[]).push(e); });
  const dayMap = {};
  Object.keys(rawByDay).forEach(w=>{
    const ents = rawByDay[w].slice().sort((a,b)=>(a.t||0)-(b.t||0));
    const finalMap={}; ents.forEach(e=>{ finalMap[e.c+'|'+e.d]=e; });
    const rows = Object.values(finalMap).filter(e=>e.s==='yes'||e.s==='draft'||e.s==='no');
    if(!rows.length) return;
    let earned=0; rows.forEach(e=>earned+=valFor(e.c,e.d,e.s));
    dayMap[w] = { rows, earned };
  });
  const days = Object.keys(dayMap).sort((a,b)=>b.localeCompare(a));   // newest first

  const pluralM=n=>{const a=n%10,b=n%100;return (a===1&&b!==11)?'отметка':(a>=2&&a<=4&&(b<10||b>=20))?'отметки':'отметок';};

  let html = `<div class="section-header" style="margin-bottom:12px"><h2>История 📅</h2><span style="font-family:var(--mono);font-size:11px;color:var(--text3)">${monthName} · листай месяцы внизу ↓</span></div>`;

  if(!days.length){
    html += `<div class="empty"><span class="empty-icon">—</span>В этом месяце ты пока ничего не отмечал.<br>Отмечай статусы в календаре клиента — здесь появится история по дням.</div>`;
    return html;
  }

  // month totals
  let totalMarks=0, totalEarned=0;
  days.forEach(w=>{ totalMarks+=dayMap[w].rows.length; totalEarned+=dayMap[w].earned; });

  // selected day (default = newest)
  let selDay = historySelectedDate;
  if(!selDay || !dayMap[selDay]) selDay = days[0];

  html += `<div class="earn-card" style="background:linear-gradient(135deg,rgba(var(--accent-rgb),.1),rgba(48,209,88,.05));border:1px solid rgba(var(--accent-rgb),.2);border-radius:22px;padding:18px 22px;margin-bottom:16px;display:flex;gap:28px;align-items:center;flex-wrap:wrap">
    <div><div style="font-size:11px;color:var(--text3);font-family:var(--mono);letter-spacing:.06em;text-transform:uppercase;margin-bottom:4px">Отмечено</div><div style="font-size:30px;font-weight:700;color:var(--text);line-height:1">${totalMarks}</div></div>
    <div style="width:1px;height:40px;background:rgba(255,255,255,.1)"></div>
    <div><div style="font-size:11px;color:var(--text3);font-family:var(--mono);letter-spacing:.06em;text-transform:uppercase;margin-bottom:4px">Заработано</div><div style="font-size:30px;font-weight:700;color:var(--green);line-height:1">$${totalEarned.toFixed(2)}</div></div>
    <div style="width:1px;height:40px;background:rgba(255,255,255,.1)"></div>
    <div><div style="font-size:11px;color:var(--text3);font-family:var(--mono);letter-spacing:.06em;text-transform:uppercase;margin-bottom:4px">Активных дней</div><div style="font-size:30px;font-weight:700;color:var(--text);line-height:1">${days.length}</div></div>
  </div>`;

  // ── left: list of dates ──
  let dateRows='';
  days.forEach(w=>{
    const D=dayMap[w]; const dt=new Date(w+'T00:00:00'); const isT=w===isoToday(); const isSel=w===selDay;
    dateRows+=`<div onclick="_sfx.play('click');historySelectedDate='${w}';render()" style="display:flex;align-items:center;gap:10px;padding:11px 14px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,.05);transition:background .15s;background:${isSel?'rgba(var(--accent-rgb),.1)':'none'}">
      <div style="flex:1;overflow:hidden">
        <div style="font-size:13px;font-weight:${isSel?600:500};color:${isSel?'var(--green)':isT?'var(--accent)':'var(--text)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${dt.getDate()} ${MONTHS_RU[mm-1]} · ${DAYS_RU[dt.getDay()]}${isT?' · сегодня':''}</div>
        <div style="font-family:var(--mono);font-size:10px;color:var(--text3);margin-top:2px">${D.rows.length} ${pluralM(D.rows.length)}</div>
      </div>
      <div style="font-family:var(--mono);font-size:12px;color:${D.earned>0?'var(--green)':'var(--text3)'};font-weight:600;flex-shrink:0">$${D.earned.toFixed(2)}</div>
    </div>`;
  });

  const detailHtml = renderHistoryDay(selDay, dayMap[selDay], valFor, smsAll, mm);

  // Mobile: show the selected day full-width with a back button (like Finance).
  const _mob = typeof window!=='undefined' && window.matchMedia && window.matchMedia('(max-width:720px)').matches;
  if(_mob && historySelectedDate && dayMap[historySelectedDate]){
    const dt=new Date(historySelectedDate+'T00:00:00');
    return `<div style="max-width:860px">
      <div class="section-header" style="margin-bottom:14px;align-items:center;gap:10px">
        <button class="toggle-btn" style="font-size:12px;padding:5px 12px" onclick="historySelectedDate=null;render()">← Даты</button>
        <h2 style="font-size:18px;margin:0">${dt.getDate()} ${MONTHS_RU[mm-1]} · ${DAYS_RU[dt.getDay()]}</h2>
      </div>
      <div style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:16px">${detailHtml}</div>
    </div>`;
  }

  html += `<div style="display:grid;grid-template-columns:260px 1fr;gap:12px;align-items:start">
    <div style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:20px;overflow:hidden;max-height:70vh;overflow-y:auto">${dateRows}</div>
    <div style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:16px;min-height:200px">${detailHtml}</div>
  </div>`;
  return html;
}

// Detail for one action-day: everything done that day, one row per marking
// (client · status · target date if it differs · $).
function renderHistoryDay(w, D, valFor, smsAll, mm){
  if(!w || !D) return '<div style="color:var(--text3);font-size:13px;padding:24px;text-align:center;font-family:var(--mono)">← выбери дату</div>';
  const ST={yes:{lbl:'отправлено',col:'#34d399'},draft:{lbl:'черновик',col:'#a78bfa'},no:{lbl:'не отправлено',col:'#f87171'}};
  const dt=new Date(w+'T00:00:00');
  const smsFor=(nm,tIso)=>{ const c=clients.find(x=>x.name===nm); return c?!!((smsAll[c.id]||{})[tIso]):false; };
  // one block per client → the list of dates I set for that client, as coloured chips
  const byClient={}; D.rows.forEach(e=>{ (byClient[e.c]=byClient[e.c]||[]).push(e); });
  let html=`<div style="margin-bottom:12px">
    <div style="font-family:var(--mono);font-size:12px;color:var(--text2)">${dt.getDate()} ${MONTHS_RU[mm-1]} ${dt.getFullYear()} · ${DAYS_RU[dt.getDay()]}${w===isoToday()?' · сегодня':''} · всего <span style="color:var(--green)">$${D.earned.toFixed(2)}</span></div>
    <div style="display:flex;gap:10px;margin-top:6px;font-family:var(--mono);font-size:10px"><span style="color:#34d399">● отправлено</span><span style="color:#a78bfa">● черновик</span><span style="color:#f87171">● не отправлено</span></div>
  </div>`;
  Object.keys(byClient).sort((a,b)=>a.localeCompare(b,'ru')).forEach(cn=>{
    const list=byClient[cn].sort((a,b)=>a.d.localeCompare(b.d));
    let sum=0; list.forEach(e=>sum+=valFor(e.c,e.d,e.s));
    const chips=list.map(e=>{
      const s=ST[e.s]||{lbl:e.s,col:'#9aa0aa'}; const td=new Date(e.d+'T00:00:00');
      const lbl=td.getDate()+'.'+String(td.getMonth()+1).padStart(2,'0');
      return `<span title="${lbl} · ${s.lbl}" style="font-family:var(--mono);font-size:11px;padding:2px 8px;border-radius:9px;background:${s.col}22;color:${s.col};white-space:nowrap">${lbl}${smsFor(e.c,e.d)?' 📱':''}</span>`;
    }).join('');
    html+=`<div style="padding:10px 12px;border-radius:14px;margin-bottom:6px;background:rgba(255,255,255,.06)">
      <div style="display:flex;align-items:center;gap:9px;margin-bottom:7px">
        <span style="flex:1;min-width:0;font-size:13px;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(cn)}</span>
        <span style="font-family:var(--mono);font-size:10px;color:var(--text3)">${list.length} ${list.length===1?'дата':(list.length>=2&&list.length<=4?'даты':'дат')}</span>
        <span style="font-family:var(--mono);font-size:11px;color:${sum>0?'var(--green)':'var(--text3)'};font-weight:600">$${sum.toFixed(2)}</span>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:5px">${chips}</div>
    </div>`;
  });
  return html;
}

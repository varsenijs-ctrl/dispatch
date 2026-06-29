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
  const was=smsDays[cid][iso]||false;
  if(was)delete smsDays[cid][iso];else smsDays[cid][iso]=true;
  save('dc_sms_days',smsDays);
  renderCalModal(cid);updateSidebar();
}

// ── Home ─────────────────────────────────────────────────────
function renderHome(){
  const iso=isoToday();const mk=monthKey(getTODAY());
  const ac=clients.filter(c=>c.active);
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
  const todayTasks=Object.values(_tasks).filter(t=>t.startIso===_iso);
  const todayTasksCount=todayTasks.length;const todayTasksDone=todayTasks.filter(t=>t.done).length;
  const _smsDays=load('dc_sms_days',{});const _dis=load('dc_pay_disabled',{});
  // Same source of truth as the Finance tab, so both earnings blocks agree.
  const _T=computeFinanceTotals('month');
  const earnedAmt=_T.earned, potentialAmt=_T.potential, earnedCount=_T.sentCount, potentialCount=_T.totalCount;
  const flowEarnedAmt=0; // flows are already folded into earnedAmt
  const earnedUSD=earnedAmt.toFixed(2);const potentialUSD=potentialAmt.toFixed(2);
  const earnPct=potentialAmt?Math.round(earnedAmt/potentialAmt*100):0;
  const leftAmt=(potentialAmt-earnedAmt).toFixed(2);
  const overdueHome=Object.values(_tasks).filter(_overdue).length;
  const upcomingTasks=Object.values(_tasks).filter(t=>{if(t.done)return false;const d=new Date(t.startIso+'T00:00:00');const diff=Math.ceil((d-new Date(getTODAY().toDateString()))/86400000);return diff>=0&&diff<=6;}).sort((a,b)=>a.startIso.localeCompare(b.startIso)).slice(0,6);
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
      <div><div style="font-size:11px;color:var(--text3);font-family:var(--mono);letter-spacing:.06em;text-transform:uppercase;margin-bottom:6px">Заработано в ${MONTHS_SHORT[getTODAY().getMonth()]}</div><div style="font-size:32px;font-weight:700;letter-spacing:-.02em;color:var(--green);line-height:1">$${earnedUSD}</div><div style="font-size:11px;color:var(--text3);font-family:var(--mono);margin-top:4px">${earnedCount} рассылок${flowEarnedAmt>0?' + $'+flowEarnedAmt.toFixed(2)+' флоу':''}</div></div>
      <div style="width:1px;height:48px;background:rgba(255,255,255,.1);flex-shrink:0"></div>
      <div><div style="font-size:11px;color:var(--text3);font-family:var(--mono);letter-spacing:.06em;text-transform:uppercase;margin-bottom:6px">Максимум за месяц</div><div style="font-size:32px;font-weight:700;letter-spacing:-.02em;color:var(--text);line-height:1">$${potentialUSD}</div><div style="font-size:11px;color:var(--text3);font-family:var(--mono);margin-top:4px">${potentialCount} всего записей</div></div>
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
    var cur = t.cid || '';
    if(!cur && t.clientName){ var byName=clients.find(function(c){return c.name===t.clientName;}); if(byName) cur=byName.id; }
    var list = clients.slice().sort(function(a,b){return a.name.localeCompare(b.name,'ru');});
    var html = '<option value="">— без клиента —</option>' +
      list.map(function(c){return '<option value="'+c.id+'"'+(c.id===cur?' selected':'')+'>'+esc(c.name)+(c.active===false?' (пауза)':'')+'</option>';}).join('');
    // keep the task's own client selectable even if it's no longer in the list
    if(cur && !list.some(function(c){return c.id===cur;})){
      html += '<option value="'+esc(cur)+'" selected>'+esc(t.clientName||cur)+'</option>';
    }
    etCl.innerHTML = html;
    etCl.value = cur;
  }
  // Set tod buttons
  document.querySelectorAll('#edit-task-modal .tod-btn').forEach(function(b){
    b.classList.toggle('active', b.dataset.tod===(t.tod||''));
  });
  var modal = document.getElementById('edit-task-modal');
  modal.style.display='flex';
  _sfx.play('open');
  setTimeout(function(){document.getElementById('et-text').focus();},100);
}
function _etSetTod(btn){
  var wasActive = btn.classList.contains('active');
  document.querySelectorAll('#edit-task-modal .tod-btn').forEach(function(b){b.classList.remove('active');});
  if(!wasActive) btn.classList.add('active');
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
  var activeTod = document.querySelector('#edit-task-modal .tod-btn.active');
  t.tod = activeTod ? activeTod.dataset.tod : '';
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
    var newCid = etCl.value||'';
    t.cid = newCid;
    t.clientName = newCid ? ((clients.find(function(c){return c.id===newCid;})||{}).name||'') : '';
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

function renderDayToday(){
  const iso=isoToday();
  const tasks=load('dc_plantasks',{});
  const todayTasks=Object.values(tasks).filter(t=>t.startIso===iso);
  // carry a past-day task into today if it's still within its «до» window OR has an
  // upcoming deadline (deadline not passed) — a gentle reminder so it isn't forgotten
  const ongoing=Object.values(tasks).filter(t=>t.startIso<iso&&!t.done&&((t.until&&t.until>=iso)||(t.deadline&&t.deadline>=iso)));
  const d=getTODAY();
  let html=`<div class="section-header"><h2>Сегодня — ${fmtDate(d)}, ${DAYS_RU[d.getDay()]}</h2><button class="toggle-btn" style="font-size:10px;padding:3px 10px" onclick="openDayModal('${iso}')">+ задача</button></div>`;
  const _due=t=>t.deadline?t.deadline:t.startIso;
  const overdueTasks = Object.values(tasks).filter(_overdue)
    .sort((a,b)=>_due(a).localeCompare(_due(b)));

  const overdudeIds=new Set(overdueTasks.map(t=>t.id));
const allTasks=[...todayTasks,...ongoing.filter(t=>!todayTasks.find(x=>x.id===t.id))].filter(t=>!overdudeIds.has(t.id));

  if(overdueTasks.length){
    html+=`<div style="background:rgba(255,69,58,.08);border:1px solid rgba(255,69,58,.25);border-radius:18px;padding:12px 14px;margin-bottom:14px">
      <div style="font-family:var(--mono);font-size:10px;color:var(--red);letter-spacing:.08em;text-transform:uppercase;margin-bottom:10px">⚠ Просроченные задачи — ${overdueTasks.length}</div>`;
    const _todEmoji={morning:'🌅',day:'☀️',evening:'🌇',night:'🌙'};
    overdueTasks.forEach(t=>{
      const dt=new Date(t.startIso+'T00:00:00');
      const dueIso=t.deadline?t.deadline:t.startIso;
      const daysAgo=Math.floor((new Date(getTODAY().toDateString())-new Date(dueIso+'T00:00:00'))/86400000);
      const _cl=t.cid?clients.find(c=>c.id===t.cid):t.clientName?clients.find(c=>c.name===t.clientName):null;
      const clientBadge=_cl?`<span style="font-family:var(--mono);font-size:10px;padding:2px 7px;border-radius:14px;background:var(--blue-dim);color:var(--blue);margin-left:6px;cursor:pointer" onclick="event.stopPropagation();openCal('${_cl.id}')">${esc(_cl.name)}</span>`:'';
      // срок: planned date + time-of-day + time window + deadline
      let srok=`<span style="color:var(--amber)">${fmtDate(dt)} ${DAYS_RU[dt.getDay()]}</span>`;
      if(t.tod&&_todEmoji[t.tod]) srok+=` ${_todEmoji[t.tod]}`;
      if(t.timeFrom||t.timeTo) srok+=` ${t.timeFrom||''}${t.timeTo?'–'+t.timeTo:''}`;
      if(t.until&&t.until!==t.startIso) srok+=` · до ${fmtDate(new Date(t.until+'T00:00:00'))}`;
      if(t.deadline) srok+=` · <span style="color:var(--red)">⏳ дедлайн ${fmtDate(new Date(t.deadline+'T00:00:00'))}</span>`;
      html+=`<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,69,58,.1)">
        <div style="width:16px;height:16px;border-radius:10px;border:1px solid rgba(255,69,58,.4);background:none;flex-shrink:0;cursor:pointer" onclick="toggleDayTask('${t.id}');render()"></div>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:500;cursor:pointer" ondblclick="event.stopPropagation();_editTask('${t.id}')" title="Двойной клик — редактировать">${esc(t.text)}${clientBadge}</div>
          <div style="font-family:var(--mono);font-size:10px;color:var(--text3);margin-top:2px">${srok}</div>
        </div>
        <div style="font-family:var(--mono);font-size:10px;color:var(--red);white-space:nowrap">${daysAgo}д назад</div>
        <input type="date" value="${t.startIso}" onchange="moveTask('${t.id}',this.value)" title="Перенести на другой день" style="color-scheme:dark;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:10px;color:var(--text3);font-size:10px;padding:3px 6px;cursor:pointer;outline:none">
        <button onclick="event.stopPropagation();_editTask('${t.id}')" title="Редактировать" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:13px;padding:2px 4px">✎</button>
        <button onclick="removeDayTask('${t.id}')" title="Удалить" style="background:none;border:none;color:rgba(255,69,58,.5);cursor:pointer;font-size:13px;padding:2px 4px">✕</button>
      </div>`;
    });
    html+=`</div>`;
  }

  if(!allTasks.length && !overdueTasks.length){html+=`<div class="empty"><span class="empty-icon">—</span>Задач на сегодня нет.<br>Нажми «+ задача» чтобы добавить.</div>`;return html;}
  const pending=allTasks.filter(t=>!t.done).sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0));
  const done=allTasks.filter(t=>t.done&&(t.doneDate===iso||t.startIso===iso));
  const pendToday   = pending.filter(t=>t.startIso===iso);              // planned for today
  const pendCarried = pending.filter(t=>t.startIso<iso);                // carried from earlier days (kept by an upcoming deadline)
  function pendRow(t){
    const todLate=!t.done&&(t.tod||t.timeFrom)&&isTodOverdue(t.tod,t.timeFrom,t.startIso);
    const until=t.until&&t.until!==iso?`<span style="font-family:var(--mono);font-size:10px;color:var(--amber)"> · до ${fmtDate(new Date(t.until+'T00:00:00'))}</span>`:'';
    const dlChip=t.deadline?`<span style="font-family:var(--mono);font-size:10px;color:var(--amber)"> · ⏳ ${fmtDate(new Date(t.deadline+'T00:00:00'))}</span>`:'';
    const fromMark=t.startIso<iso?`<span style="font-family:var(--mono);font-size:10px;color:var(--text3)"> · ⤷ с ${fmtDate(new Date(t.startIso+'T00:00:00'))}</span>`:'';
    const note=t.note?`<div style="font-size:11px;color:var(--text3);margin-top:3px">${esc(t.note)}</div>`:'';
    const _cl=t.cid?clients.find(c=>c.id===t.cid):t.clientName?clients.find(c=>c.name===t.clientName||c.name.toLowerCase().includes(t.clientName.toLowerCase())||t.clientName.toLowerCase().includes(c.name.toLowerCase())):null;
    const clientBadge=_cl?`<span style="font-family:var(--mono);font-size:11px;padding:2px 8px;border-radius:16px;background:var(--blue-dim);color:var(--blue);margin-left:8px;white-space:nowrap;cursor:pointer;border:1px solid rgba(96,165,250,.2)" onclick="event.stopPropagation();openCal('${_cl.id}')">${esc(t.clientName)}</span>`:t.clientName?`<span style="font-family:var(--mono);font-size:11px;padding:2px 8px;border-radius:16px;background:var(--blue-dim);color:var(--blue);margin-left:8px">${esc(t.clientName)}</span>`:'';
    const _calOnclick = _cl ? `openCal('${_cl.id}')` : '';
    return `<div data-tid="${t.id}" draggable="true" ondragstart="_startDrag(this,event)" ondragend="_endDrag(this)" ondragover="_dragOver(this,event)" ondragleave="_dragLeave(this)" ondrop="_drop(this,event)" style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border:1px solid ${todLate?'rgba(255,69,58,.4)':`var(--glass-border)`};border-radius:18px;margin-bottom:6px;background:${todLate?'rgba(255,69,58,.06)':`var(--glass)`};backdrop-filter:blur(12px);cursor:pointer" onclick="${_calOnclick||`toggleDayTask('${t.id}');render()`}">
      <div style="display:flex;flex-direction:column;justify-content:center;padding:2px 0;cursor:grab;color:var(--text3);font-size:14px;line-height:1;user-select:none" title="Перетащить">⠿</div>
      <div style="width:18px;height:18px;border-radius:10px;border:2px solid rgba(255,255,255,.25);margin-top:2px;flex-shrink:0;cursor:pointer;background:rgba(255,255,255,.07)" onclick="event.stopPropagation();toggleDayTask('${t.id}');render()"></div>
      <div style="flex:1"><div style="display:flex;align-items:center;flex-wrap:wrap;gap:0">${(t.timeFrom||t.timeTo)?`<span style="font-family:var(--mono);font-size:10px;color:var(--accent);margin-right:5px;white-space:nowrap">${t.timeFrom||""}${t.timeTo?"–"+t.timeTo:""}</span>`:""}${t.tod?('<span style="font-size:14px;margin-right:4px">'+(t.tod==="morning"?"🌅":t.tod==="day"?"☀️":t.tod==="evening"?"🌇":t.tod==="night"?"🌙":"")+"</span>"):"" }<span class="task-text" ondblclick="event.stopPropagation();_editTask('${t.id}')" style="font-size:13px;font-weight:500;cursor:pointer" title="Двойной клик — редактировать">${esc(t.text)}</span>${clientBadge}${until}${dlChip}${fromMark}</div>${note}</div>
      <button onclick="event.stopPropagation();_editTask('${t.id}')" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:13px;padding:0 3px" title="Редактировать">✎</button>
      <button onclick="event.stopPropagation();removeDayTask('${t.id}');render()" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:13px;padding:2px 4px">✕</button>
    </div>`;
  }
  // today's own tasks (label only needed when a carried-deadline block follows)
  if(pendToday.length){
    if(pendCarried.length) html+=`<div style="font-family:var(--mono);font-size:10px;color:var(--text3);letter-spacing:.08em;text-transform:uppercase;margin:2px 0 10px">📌 На сегодня — ${pendToday.length}</div>`;
    pendToday.forEach(t=>{ html+=pendRow(t); });
  }
  // separate block: tasks with a deadline carried over from previous days
  if(pendCarried.length){
    html+=`<div style="background:rgba(251,191,36,.06);border:1px solid rgba(251,191,36,.22);border-radius:18px;padding:12px 14px;margin:14px 0 6px">
      <div style="font-family:var(--mono);font-size:10px;color:var(--amber);letter-spacing:.08em;text-transform:uppercase;margin-bottom:10px">⏳ С дедлайном · с прошлых дней — ${pendCarried.length}</div>`;
    pendCarried.forEach(t=>{ html+=pendRow(t); });
    html+=`</div>`;
  }
  if(done.length){
    html+=`<div style="margin-top:16px;padding-top:12px;border-top:1px solid rgba(255,255,255,.06)"><div style="font-family:var(--mono);font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">Готово ${done.length}</div>`;
    done.forEach(t=>{
      const _cl2=t.clientName?clients.find(c=>c.name===t.clientName||c.id===t.cid):null;
      const clientBadge=_cl2?`<span style="font-family:var(--mono);font-size:11px;padding:2px 8px;border-radius:16px;background:rgba(255,255,255,.07);color:var(--text3);margin-left:8px;cursor:pointer" onclick="event.stopPropagation();openCal('${_cl2.id}')">${esc(t.clientName)}</span>`:t.clientName?`<span style="font-family:var(--mono);font-size:11px;padding:2px 8px;border-radius:16px;background:rgba(255,255,255,.07);color:var(--text3);margin-left:8px">${esc(t.clientName)}</span>`:'';
      html+=`<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;border:1px solid rgba(255,255,255,.06);border-radius:18px;margin-bottom:5px;background:var(--glass);opacity:.4;cursor:pointer" onclick="toggleDayTask('${t.id}');render()">
        <div style="width:18px;height:18px;border-radius:10px;border:1px solid var(--green);background:var(--green-dim);display:flex;align-items:center;justify-content:center;flex-shrink:0"><span style="color:var(--green);font-size:10px">✓</span></div>
        <div style="flex:1;display:flex;align-items:center;flex-wrap:wrap"><span style="font-size:13px;text-decoration:line-through;color:var(--text3)">${esc(t.text)}</span>${clientBadge}</div>
        <button onclick="event.stopPropagation();_editTask('${t.id}')" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:13px;padding:0 3px" title="Редактировать">✎</button>
      <button onclick="event.stopPropagation();removeDayTask('${t.id}');render()" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:13px;padding:2px 4px">✕</button>
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

function setLog(clientName, iso, val){
  if(!historyData[clientName]) historyData[clientName]={};
  if(historyData[clientName][iso]===val) delete historyData[clientName][iso];
  else historyData[clientName][iso]=val;
  saveAll();
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

// ── History: real day-by-day activity feed for the ACTIVE month ──
// (switch months with the bottom month bar). Aggregates emails, SMS, flows,
// completed tasks and invoices into one timeline + summary + heatmap.
function renderHistory(){
  const mk = activeMonth;                       // 'YYYY-MM'
  const parts = mk.split('-'); const yy=+parts[0], mm=+parts[1];
  const daysInMonth = new Date(yy, mm, 0).getDate();
  const monthName = (typeof MONTHS_RU!=='undefined'?MONTHS_RU[mm-1]:mk)+' '+yy;
  const ac = clients.filter(c=>c.active).sort((a,b)=>a.name.localeCompare(b.name,'ru'));
  const sel = historySelectedClient;
  const smsAll = load('dc_sms_days',{});
  const disAll = load('dc_pay_disabled',{});
  const tasks  = load('dc_plantasks',{});
  const invoices = load('dc_invoices',[]);

  // ── aggregate per-day activity ──
  const dayMap = {};
  const blank = ()=>({sent:[],draft:[],sms:[],flows:[],tasks:[],inv:0,earned:0});
  const day = iso => (dayMap[iso] || (dayMap[iso]=blank()));

  ac.forEach(c=>{
    if(sel && c.id!==sel) return;
    const hist=historyData[c.name]||{}, cidSms=smsAll[c.id]||{}, cidDis=disAll[c.id]||{};
    Object.keys(hist).forEach(iso=>{
      if(iso.slice(0,7)!==mk) return;
      const v=hist[iso];
      if(v!=='yes' && v!=='draft') return;
      const D=day(iso);
      (v==='yes'?D.sent:D.draft).push(c.name);
      if(cidSms[iso]) D.sms.push(c.name);
      if(!cidDis[iso]) D.earned += (cidSms[iso]?1.00:0.50);
    });
  });
  Object.values(tasks).forEach(t=>{
    if(!t.done) return;
    if(sel && t.cid!==sel) return;
    const iso = t.doneDate || t.startIso;
    if(!iso || iso.slice(0,7)!==mk) return;
    if(t.flowId){
      const flow = t.cid?getFlows(t.cid).find(f=>f.id===t.flowId):null;
      const val = flow?flow.count*0.60:0;
      day(iso).flows.push({name:t.text||(flow&&flow.name)||'флоу', client:t.clientName||'', val});
      day(iso).earned += val;
    } else {
      day(iso).tasks.push({text:t.text||'задача', client:t.clientName||''});
    }
  });
  if(!sel){
    invoices.forEach(i=>{
      if(!i.date || i.date.slice(0,7)!==mk) return;
      const D=day(i.date); D.inv += i.count; D.earned += i.count*0.50;
    });
  }

  const isos = Object.keys(dayMap).sort((a,b)=>b.localeCompare(a));   // newest first
  // ── summary ──
  let totalSent=0,totalEarned=0,bestIso=null,bestEarned=0;
  isos.forEach(iso=>{const D=dayMap[iso];totalSent+=D.sent.length;totalEarned+=D.earned;if(D.earned>bestEarned){bestEarned=D.earned;bestIso=iso;}});
  // current streak of active days ending today (only when viewing the current month)
  let streak=0;
  if(mk===monthKey(getTODAY())){
    let d=new Date(getTODAY());
    while(dayMap[toISO(d)]){ streak++; d.setDate(d.getDate()-1); }
  }
  const stat=(label,val,color)=>`<div style="flex:1;min-width:120px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:12px 14px">
    <div style="font-family:var(--mono);font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--text3);margin-bottom:5px">${label}</div>
    <div style="font-size:20px;font-weight:700;color:${color||'var(--text)'};line-height:1">${val}</div></div>`;

  let html = `<div class="section-header" style="margin-bottom:12px"><h2>История</h2>
    <span style="font-family:var(--mono);font-size:12px;color:var(--text3)">${monthName} · листай месяцы внизу ↓</span></div>`;

  // client filter
  html += `<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:14px">
    <button onclick="historySelectedClient=null;render()" style="font-family:var(--mono);font-size:10px;padding:4px 11px;border-radius:16px;border:1px solid ${!sel?'var(--accent)':'rgba(255,255,255,.12)'};background:${!sel?'rgba(var(--accent-rgb),.12)':'none'};color:${!sel?'var(--green)':'var(--text3)'};cursor:pointer">Все</button>
    ${ac.map(c=>`<button onclick="historySelectedClient='${c.id}';render()" style="font-family:var(--mono);font-size:10px;padding:4px 11px;border-radius:16px;border:1px solid ${sel===c.id?'var(--accent)':'rgba(255,255,255,.12)'};background:${sel===c.id?'rgba(var(--accent-rgb),.12)':'none'};color:${sel===c.id?'var(--green)':'var(--text3)'};cursor:pointer;white-space:nowrap">${esc(c.name.slice(0,14))}</button>`).join('')}
  </div>`;

  if(!isos.length){
    html += `<div class="empty"><span class="empty-icon">—</span>${sel?'У этого клиента нет активности в этом месяце.':'В этом месяце пока ничего не отмечено.'}<br>Отмечай отправки в «Рассылках» — здесь появится история.</div>`;
    return html;
  }

  // summary tiles
  html += `<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">
    ${stat('Отправлено',totalSent,'var(--green)')}
    ${stat('Заработано','$'+totalEarned.toFixed(2),'var(--green)')}
    ${stat('Активных дней',isos.length,'var(--text)')}
    ${stat('Лучший день',bestIso?'$'+bestEarned.toFixed(2):'—','var(--accent)')}
    ${streak>1?stat('Серия 🔥',streak+' дн','var(--amber)'):''}
  </div>`;

  // ── activity heatmap (whole month) ──
  let heat='';
  for(let dn=1;dn<=daysInMonth;dn++){
    const iso=`${yy}-${String(mm).padStart(2,'0')}-${String(dn).padStart(2,'0')}`;
    const D=dayMap[iso];
    const isT=iso===isoToday();
    const intensity = D&&bestEarned>0 ? (0.22+0.68*Math.min(1,D.earned/bestEarned)) : 0;
    const bg = D ? `rgba(48,209,88,${intensity.toFixed(2)})` : 'rgba(255,255,255,.04)';
    const tip = D? `${fmtDate(new Date(iso+'T00:00:00'))}: ${D.sent.length}✉${D.earned?(' · $'+D.earned.toFixed(2)):''}` : `${fmtDate(new Date(iso+'T00:00:00'))}: нет активности`;
    heat += `<div title="${tip}" ${D?`onclick="document.getElementById('hd-${iso}')&&document.getElementById('hd-${iso}').scrollIntoView({behavior:'smooth',block:'center'})" style="cursor:pointer;`:'style="'}width:22px;height:22px;border-radius:6px;background:${bg};${isT?'box-shadow:0 0 0 2px var(--accent)':''};display:flex;align-items:center;justify-content:center;font-family:var(--mono);font-size:8px;color:${D&&intensity>0.5?'#04130a':'var(--text3)'}">${dn}</div>`;
  }
  html += `<div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:18px;padding:14px;margin-bottom:18px">
    <div style="font-family:var(--mono);font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--text3);margin-bottom:10px">Активность за ${monthName}</div>
    <div style="display:flex;flex-wrap:wrap;gap:5px">${heat}</div></div>`;

  // ── timeline (newest first) ──
  const chip=(txt,col)=>`<span style="font-family:var(--mono);font-size:10px;padding:2px 8px;border-radius:12px;background:${col}1f;color:${col};white-space:nowrap">${esc(txt)}</span>`;
  isos.forEach(iso=>{
    const D=dayMap[iso];
    const d=new Date(iso+'T00:00:00');
    const isT=iso===isoToday();
    let lines='';
    if(D.sent.length)  lines+=`<div style="margin-top:8px"><span style="color:var(--green);font-size:12px;font-weight:600">✓ Отправлено ${D.sent.length}</span><div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:5px">${D.sent.map(n=>chip(n,'rgba(52,211,153,1)')).join('')}</div></div>`;
    if(D.sms.length)   lines+=`<div style="margin-top:8px"><span style="color:var(--blue);font-size:12px;font-weight:600">📱 SMS ${D.sms.length}</span><div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:5px">${D.sms.map(n=>chip(n,'rgba(96,165,250,1)')).join('')}</div></div>`;
    if(D.flows.length) lines+=`<div style="margin-top:8px"><span style="color:var(--amber);font-size:12px;font-weight:600">⚡ Флоу ${D.flows.length}</span><div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:5px">${D.flows.map(f=>chip('⚡ '+f.name+(f.client?(' · '+f.client):''),'rgba(251,191,36,1)')).join('')}</div></div>`;
    if(D.draft.length) lines+=`<div style="margin-top:8px"><span style="color:var(--purple);font-size:12px;font-weight:600">~ Черновики ${D.draft.length}</span><div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:5px">${D.draft.map(n=>chip(n,'rgba(167,139,250,1)')).join('')}</div></div>`;
    if(D.tasks.length) lines+=`<div style="margin-top:8px"><span style="color:var(--text2);font-size:12px;font-weight:600">📋 Задачи ${D.tasks.length}</span><div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:5px">${D.tasks.map(t=>chip(t.text+(t.client?(' · '+t.client):''),'rgba(255,255,255,.5)')).join('')}</div></div>`;
    if(D.inv) lines+=`<div style="margin-top:8px"><span style="color:var(--green);font-size:12px;font-weight:600">🧾 Инвойсы: ${D.inv}</span></div>`;
    html += `<div id="hd-${iso}" style="background:${isT?'rgba(var(--accent-rgb),.06)':'var(--glass)'};border:1px solid ${isT?'rgba(var(--accent-rgb),.25)':'var(--glass-border)'};border-radius:18px;padding:14px 16px;margin-bottom:10px">
      <div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px;border-bottom:1px solid rgba(255,255,255,.07);padding-bottom:8px">
        <div style="font-weight:700;font-size:15px;color:${isT?'var(--accent)':'var(--text)'}">${d.getDate()} ${MONTHS_RU?MONTHS_RU[mm-1]:''} <span style="font-family:var(--mono);font-size:11px;color:var(--text3);font-weight:400">${DAYS_RU[d.getDay()]}${isT?' · сегодня':''}</span></div>
        <div style="font-family:var(--mono);font-size:14px;font-weight:700;color:${D.earned>0?'var(--green)':'var(--text3)'}">$${D.earned.toFixed(2)}</div>
      </div>${lines||'<div style="margin-top:8px;color:var(--text3);font-size:12px">—</div>'}
    </div>`;
  });
  return html;
}


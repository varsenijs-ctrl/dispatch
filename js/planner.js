// ── Планировщик — 3 колонки дней (по макету) + месяц ─────────
// Колонки: сегодня / завтра / послезавтра. Карточку можно перетащить в другую
// колонку — задача переедет на этот день. Ниже — месячный календарь (как был).
function _dropToDay(el,e,iso){
  e.preventDefault(); el.style.background='';
  if(_dragId){ const id=_dragId; _dragId=null; moveTask(id,iso); }
}
function _dayOverCol(el,e){ e.preventDefault(); el.style.background='rgba(64,203,224,.06)'; }
function _dayLeaveCol(el){ el.style.background=''; }
// ── Планировщик — 3 колонки дней, карточки ровно как в макете ──
// Карточка: ручка-грип, текст, чип приоритета + клиент. Кнопки (готово/правка/
// удалить) появляются по наведению, чтобы вид совпадал с макетом.
// Ниже — месячный календарь приложения (навигация + модалка дня).
function _dropToDay(el,e,iso){
  e.preventDefault(); el.style.background='';
  if(_dragId){ const id=_dragId; _dragId=null; moveTask(id,iso); }
}
function _dayOverCol(el,e){ e.preventDefault(); el.style.background='rgba(64,203,224,.06)'; }
function _dayLeaveCol(el){ el.style.background=''; }
function renderPlanner(){
  if(typeof plannerMonth==='undefined')window.plannerMonth=new Date(getTODAY().getFullYear(),getTODAY().getMonth(),1);
  const iso=isoToday();
  const tasks=load('dc_plantasks',{});
  // как в макете: ВЫСОКИЙ / СРЕДНИЙ / НИЗКИЙ
  const PRIO={4:['СРОЧНО','#ff8078','rgba(255,69,58,.16)'],3:['ВЫСОКИЙ','#ff8078','rgba(255,69,58,.16)'],
              2:['СРЕДНИЙ','#ffe066','rgba(255,214,10,.14)'],1:['НИЗКИЙ','rgba(255,255,255,.6)','rgba(255,255,255,.08)']};

  let cols='';
  for(let i=0;i<3;i++){
    const dt=new Date(getTODAY()); dt.setDate(dt.getDate()+i);
    const dIso=toISO(dt);
    const title=i===0?'Сегодня':i===1?'Завтра':(_DFULL[dt.getDay()].charAt(0).toUpperCase()+_DFULL[dt.getDay()].slice(1));
    const list=Object.values(tasks).filter(t=>{
      if(t.flowId||_isTaskClientPaused(t)) return false;
      if(t.startIso===dIso) return true;
      return !t.done&&t.startIso<dIso&&t.until&&t.until>=dIso;   // перенесённые с прошлых дней
    }).sort((a,b)=>(+b.prio||0)-(+a.prio||0)||((a.sortOrder==null?1e9:a.sortOrder)-(b.sortOrder==null?1e9:b.sortOrder)));
    let items='';
    list.forEach(t=>{
      const over=_overdue(t);
      const pr=PRIO[+t.prio||0];
      const chip=pr?`<span style="font-size:9.5px;font-weight:660;letter-spacing:.4px;padding:2px 7px;border-radius:980px;background:${pr[2]};color:${pr[1]}">${pr[0]}</span>`:'';
      const cl=`<span style="font-family:var(--mono);font-size:10px;color:var(--text3)">${t.clientName?esc(t.clientName):'общее'}</span>`;
      items+=`<div class="dhover" data-tid="${t.id}" draggable="true" ondragstart="_startDrag(this,event)" ondragend="_endDrag(this)" ondragover="_dragOver(this,event)" ondragleave="_dragLeave(this)" ondrop="_drop(this,event)"
        ondblclick="_editTask('${t.id}')" title="Двойной клик — редактировать"
        style="display:flex;align-items:flex-start;gap:10px;padding:11px 12px;border-radius:14px;background:${over?'linear-gradient(180deg,rgba(255,69,58,.13),rgba(255,69,58,.05))':'rgba(255,255,255,.05)'};border:1px solid ${over?'rgba(255,69,58,.22)':'rgba(255,255,255,.06)'};cursor:grab;transition:background .15s ease,transform .15s ease;${t.done?'opacity:.45;':''}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.26)" stroke-width="2.4" stroke-linecap="round" style="margin-top:3px;flex:none"><path d="M4 8h16M4 16h16"/></svg>
        <div style="flex:1;min-width:0">
          <div style="font-size:12.5px;line-height:1.4;letter-spacing:-.1px;${t.done?'text-decoration:line-through;color:var(--text3)':over?'color:#ff8078':''}">${esc(t.text||t.name||'')}</div>
          <div style="display:flex;align-items:center;gap:7px;margin-top:7px;flex-wrap:wrap">${chip}${cl}</div>
        </div>
        <div class="dact">
          <button class="dicon neutral" onclick="event.stopPropagation();toggleDayTask('${t.id}');render()" title="${t.done?'Снять «готово»':'Отметить готовой'}" style="width:22px;height:22px;font-size:12px">✓</button>
          <button class="dicon neutral" onclick="event.stopPropagation();_editTask('${t.id}')" title="Редактировать" style="width:22px;height:22px;font-size:12px">✎</button>
          <button class="dicon" onclick="event.stopPropagation();removeDayTask('${t.id}');render()" title="Удалить" style="width:22px;height:22px;font-size:12px">✕</button>
        </div>
      </div>`;
    });
    cols+=`<div class="dcard dhover" ondragover="_dayOverCol(this,event)" ondragleave="_dayLeaveCol(this)" ondrop="_dropToDay(this,event,'${dIso}')" style="padding:16px 17px">
      <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:13px;gap:8px">
        <div class="dcard-t">${title}</div>
        <div style="display:flex;align-items:baseline;gap:8px">
          <div class="dmeta">${fmtDate(dt).slice(0,5)}</div>
          <span class="dact"><button class="dicon neutral" onclick="openDayModal('${dIso}')" title="Добавить задачу на этот день" style="width:22px;height:22px;font-size:14px">＋</button></span>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">${items||'<div class="dmeta" style="padding:4px 0">Нет задач</div>'}</div>
    </div>`;
  }

  // ── месячный календарь (навигация, модалка дня, метки просрочек) ──
  const y=plannerMonth.getFullYear(), m=plannerMonth.getMonth();
  const daysInMonth=new Date(y,m+1,0).getDate();
  const offset=(new Date(y,m,1).getDay()+6)%7;
  const byDate={};
  Object.values(tasks).forEach(t=>{ if(_isTaskClientPaused(t))return; (byDate[t.startIso]=byDate[t.startIso]||[]).push(t); });
  let cal=`<div class="dcal" style="margin-bottom:6px">${['ПН','ВТ','СР','ЧТ','ПТ','СБ','ВС'].map(w=>`<div class="dcal-dow">${w}</div>`).join('')}</div><div class="dcal">`;
  for(let i=0;i<offset;i++) cal+='<div></div>';
  for(let d=1;d<=daysInMonth;d++){
    const dIso=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dayTasks=byDate[dIso]||[];
    const overdueN=dayTasks.filter(_overdue).length;
    const isT=dIso===iso;
    const pills=dayTasks.slice(0,3).map(t=>`<span style="display:block;font-size:9px;line-height:1.35;padding:1px 5px;border-radius:6px;margin-bottom:2px;background:${_overdue(t)?'rgba(255,69,58,.18)':'rgba(64,203,224,.14)'};color:${_overdue(t)?'#ff8078':'var(--accent)'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(t.text||t.name||'')}">${esc((t.text||t.name||'').slice(0,14))}</span>`).join('');
    const more=dayTasks.length>3?`<span style="font-size:9px;color:var(--text3);font-family:var(--mono)">+${dayTasks.length-3}</span>`:'';
    cal+=`<div onclick="openDayModal('${dIso}')" style="min-height:74px;border-radius:14px;padding:7px 7px 6px;cursor:pointer;text-align:left;
      background:${overdueN?'rgba(255,69,58,.07)':'rgba(255,255,255,.035)'};border:1.5px solid ${isT?'var(--accent)':overdueN?'rgba(255,69,58,.28)':'rgba(255,255,255,.05)'};transition:background .15s"
      onmouseover="this.style.background='rgba(255,255,255,.07)'" onmouseout="this.style.background='${overdueN?'rgba(255,69,58,.07)':'rgba(255,255,255,.035)'}'">
      <div style="font-family:var(--mono);font-size:11px;font-weight:600;margin-bottom:4px;color:${isT?'var(--accent)':overdueN?'#ff8078':'var(--text3)'}">${d}${overdueN?' ⚠':''}</div>
      ${pills}${more}</div>`;
  }
  cal+='</div>';

  return `<div style="max-width:1040px">
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:22px">${cols}</div>
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap">
      <div class="dcard-t" style="font-size:16px">${(MONTHS_RU[m]||'').charAt(0).toUpperCase()+(MONTHS_RU[m]||'').slice(1)} ${y}</div>
      <div style="flex:1"></div>
      <button class="dbtn dbtn-sm" onclick="shiftPlannerMonth(-1)">‹ назад</button>
      <button class="dbtn dbtn-sm" onclick="shiftPlannerMonth(0)">сегодня</button>
      <button class="dbtn dbtn-sm" onclick="shiftPlannerMonth(1)">вперёд ›</button>
      <button class="dbtn dbtn-primary dbtn-sm" onclick="openDayModal('${iso}')">+ задача</button>
    </div>
    <div class="dcard" style="padding:16px">${cal}</div>
  </div>`;
}

function shiftPlannerMonth(delta){
  if(delta===0)window.plannerMonth=new Date(getTODAY().getFullYear(),getTODAY().getMonth(),1);
  else window.plannerMonth=new Date(plannerMonth.getFullYear(),plannerMonth.getMonth()+delta,1);
  render();
}
let currentDayIso='';
function openDayModal(iso){ _sfx.play('open');
  currentDayIso=iso;const d=new Date(iso+'T00:00:00');
  document.getElementById('day-modal-title').textContent=fmtDate(d)+' '+DAYS_RU[d.getDay()];
  const sel=document.getElementById('dm-client-sel');
  sel.innerHTML=`<option value="">— без клиента —</option>`+_zoneClients().filter(c=>c.active).sort((a,b)=>a.name.localeCompare(b.name,'ru')).map(c=>`<option value="${c.id}">${c.name}</option>`).join('');   // only THIS zone's clients — no pool duplicates/phantoms
  sel.value='';
  const selTop=document.getElementById('dm-client-sel-top');
  if(selTop){ selTop.innerHTML=sel.innerHTML; selTop.value=''; }
  const ftop=document.getElementById('dm-flow-wrap-top');
  if(ftop) ftop.style.display='none';
  document.getElementById('dm-task-text').value='';
  document.getElementById('dm-until').value=isoToday();   // default «до» = today, always
  const _dmdl=document.getElementById('dm-deadline'); if(_dmdl) _dmdl.value='';
  document.getElementById('dm-note').value='';
  renderDayTasks(iso);
  document.getElementById('day-modal').style.display='flex';
  setTimeout(()=>{const el=document.getElementById('dm-task-text');if(el)el.focus();},100);
}
function updateFlowSelect(){
  var cid = (document.getElementById('dm-client-sel-top')||{}).value
         || (document.getElementById('dm-client-sel')||{}).value || '';
  var flows = cid ? getFlows(cid) : [];
  var total = flows.reduce(function(s,f){return s+f.count*0.60;},0);

  var opts = '<option value="">— обычная задача —</option>';
  if(flows.length){
    opts += '<option value="__all__">⚡ Все флоу сразу ($'+total.toFixed(2)+')</option>';
    flows.forEach(function(f){
      opts += '<option value="'+f.id+'">⚡ '+esc(f.name)+' ('+f.count+'✉ = $'+(f.count*0.60).toFixed(2)+')</option>';
    });
  }

  ['dm-flow-sel','dm-flow-sel-top'].forEach(function(id){
    var el = document.getElementById(id);
    if(el) el.innerHTML = opts;
  });

  var show = cid && flows.length > 0;
  ['dm-flow-wrap','dm-flow-wrap-top'].forEach(function(id){
    var el = document.getElementById(id);
    if(el) el.style.display = show ? 'block' : 'none';
  });
}

function renderDayTasks(iso){
  const tasks=load('dc_plantasks',{});const dayTasks=Object.values(tasks).filter(t=>!t.flowId&&!_isTaskClientPaused(t)&&(t.startIso===iso||(!t.done&&t.startIso<iso&&t.until&&t.until>=iso)))   // flows live in the Флоу tab
  // split into tasks carried over from earlier days vs. tasks of this day
  const _pr=t=>+t.prio||0;   // priority DESC first
  const carried = dayTasks.filter(t=>t.startIso<iso).sort((a,b)=>_pr(b)-_pr(a) || a.startIso.localeCompare(b.startIso));
  const own     = dayTasks.filter(t=>t.startIso===iso).sort((a,b)=>_pr(b)-_pr(a));
  function renderRow(t){
    const done=t.done||false;
    const over=_overdue(t);   // red wherever the task hangs once its day/deadline has passed
    const fromPast=t.startIso<iso;          // carried over from an earlier day
    const fromD=new Date(t.startIso+'T00:00:00');
    const fromLabel=fromPast?`<div style="font-family:var(--mono);font-size:10px;color:${over?'var(--red)':'var(--amber)'};margin-top:2px">⤷ с ${fmtDate(fromD)} ${DAYS_RU[fromD.getDay()]}</div>`:'';
    const until=t.until&&t.until!==iso?`<div style="font-family:var(--mono);font-size:10px;color:var(--text3)">до ${fmtDate(new Date(t.until+'T00:00:00'))}</div>`:'';
    const dl=t.deadline?`<div style="font-family:var(--mono);font-size:10px;color:${over?'var(--red)':'var(--amber)'}">⏳ дедлайн ${fmtDate(new Date(t.deadline+'T00:00:00'))}</div>`:'';
    const note=t.note?`<div style="font-size:11px;color:var(--text3);margin-top:3px">${esc(t.note)}</div>`:'';
    const clientBadge=t.clientName?`<span style="font-family:var(--mono);font-size:10px;padding:2px 7px;border-radius:9px;background:var(--blue-dim);color:var(--blue);margin-left:6px">${esc(t.clientName)}</span>`:'';
    const flowObj=t.flowId&&t.cid?getFlows(t.cid).find(f=>f.id===t.flowId):null;
    const flowBadge=flowObj?`<span style="font-family:var(--mono);font-size:10px;padding:2px 7px;border-radius:14px;background:rgba(251,191,36,.12);color:var(--amber);margin-left:6px;border:1px solid rgba(251,191,36,.2)">⚡ ${esc(flowObj.name)} · ${flowObj.count}✉ · $${(flowObj.count*0.60).toFixed(2)}</span>`:'';
    return `<div class="task-item" style="${done?'opacity:.45':over?'border-color:rgba(255,69,58,.35);background:rgba(255,69,58,.06)':''}"><div style="display:flex;align-items:center;gap:8px;cursor:pointer" onclick="toggleDayTask('${t.id}')"><div style="width:16px;height:16px;border-radius:10px;border:1px solid ${done?'var(--green)':over?'rgba(255,69,58,.6)':'rgba(255,255,255,.2)'};background:${done?'var(--green-dim)':'none'};display:flex;align-items:center;justify-content:center;flex-shrink:0">${done?'<span style="color:var(--green);font-size:10px">✓</span>':''}</div></div><div style="flex:1"><div style="display:flex;align-items:center;flex-wrap:wrap">${prioFlag(t.prio)}<span class="task-item-name" style="${done?'text-decoration:line-through;color:var(--text3)':over?'color:var(--red)':''}">${esc(t.text||t.name)}</span>${clientBadge}${flowBadge}</div>${fromLabel}${until}${dl}${note}</div><input type="date" value="${t.startIso}" onclick="event.stopPropagation()" onchange="event.stopPropagation();moveTask('${t.id}',this.value)" title="Перенести на другой день" style="color-scheme:dark;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:10px;color:var(--text3);font-size:10px;padding:3px 6px;cursor:pointer;outline:none;margin-right:4px"><button onclick="event.stopPropagation();_editTask('${t.id}')" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:13px;padding:2px 6px" title="Редактировать">✎</button><button onclick="removeDayTask('${t.id}')" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:14px;padding:2px 6px" title="удалить">✕</button></div>`;
  }
  let html='';
  if(carried.length){
    html+=`<div style="font-family:var(--mono);font-size:10px;color:var(--red);letter-spacing:.06em;text-transform:uppercase;margin:0 0 8px">⤷ С прошлых дней — ${carried.length}</div>`;
    carried.forEach(t=>{html+=renderRow(t);});
  }
  if(own.length){
    if(carried.length) html+=`<div style="font-family:var(--mono);font-size:10px;color:var(--text3);letter-spacing:.06em;text-transform:uppercase;margin:14px 0 8px">На ${fmtDate(new Date(iso+'T00:00:00'))}</div>`;
    own.forEach(t=>{html+=renderRow(t);});
  }
  if(!html)html=`<div style="font-size:12px;color:var(--text3);font-family:var(--mono);padding:8px 0">Нет задач — добавь первую</div>`;
  document.getElementById('day-modal-tasks').innerHTML=html;
}
function addDayTask(){
  const text=(document.getElementById('dm-task-text').value||'').trim();
  if(!text){_sfx.play('error');document.getElementById('dm-task-text').focus();return;}
  const until=document.getElementById('dm-until').value;
  const deadline=(document.getElementById('dm-deadline')||{}).value||'';
  const note=document.getElementById('dm-note').value.trim();
  const cid=(document.getElementById('dm-client-sel-top')?.value||document.getElementById('dm-client-sel')?.value||'');
  const clientName=cid?(clients.find(x=>x.id===cid)?.name||''):'';
  const flowVal=(document.getElementById('dm-flow-sel-top')?.value||document.getElementById('dm-flow-sel')?.value||'');
  const tasks=load('dc_plantasks',{});
  if(flowVal==='__all__'){
    const allFlows=cid?getFlows(cid):[];
    const tod2=_getTod();
    allFlows.forEach(function(f,i){
      if(_flowTaskFor(tasks,cid,f.id,currentDayIso)) return;  // already planned/issued this day — no duplicate
      const id='pt_'+Date.now()+'_'+i;
      // Flow tasks are one-time events — until = startIso always
      tasks[id]={id,text:f.name,startIso:currentDayIso,until:currentDayIso,note,done:false,cid,clientName,flowId:f.id,tod:tod2};
    });
  } else if(flowVal){
    // single specific flow — don't create a duplicate for the same day
    if(!_flowTaskFor(tasks,cid,flowVal,currentDayIso)){
      const id='pt_'+Date.now();
      tasks[id]={id,text,startIso:currentDayIso,until:currentDayIso,note,done:false,cid,clientName,flowId:flowVal};
    }
  } else {
    const id='pt_'+Date.now();
    tasks[id]={id,text,startIso:currentDayIso,until:until,note,done:false,cid,clientName,flowId:'',deadline:deadline};
  }
  save('dc_plantasks',tasks);
  document.getElementById('dm-task-text').value='';
  if(document.getElementById('dm-deadline')) document.getElementById('dm-deadline').value='';
  document.getElementById('dm-note').value='';
  if(document.getElementById('dm-client-sel'))document.getElementById('dm-client-sel').value='';
  renderDayTasks(currentDayIso);render();
}
function toggleDayTask(id){
  const tasks=load('dc_plantasks',{});
  if(tasks[id]){tasks[id].done=!tasks[id].done;tasks[id].doneDate=tasks[id].done?isoToday():null;
    _sfx.play(tasks[id].done?'done':'click');
  }
  save('dc_plantasks',tasks);
  renderDayTasks(currentDayIso);render();
}
function removeDayTask(id){_sfx.play('delete');
  const tasks=load('dc_plantasks',{});delete tasks[id];save('dc_plantasks',tasks);
  if(document.getElementById('day-modal').style.display!=='none')renderDayTasks(currentDayIso);
  render();
}
// Move a plan to another day — and, if that day is in another month, relocate the
// task into that month's «рабочую зону» (its own data bucket), creating the month if needed.
function moveTask(id,newIso){
  if(!newIso) return;
  const tasks=load('dc_plantasks',{});   // global store — just change the date
  const t=tasks[id]; if(!t) return;
  if(t.startIso===newIso) return;
  const wasSingleDay = !t.until || t.until===t.startIso;
  t.startIso=newIso;
  if(wasSingleDay) t.until=newIso;          // single-day task follows its date
  else if(t.until<newIso) t.until=newIso;   // keep the deadline, but never before the start
  _sfx.play('swipe');
  save('dc_plantasks',tasks);
  const dm=document.getElementById('day-modal');
  if(dm && dm.style.display!=='none') renderDayTasks(currentDayIso);
  render();
  showToast('📅 Перенесено на '+fmtDate(new Date(newIso+'T00:00:00')));
}
function closeDayModal(){ _sfx.play('close');document.getElementById('day-modal').style.display='none';}


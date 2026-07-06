function renderPlanner(){
  if(typeof plannerMonth==='undefined')window.plannerMonth=new Date(getTODAY().getFullYear(),getTODAY().getMonth(),1);
  const y=plannerMonth.getFullYear(),m=plannerMonth.getMonth();
  const daysInMonth=new Date(y,m+1,0).getDate();
  const firstDow=new Date(y,m,1).getDay();const offset=(firstDow+6)%7;
  const tasks=load('dc_plantasks',{});const byDate={};
  Object.values(tasks).forEach(t=>{if(_isTaskClientPaused(t))return;if(!byDate[t.startIso])byDate[t.startIso]=[];byDate[t.startIso].push(t);});
  const mn=MONTHS_RU[m]+' '+y;
  let html=`<div class="section-header"><h2>Планировщик</h2></div><div class="pcal-nav"><button class="pcal-nav-btn" onclick="shiftPlannerMonth(-1)">‹</button><div class="pcal-month-label">${mn}</div><button class="pcal-nav-btn" onclick="shiftPlannerMonth(1)">›</button><button class="pcal-nav-btn" onclick="shiftPlannerMonth(0)" style="width:auto;padding:0 8px;font-size:11px;font-family:var(--mono)">сегодня</button></div><div class="pcal-grid">${['пн','вт','ср','чт','пт','сб','вс'].map(d=>`<div class="pcal-dow">${d}</div>`).join('')}`;
  for(let i=0;i<offset;i++)html+=`<div></div>`;
  for(let d=1;d<=daysInMonth;d++){
    const iso=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday=iso===isoToday();const dayTasks=byDate[iso]||[];
    const show=dayTasks.slice(0,3);const more=dayTasks.length-3;
    const overdueCount = dayTasks.filter(_overdue).length;
    html+=`<div class="pcal-cell${isToday?' today':''}${overdueCount?' overdue':''}${dayTasks.length?' has-tasks':''}" onclick="openDayModal('${iso}')" style="${overdueCount?'border-color:rgba(255,69,58,.3);background:rgba(255,69,58,.04)':''}"><div class="pcal-cell-num" style="${overdueCount?'color:var(--red)':''}">${d}${overdueCount?` <span style="font-size:9px">⚠</span>`:''}</div>${show.map(t=>`<div class="pcal-pill ${_overdue(t)?'type-overdue':'type-plan'}" title="${esc(t.text||t.name)}">${esc((t.text||t.name).slice(0,12))}</div>`).join('')}${more>0?`<div class="pcal-pill type-more">+${more}</div>`:''}</div>`;
  }
  html+=`</div>`;return html;
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
  sel.innerHTML=`<option value="">— без клиента —</option>`+clients.filter(c=>c.active).sort((a,b)=>a.name.localeCompare(b.name,'ru')).map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
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
  const tasks=load('dc_plantasks',{});const dayTasks=Object.values(tasks).filter(t=>!_isTaskClientPaused(t)&&(t.startIso===iso||(!t.done&&t.startIso<iso&&t.until&&t.until>=iso)))
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
    const flowBadge=flowObj?`<span style="font-family:var(--mono);font-size:10px;padding:2px 7px;border-radius:14px;background:rgba(251,191,36,.12);color:var(--amber);margin-left:6px;border:1px solid rgba(251,191,36,.2)">⚡ ${esc(flowObj.name)} · ${flowObj.count}✉ · $${(flowObj.count*.5).toFixed(2)}</span>`:'';
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


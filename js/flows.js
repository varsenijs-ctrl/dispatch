// ── Флоу — карточки клиентов сеткой (по макету) ───────────────
// Сохранено: статистика, вкладки Сегодня/История, баннер просрочек, отметка
// «выставлен», «все флоу», добавление/удаление флоу, дедлайн, чипы задач.
// ── Флоу — карточки клиентов сеткой, строки ровно как в макете ──
// Строка флоу: иконка ветвления, название, ставка. Кнопки (отметить выставленным,
// дедлайн, удалить) появляются по наведению — вид совпадает с макетом.
function renderFlows(){
  const iso=isoToday();
  const tasks=load('dc_plantasks',{});
  const ac=_zac().sort((a,b)=>a.name.localeCompare(b.name,'ru'));
  const ICON='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d08bf5" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" style="flex:none"><path d="M6 3v12M18 9a3 3 0 100-6 3 3 0 000 6zM6 21a3 3 0 100-6 3 3 0 000 6zM15 6H9a3 3 0 00-3 3v3"/></svg>';
  const ROW='padding:10px 12px;border-radius:14px;background:linear-gradient(180deg,rgba(191,90,242,.16),rgba(191,90,242,.07));border:1px solid rgba(191,90,242,.18);box-shadow:0 1px 0 rgba(255,255,255,.07) inset';

  // Флоу этой зоны: выставленные ЗДЕСЬ + ещё не выставленные нигде. Флоу,
  // выставленный в другом месяце, к этой зоне не относится и в списке не висит
  // (раньше показывался весь каталог клиента, и августовская вкладка была забита
  // июньскими «✓ выставлен»). У новых флоу есть метка зоны создания — флоу,
  // созданный в другой зоне и ещё не выставленный, остаётся в своей.
  function _flowOfZone(cid, f){
    const ft=Object.values(tasks).filter(t=>t.cid===cid&&t.flowId===f.id);
    if(ft.some(t=>t.done&&_markInActiveZone(cid,t.startIso))) return true;   // выставлен здесь
    if(ft.some(t=>t.done)) return false;                                     // выставлен в другой зоне
    return !f.zone || f.zone===activeMonth;                                  // без метки — из старых данных
  }
  const zoneFlows=cid=>getFlows(cid).filter(f=>_flowOfZone(cid,f));

  let totalDone=0,totalPlanned=0,totalEarned=0,totalPotential=0;
  ac.forEach(c=>{
    zoneFlows(c.id).forEach(f=>{
      const ft=Object.values(tasks).filter(t=>t.cid===c.id&&t.flowId===f.id);
      const doneInZone=ft.some(t=>t.done&&_markInActiveZone(c.id,t.startIso));
      const val=f.count*0.60;
      if(doneInZone){ totalDone++; totalPlanned++; totalEarned+=val; totalPotential+=val; }
      else { totalPlanned++; totalPotential+=val; }
    });
  });

  let h=`<div style="max-width:1040px">
    <div style="display:flex;gap:12px;margin-bottom:14px;flex-wrap:wrap">
      ${[['Выставлено',totalDone+' / '+totalPlanned,'#d08bf5'],['Заработано','$'+totalEarned.toFixed(2),'var(--green)'],['Максимум','$'+totalPotential.toFixed(2),'var(--text)']].map(r=>
        `<div class="dcard" style="flex:1;min-width:150px;padding:15px 18px"><div class="dcaps">${r[0]}</div><div class="dnum" style="font-size:28px;letter-spacing:-1.1px;margin-top:7px;color:${r[2]}">${r[1]}</div></div>`).join('')}
    </div>
    <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">
      <button class="dpill ${_flowsTab==='today'?'active':''}" onclick="_flowsTab='today';render()">Активные</button>
      <button class="dpill ${_flowsTab==='history'?'active':''}" onclick="_flowsTab='history';render()">История</button>
      <div style="flex:1"></div>
      <button class="dbtn dbtn-sm" onclick="setView('clients')" title="Все клиенты зоны и их флоу">→ Клиенты</button>
    </div>`;

  // Новый флоу — прямо здесь, без похода в «Клиенты»
  if(_flowsTab==='today'){
    h+=`<div class="dcard flow-add" style="padding:14px 16px;margin-bottom:14px;display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap">
      <div style="flex:1;min-width:200px">
        <div class="dcaps" style="margin-bottom:5px">Клиент</div>
        ${ac.length
          ? `<select id="flowtab-client" class="dinput" style="width:100%;box-sizing:border-box;padding:9px 12px;font-size:12.5px">
              ${ac.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}
             </select>`
          : `<div class="dmeta">В зоне «${_finZoneLabel()}» нет клиентов — добавь их во «Клиентах»</div>`}
      </div>
      <div style="flex:1;min-width:160px">
        <div class="dcaps" style="margin-bottom:5px">Название флоу</div>
        <input id="flowtab-name" class="dinput" placeholder="Welcome / Sunset / Post Purchase…" onkeydown="if(event.key==='Enter')addFlowFromTab()" style="width:100%;box-sizing:border-box;padding:9px 12px;font-size:12.5px">
      </div>
      <div class="fa-half" style="width:104px">
        <div class="dcaps" style="margin-bottom:5px">Мейлов</div>
        <input id="flowtab-count" type="number" min="1" value="3" class="dinput" onkeydown="if(event.key==='Enter')addFlowFromTab()" style="width:100%;box-sizing:border-box;padding:9px 12px;font-size:12.5px">
      </div>
      <div class="fa-half" style="width:150px">
        <div class="dcaps" style="margin-bottom:5px">Дедлайн</div>
        <input id="flowtab-dl" type="date" class="dinput ddate" style="width:100%;box-sizing:border-box;padding:9px 12px;font-size:12px">
      </div>
      <button class="dbtn dbtn-primary" onclick="addFlowFromTab()" ${ac.length?'':'disabled style="opacity:.4"'}>＋ Добавить флоу</button>
      <div class="dmeta" style="flex:1 1 100%">1 мейл = $0.60 · флоу попадёт в зону «${_finZoneLabel()}»</div>
    </div>`;
  }

  if(_flowsTab==='today'){
    const overdueItems=[];
    ac.forEach(c=>zoneFlows(c.id).forEach(f=>{
      if(!f.deadline||f.deadline>=iso) return;
      const issued=Object.values(tasks).some(t=>t.cid===c.id&&t.flowId===f.id&&t.done);
      if(!issued) overdueItems.push({c:c,f:f});
    }));
    if(overdueItems.length){
      h+=`<div class="dcard" style="background:linear-gradient(180deg,rgba(255,69,58,.18),rgba(255,69,58,.07));border-color:rgba(255,69,58,.22);margin-bottom:14px;padding:12px 16px;display:flex;align-items:center;gap:11px;flex-wrap:wrap">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff453a" stroke-width="2" stroke-linecap="round" style="flex:none"><path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/></svg>
        <div style="font-size:13px;color:#ff8078;font-weight:540">${overdueItems.length} просрочен${overdueItems.length===1?'о флоу':'о флоу'}: ${overdueItems.slice(0,3).map(i=>esc(i.f.name)+' ('+esc(i.c.name)+')').join(', ')}${overdueItems.length>3?' …':''}</div>
      </div>`;
    }

    let cards='', hasAny=false;
    ac.forEach(c=>{
      // Флоу этой зоны (выставленные здесь + ещё не выставленные). Выставленные
      // в других месяцах не показываем — они принадлежат своей зоне.
      const flows=zoneFlows(c.id);
      if(!flows.length) return;
      hasAny=true;
      const sum=flows.reduce((s,f)=>s+f.count*0.60,0);
      const allDone=flows.every(f=>Object.values(tasks).some(t=>t.cid===c.id&&t.flowId===f.id&&t.done));
      let rows='';
      flows.forEach(f=>{
        const doneToday=Object.values(tasks).find(t=>t.cid===c.id&&t.flowId===f.id&&t.startIso===iso&&t.done);
        const issued=doneToday||Object.values(tasks).find(t=>t.cid===c.id&&t.flowId===f.id&&t.done);
        const late=!issued&&f.deadline&&f.deadline<iso;
        rows+=`<div class="dhover flow-row" style="${ROW}${late?';border-color:rgba(255,69,58,.3)':''}">
          <div style="display:flex;align-items:center;gap:10px">
            ${ICON}
            <div style="flex:1;min-width:0;font-size:12.5px;letter-spacing:-.1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;${issued?'color:var(--green)':''}">${esc(f.name)}</div>
            <div style="font-family:var(--mono);font-size:11.5px;color:var(--text2);flex:none">$${(f.count*0.60).toFixed(2)}</div>
            <div class="dact">
              <input type="date" class="dinput dinput-sm ddate" value="${f.deadline||''}" onchange="event.stopPropagation();_setFlowDl(this)" data-cid="${c.id}" data-fid="${f.id}" title="Дедлайн" style="font-size:10px;padding:2px 4px;width:104px">
              <button class="dicon neutral" onclick="event.stopPropagation();_markFlowDone(this)" data-cid="${c.id}" data-fid="${f.id}" title="${doneToday?'Выставлен сегодня — снять':'Отметить выставленным'}" style="width:22px;height:22px;font-size:12px;${doneToday?'background:rgba(48,209,88,.18);color:var(--green)':''}">✓</button>
              <button class="dicon" onclick="event.stopPropagation();_dfFlow(this)" data-cid="${c.id}" data-fid="${f.id}" title="Удалить флоу" style="width:22px;height:22px;font-size:12px">✕</button>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:7px;margin-top:6px">
            <span style="font-family:var(--mono);font-size:10px;color:var(--text3)">${f.count}✉</span>
            ${(!issued&&f.deadline)?flowDeadlineBadge(f.deadline):''}
            ${issued?`<span class="dchip dchip-ok">✓ выставлен${doneToday?' сегодня':''}</span>`:'<span class="dchip dchip-dim">не выставлен</span>'}
          </div>
        </div>`;
      });
      cards+=`<div class="dcard dhover" style="padding:17px 18px">
        <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:13px;gap:8px">
          <div class="dcard-t" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.name)}</div>
          <div style="display:flex;align-items:baseline;gap:8px">
            <div style="font-family:var(--mono);font-size:13px;font-weight:600;color:var(--green)">$${sum.toFixed(2)}</div>
            <span class="dact">
              <button class="dicon neutral" onclick="event.stopPropagation();_markAllFlowsDone(this)" data-cid="${c.id}" title="${allDone?'Все выставлены':'Отметить все флоу выставленными'}" style="width:22px;height:22px;font-size:12px;${allDone?'background:rgba(48,209,88,.18);color:var(--green)':''}">✓✓</button>
              <button class="dicon neutral" onclick="event.stopPropagation();_addFlow(this)" data-cid="${c.id}" title="Добавить флоу" style="width:22px;height:22px;font-size:14px">＋</button>
            </span>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">${rows}</div>
      </div>`;
    });
    if(hasAny) h+=`<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px">${cards}</div>`;
    else h+=`<div class="dcard dcard-p" style="text-align:center;padding:44px 20px;color:var(--text3)">
      <div style="font-size:30px;margin-bottom:10px">⚡</div>
      <div style="font-size:14px">В зоне «${_finZoneLabel()}» пока нет флоу</div>
      <div class="dmeta" style="margin-top:6px">Создай флоу в форме выше — он появится здесь</div></div>`;

  } else {
    const hm=(typeof _flowsHistoryMode!=='undefined'&&_flowsHistoryMode)||'date';
    const doneTasks=Object.values(tasks).filter(t=>t.flowId&&t.done&&_markInActiveZone(t.cid,t.startIso)&&_inRoster(t.cid)).sort((a,b)=>b.startIso.localeCompare(a.startIso));
    h+=`<div style="display:flex;gap:8px;margin-bottom:14px">
      <button class="dpill ${hm!=='client'?'active':''}" onclick="_flowsHistoryMode='date';render()">По дате</button>
      <button class="dpill ${hm==='client'?'active':''}" onclick="_flowsHistoryMode='client';render()">По клиентам</button>
    </div>`;
    if(!doneTasks.length){
      h+=`<div class="dcard dcard-p" style="text-align:center;padding:44px 20px;color:var(--text3)"><div style="font-size:30px;margin-bottom:10px">📋</div><div style="font-size:14px">История пуста</div></div>`;
    } else if(hm!=='client'){
      const byDate={};
      doneTasks.forEach(t=>{ (byDate[t.startIso]=byDate[t.startIso]||[]).push(t); });
      h+=`<div style="display:flex;flex-direction:column;gap:10px">`;
      Object.keys(byDate).sort((a,b)=>b.localeCompare(a)).forEach(ds=>{
        const d=new Date(ds+'T00:00:00');
        const label=ds===iso?'Сегодня':d.getDate()+' '+_MGEN[d.getMonth()]+', '+_DFULL[d.getDay()];
        let sum=0, rows='';
        byDate[ds].forEach(t=>{
          const c=clients.find(x=>x.id===t.cid);
          const fl=(t.cid?getFlows(t.cid):[]).find(f=>f.id===t.flowId);
          const val=fl?fl.count*0.60:0; sum+=val;
          rows+=`<div class="drow dhover">
            <div style="width:6px;height:6px;border-radius:980px;flex:none;background:#bf5af2"></div>
            <div style="flex:1;min-width:0;font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c?esc(c.name)+' — ':''}флоу «${esc(fl?fl.name:t.text)}»</div>
            <div style="font-family:var(--mono);font-size:12px;font-weight:600;color:var(--green);width:56px;text-align:right">$${val.toFixed(2)}</div>
            <span class="dact"><button class="dicon" onclick="event.stopPropagation();_rmTask(this)" data-tid="${t.id}" title="Удалить">✕</button></span>
          </div>`;
        });
        h+=`<div class="dcard" style="padding:16px 19px;border-radius:20px">
          <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:10px"><div class="dcard-t">${label}</div><div style="font-family:var(--mono);font-size:15px;font-weight:600;color:var(--green)">$${sum.toFixed(2)}</div></div>
          <div style="display:flex;flex-direction:column;gap:2px">${rows}</div></div>`;
      });
      h+=`</div>`;
    } else {
      const byClient={};
      doneTasks.forEach(t=>{ (byClient[t.cid||'x']=byClient[t.cid||'x']||[]).push(t); });
      h+=`<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px">`;
      Object.keys(byClient).forEach(cid=>{
        const c=clients.find(x=>x.id===cid);
        const list=byClient[cid];
        const total=list.reduce((s,t)=>{ const fl=(c?getFlows(cid):[]).find(f=>f.id===t.flowId); return s+(fl?fl.count*0.60:0); },0);
        let rows='';
        list.forEach(t=>{
          const d=new Date(t.startIso+'T00:00:00');
          const fl=(c?getFlows(cid):[]).find(f=>f.id===t.flowId);
          const val=fl?fl.count*0.60:0;
          rows+=`<div class="drow dhover">
            <div style="width:6px;height:6px;border-radius:980px;flex:none;background:#bf5af2"></div>
            <div style="flex:1;min-width:0;font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">флоу «${esc(fl?fl.name:t.text)}»</div>
            <div class="dmeta">${d.getDate()} ${_MSHORT[d.getMonth()]}</div>
            <div style="font-family:var(--mono);font-size:12px;font-weight:600;color:var(--green);width:56px;text-align:right">$${val.toFixed(2)}</div>
            <span class="dact"><button class="dicon" onclick="event.stopPropagation();_rmTask(this)" data-tid="${t.id}" title="Удалить">✕</button></span>
          </div>`;
        });
        h+=`<div class="dcard" style="padding:16px 19px">
          <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:10px"><div class="dcard-t">${c?esc(c.name):'Без клиента'}</div><div style="font-family:var(--mono);font-size:14px;font-weight:600;color:var(--green)">$${total.toFixed(2)}</div></div>
          <div style="display:flex;flex-direction:column;gap:2px">${rows}</div></div>`;
      });
      h+=`</div>`;
    }
  }
  h+=`</div>`;
  return h;
}

function getFlows(cid){
  try{var all=JSON.parse(localStorage.getItem('dc_flows')||'{}');return all[cid]||[];}
  catch(e){return [];}
}
function saveFlows(cid, flows){
  try{
    var all=JSON.parse(localStorage.getItem('dc_flows')||'{}');
    all[cid]=flows;
    localStorage.setItem('dc_flows', JSON.stringify(all));
  }catch(e){}
}

// Invariant: at most ONE flow task per (client, flow, day). Find it if present.
function _flowTaskFor(tasks, cid, flowId, iso){
  return Object.values(tasks).find(function(t){return t.cid===cid && t.flowId===flowId && t.startIso===iso;});
}
// Collapse any pre-existing duplicate flow tasks (same client+flow+day) into one,
// preferring a "done" one. Repairs data left by older duplicate-prone code.
function _dedupeFlowTasks(){
  var tasks=load('dc_plantasks',{});
  var seen={}, changed=false;
  Object.keys(tasks).forEach(function(k){
    var t=tasks[k];
    if(!t.flowId) return;
    var key=t.cid+'|'+t.flowId+'|'+t.startIso;
    if(!seen[key]){ seen[key]=k; return; }
    var keptKey=seen[key];
    if(t.done && !tasks[keptKey].done){ delete tasks[keptKey]; seen[key]=k; }
    else { delete tasks[k]; }
    changed=true;
  });
  if(changed) save('dc_plantasks',tasks);
  return changed;
}

const _rc = {};        // cache: view → html string
let   _rv = 0;         // data version — increments on every save

function _cacheInvalidate(){ _rv++; }
function _cached(view, fn){
  const key = view + '_' + _rv;
  if(!_rc[view] || _rc[view].v !== _rv){ _rc[view]={v:_rv,h:fn()}; }
  return _rc[view].h;
}
const _origSave = save;
save = function(key, val){ _origSave(key, val); _cacheInvalidate(); };

function _addFlow(el){ addFlow(el.dataset.cid); }
function _markAllFlowsDone(el){
  var cid=el.dataset.cid;
  var flows=getFlows(cid);
  if(!flows.length) return;
  var c=clients.find(function(x){return x.id===cid;});
  var iso=isoToday();
  var tasks=load('dc_plantasks',{});
  var added=0;
  flows.forEach(function(f){
    var existing=Object.values(tasks).find(function(t){return t.cid===cid&&t.flowId===f.id;});
    if(existing){ if(!existing.done){ existing.done=true; existing.doneDate=iso; added++; } }
    else {
      var id='pt_'+Date.now()+'_'+Math.random().toString(36).slice(2,5);
      tasks[id]={id:id,text:f.name,startIso:iso,until:iso,note:'',done:true,doneDate:iso,
        cid:cid,clientName:c?c.name:'',flowId:f.id};
      added++;
    }
  });
  if(added>0){
    save('dc_plantasks',tasks);
    _sfx.play('done');
    var total=flows.reduce(function(s,f){return s+f.count*0.60;},0);
    showToast('✓ Все флоу выставлены — +$'+total.toFixed(2));
    render();
  }
}

function _markFlowDone(el){
  // One-time: mark the flow's task done IN PLACE (keep its planned day). Only
  // create a today-task if the flow was never planned. Never deletes or moves
  // other tasks, so days planned in the Планировщик stay put.
  var cid=el.dataset.cid, fid=el.dataset.fid;
  var flows=getFlows(cid);
  var flow=flows.find(function(f){return f.id===fid;});
  if(!flow) return;
  var c=clients.find(function(x){return x.id===cid;});
  var iso=isoToday();
  var tasks=load('dc_plantasks',{});
  var existing=Object.values(tasks).find(function(t){return t.cid===cid&&t.flowId===fid;});
  if(existing){ existing.done=true; existing.doneDate=iso; }
  else {
    var id='pt_'+Date.now();
    tasks[id]={id:id,text:flow.name,startIso:iso,until:iso,note:'',done:true,doneDate:iso,cid:cid,clientName:c?c.name:'',flowId:fid};
  }
  save('dc_plantasks',tasks);
  _sfx.play('done');
  showToast('✓ '+flow.name+' выставлен — +$'+(flow.count*0.60).toFixed(2));
  render();
}

function _setFlowDl(el){
  var cid=el.dataset.cid, fid=el.dataset.fid, val=el.value||null;
  var flows=getFlows(cid);
  var f=flows.find(function(x){return x.id===fid;});
  if(f){f.deadline=val;saveFlows(cid,flows);render();}
}
function _dfFlow(el){deleteFlow(el.dataset.cid,el.dataset.fid);render();}
function _doneTask(el){toggleFlowTask(el.dataset.tid);render();}
function _rmTask(el){_sfx.play('delete');removeFlowTask(el.dataset.tid);render();}
let _flowModalCid = null;
let _flowsTab = 'today';
let _flowsHistoryMode = 'date'; // 'today' | 'history'
function addFlow(cid){
  _flowModalCid = cid;
  const modal = document.getElementById('flow-modal');
  const nameInput = document.getElementById('flow-name-input');
  const countInput = document.getElementById('flow-count-input');
  const errEl = document.getElementById('flow-modal-error');
  if(!modal) return;
  nameInput.value = '';
  countInput.value = '';
  errEl.style.display = 'none';
  modal.style.display = 'flex';
  setTimeout(function(){ nameInput.focus(); }, 100);
  _sfx.play('open');
}
function closeFlowModal(){
  const modal = document.getElementById('flow-modal');
  if(modal) modal.style.display = 'none';
  _sfx.play('close');
}
function saveFlowModal(){
  const name = (document.getElementById('flow-name-input').value||'').trim();
  const count = parseInt(document.getElementById('flow-count-input').value||'0');
  const errEl = document.getElementById('flow-modal-error');
  if(!name){
    errEl.textContent = 'Введи название флоу';
    errEl.style.display = 'block';
    document.getElementById('flow-name-input').focus();
    _sfx.play('error'); return;
  }
  if(!count||count<1){
    errEl.textContent = 'Введи количество мейлов (от 1)';
    errEl.style.display = 'block';
    document.getElementById('flow-count-input').focus();
    _sfx.play('error'); return;
  }
  // The create-flow modal has no deadline field; deadlines are set later from
  // the flow tag UI (see _setFlowDl). Start with none.
  const deadline = null;
  const flows = getFlows(_flowModalCid);
  flows.push({id:'fl_'+Date.now(), name:name, count:count, deadline:deadline, zone:activeMonth});
  saveFlows(_flowModalCid, flows);
  closeFlowModal();
  _sfx.play('done');
  render();
}

// Создание флоу прямо во вкладке «Флоу» — без похода в «Клиенты».
function addFlowFromTab(){
  const cidEl=document.getElementById('flowtab-client');
  const nameEl=document.getElementById('flowtab-name');
  const cntEl=document.getElementById('flowtab-count');
  const dlEl=document.getElementById('flowtab-dl');
  if(!cidEl||!nameEl||!cntEl) return;
  const cid=cidEl.value;
  const name=(nameEl.value||'').trim();
  const count=parseInt(cntEl.value||'0',10);
  if(!cid){ _sfx.play('error'); showToast('Выбери клиента'); return; }
  if(!name){ _sfx.play('error'); showToast('Введи название флоу'); nameEl.focus(); return; }
  if(!count||count<1){ _sfx.play('error'); showToast('Мейлов — минимум 1'); cntEl.focus(); return; }
  const flows=getFlows(cid);
  flows.push({id:'fl_'+Date.now(), name:name, count:count, deadline:(dlEl&&dlEl.value)||null, zone:activeMonth});
  saveFlows(cid, flows);
  const c=(typeof clients!=='undefined'?clients:[]).find(x=>x.id===cid);
  _sfx.play('done');
  showToast(`✓ Флоу «${name}» → ${c?c.name:'клиент'} · $${(count*0.60).toFixed(2)}`);
  render();
}
function deleteFlow(cid,fid){
  if(!cid||!fid) return;
  // Remove flow definition
  const flows=getFlows(cid).filter(function(f){return f.id!==fid;});
  saveFlows(cid,flows);
  // Remove all plantasks for this flow
  var tasks=load('dc_plantasks',{});
  var changed=false;
  Object.keys(tasks).forEach(function(k){
    if(tasks[k].cid===cid&&tasks[k].flowId===fid){delete tasks[k];changed=true;}
  });
  if(changed) save('dc_plantasks',tasks);
  render();
}

function getFlowDays(cid){
  return (load('dc_flow_days',{})[cid]||{});
}

function getFlowEarnings(cid, scope){
  // One-time model: each flow counts ONCE. Per-zone ('month' scope): a flow counts
  // in THIS zone only if it was issued here (→ earned + potential) or has never been
  // issued anywhere (→ potential, still to-do). A flow issued in ANOTHER zone belongs
  // there and is ignored here — so June-issued flows don't inflate July's Максимум.
  const flows=getFlows(cid);
  if(!flows.length) return {earned:0,potential:0,tasks:[]};
  const tasks=load('dc_plantasks',{});
  let earned=0, potential=0;
  const list=[];
  flows.forEach(f=>{
    const val=f.count*0.60;
    const ft=Object.values(tasks).filter(t=>t.cid===cid && t.flowId===f.id);
    const doneInZone=ft.some(t=>t.done && _markInActiveZone(cid, t.startIso));
    const doneAnywhere=ft.some(t=>t.done);
    if(scope==='month'){
      if(doneInZone){ earned+=val; potential+=val; list.push({flow:f, val, done:true, task:ft.find(t=>t.done)||null}); }
      else if(!doneAnywhere){ potential+=val; list.push({flow:f, val, done:false, task:null}); }
      // issued in another zone → belongs there, skip entirely
    } else {
      potential+=val;
      if(doneAnywhere) earned+=val;
      list.push({flow:f, val, done:doneAnywhere, task:ft.find(t=>t.done)||null});
    }
  });
  return {earned,potential,tasks:list};
}

function toggleFlowTask(id){
  var tasks=load('dc_plantasks',{});
  if(tasks[id]){
    tasks[id].done=!tasks[id].done;
    tasks[id].doneDate=tasks[id].done?isoToday():null;
    save('dc_plantasks',tasks); _sfx.play('done');
  }
}
function removeFlowTask(id){
  var tasks=load('dc_plantasks',{});
  delete tasks[id]; save('dc_plantasks',tasks);
}

function getFlowStats(cid){
  const flows=getFlows(cid);
  const tasks=load('dc_plantasks',{});
  return flows.map(f=>{
    const flowTasks=Object.values(tasks).filter(t=>t.cid===cid&&t.flowId===f.id);
    const done=flowTasks.filter(t=>t.done).length;
    const total=flowTasks.length;
    return {...f,done,total,earned:done*f.count*0.60,potential:total*f.count*0.60};
  });
}


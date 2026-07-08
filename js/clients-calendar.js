function togglePauseClient(id){
  const c=clients.find(x=>x.id===id);
  if(!c) return;
  c.paused=!c.paused;
  saveAll();
  render();
  showToast(c.paused?`⏸ ${c.name} на паузе — не учитывается в статах`:`▶ ${c.name} возобновлён`);
}

function deleteClient(id){ _sfx.play('error');
  const c=clients.find(x=>x.id===id);if(!c)return;
  if(!confirm(`Удалить «${c.name}»? Можно отменить через ⌘Z.`))return;
  const snapshot={...c};const histSnapshot=historyData[c.name]?{...historyData[c.name]}:null;
  clients=clients.filter(x=>x.id!==id);delete historyData[c.name];saveAll();
  _undoStack.push({type:'delete_client',snapshot,histSnapshot});
  if(_undoStack.length>MAX_UNDO)_undoStack.shift();
  showToast('↩ Клиент удалён — ⌘Z чтобы вернуть');render();
}
function resetToInitial(){
  if(!confirm('Сбросить все данные до начального состояния из таблицы?\nВсе твои правки удалятся.'))return;
  ['dc_clients','dc_log','dc_history','dc_plans','dc_plantasks','dc_manual_done','dc_sms_days','dc_pay_disabled','dc_sheet_url','dc_zone_roster'].forEach(k=>localStorage.removeItem(k));
  clients=[];log={};historyData={};
  initPreload();render();
}
function importFromPaste(){
  const raw=document.getElementById('paste-data')?.value?.trim();
  const statusEl=document.getElementById('import-status');
  if(!raw){statusEl.className='import-status err';statusEl.textContent='Вставь данные из таблицы';return;}
  statusEl.className='import-status loading';statusEl.textContent='Разбираю данные...';
  const lines=raw.split('\n').map(l=>l.trim()).filter(l=>l);
  if(lines.length<2){statusEl.className='import-status err';statusEl.textContent='Слишком мало строк';return;}
  const sep=lines[0].includes('\t')?'\t':',';
  const rows=lines.map(l=>{if(sep==='\t')return l.split('\t').map(c=>c.trim());const cells=[];let cur='';let inQ=false;for(let i=0;i<l.length;i++){const ch=l[i];if(ch==='"'){inQ=!inQ;}else if(ch===','&&!inQ){cells.push(cur);cur='';}else cur+=ch;}cells.push(cur);return cells.map(c=>c.replace(/^"|"$/g,'').trim());});
  let headerRow=0;
  for(let i=0;i<Math.min(5,rows.length);i++){const cols=rows[i].slice(1).filter(c=>c&&c.trim());if(cols.length>0&&!rows[i][0].match(/^\d{4}-\d{2}-\d{2}$/)&&!rows[i][0].match(/^\d{1,2}\.\d{1,2}/)){headerRow=i;break;}}
  const headers=rows[headerRow];const colClients=headers.slice(1).map(h=>h.trim()).filter(h=>h);
  if(!colClients.length){statusEl.className='import-status err';statusEl.textContent='Не нашёл имена клиентов';return;}
  let totalDates=0;let skipped=0;const newClientNames=new Set();
  // Map each pasted column name \u2192 canonical client name: if a client with the same
  // normalized name already exists, reuse ITS exact name so history & the client
  // record don't split between "Macro Beauty" and "macrobeauty".
  const canonical={};
  colClients.forEach(nm=>{ const ex=clients.find(c=>c.active&&_normName(c.name)===_normName(nm)); canonical[nm]=ex?ex.name:nm; });
  for(let r=headerRow+1;r<rows.length;r++){
    const row=rows[r];const dateRaw=(row[0]||'').trim();if(!dateRaw)continue;
    let iso=null;
    if(/^\d{4}-\d{2}-\d{2}$/.test(dateRaw))iso=dateRaw;
    else{const m1=dateRaw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);if(m1)iso=`${m1[3]}-${m1[2].padStart(2,'0')}-${m1[1].padStart(2,'0')}`;}
    if(!iso)continue;
    if(!_inZone(iso)){ skipped++; continue; }   // import only THIS zone's month \u2014 don't fill other months
    for(let c=0;c<colClients.length;c++){const clientName=canonical[colClients[c]];if(!clientName)continue;const val=(row[c+1]||'').trim().toLowerCase().replace(/\u200b/g,'');if(!val||!['yes','no','draft'].includes(val))continue;if(!historyData[clientName])historyData[clientName]={};historyData[clientName][iso]=val;newClientNames.add(clientName);totalDates++;}
  }
  if(!totalDates){statusEl.className='import-status err';statusEl.textContent=skipped?('Все даты из других месяцев — переключись на нужную зону ('+skipped+' строк пропущено)'):'Не нашёл данных (yes/no/draft)';return;}
  let added=0; const importedCids=[];
  newClientNames.forEach(name=>{
    let ex=clients.find(c=>c.active&&_normName(c.name)===_normName(name));
    if(!ex){ ex={id:'c_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),name,active:true,smsEnabled:false,schedule:'',deadline:null}; clients.push(ex); added++; }
    importedCids.push(ex.id);
  });
  saveAll();
  // Import = "put these clients into THIS zone" — add every imported client to the
  // active zone's roster so they show up right away (not just in the shared pool).
  const _rm=_rosterMap(); if(!Array.isArray(_rm[activeMonth])) _rm[activeMonth]=[];
  importedCids.forEach(id=>{ if(_rm[activeMonth].indexOf(id)<0) _rm[activeMonth].push(id); });
  save('dc_zone_roster', _rm);
  var _msg=`✓ ${totalDates} записей, ${newClientNames.size} клиентов в зону «${_finZoneLabel()}»${added?' (+'+added+' новых)':''}${skipped?' · '+skipped+' строк из других месяцев пропущено':''}.`;
  statusEl.className='import-status ok';statusEl.textContent=_msg;
  try{ showToast(_msg); }catch(e){}   // render() below rebuilds the panel and wipes the inline status, so surface it as a toast too
  document.getElementById('paste-data').value='';render();
}

function handleRowClick(event,cid){if(event.target.closest('button')||event.target.closest('input'))return;openCal(cid);}
let calCurrentCid=null;
function collectAllDates(cid){
  const c=clients.find(x=>x.id===cid);if(!c)return{};const all={};
  // current work space (active zone) only — zones are independent
  Object.entries(historyData[c.name]||{}).forEach(([iso,val])=>{all[iso]=val;});
  Object.entries(log).forEach(([dateStr,entries])=>{const e=entries[cid];if(!e)return;const p=dateStr.split('.');if(p.length!==3)return;const iso=`${p[2]}-${p[1]}-${p[0]}`;if(e.email)all[iso]='yes';else if(e.blocked)all[iso]='no';});
  return all;
}
function openCal(cid){ _sfx.play('open');
  var c=clients.find(x=>x.id===cid) || (clients.find(x=>x.name===cid));  // never switch zones
  if(!c) return;
  calCurrentCid=c.id; cid=c.id;
  document.getElementById('cal-title').textContent=c.name;
  document.getElementById('cal-legend').innerHTML=`<span class="badge badge-done">yes</span><span class="badge badge-draft">draft</span><span class="badge badge-blocked">no</span><span style="font-size:11px;color:var(--text3);font-family:var(--mono);margin-left:4px">— кликни по дню чтобы изменить</span>`;
  renderCalModal(cid);
  document.getElementById('cal-modal').style.display='flex';
}
// Open a client's calendar by NAME (for task badges whose stored cid may be stale
// or belong to another zone). Finds the client in the active zone, else any zone.
function openCalByName(name){
  var c=clients.find(x=>x.name===name);   // open in the current zone; never switch
  if(c) openCal(c.id);
}
function buildCalDay(cls,isToday,cid,iso,d,dot,smsBtn,flowDay,flowInfo,flows,val){
  var parts=[];
  var onclick=flowDay?'':'cycleCalDay(\''+cid+'\',\''+iso+'\')';
  var title=iso+(flowDay?' · flow':val?' · '+val:'');
  parts.push('<div class="'+cls+(isToday?' today-marker':'')+'" onclick="'+onclick+'" title="'+title+'">');
  parts.push('<div class="cal-day-num">'+d+'</div>');
  parts.push(dot);
  if(flowInfo) parts.push('<div style="font-size:8px;color:var(--amber);text-align:center;width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 2px">'+flowInfo.name.slice(0,8)+'</div>');
  parts.push(smsBtn);

  parts.push('</div>');
  return parts.join('');
}

function renderCalModal(cid){
  const c=clients.find(x=>x.id===cid);if(!c)return;
  const allDates=collectAllDates(cid);
  const vals=Object.values(allDates);
  document.getElementById('cal-stats').textContent=`✓ ${vals.filter(v=>v==='yes').length} отправлено  ✗ ${vals.filter(v=>v==='no').length} не отправлено  ~ ${vals.filter(v=>v==='draft').length} черновик`;
  const months=[];
  for(let delta=-1;delta<=1;delta++){const d=new Date(getTODAY().getFullYear(),getTODAY().getMonth()+delta,1);months.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);}
  let html='';
  months.forEach(mk=>{
    const [y,m]=mk.split('-').map(Number);
    const daysInMonth=new Date(y,m,0).getDate();const firstDow=new Date(y,m-1,1).getDay();const offset=(firstDow+6)%7;
    html+=`<div class="cal-month"><div class="cal-month-title">${MONTHS_RU[m-1]} ${y}</div><div class="cal-grid">${['пн','вт','ср','чт','пт','сб','вс'].map(d=>`<div class="cal-dow">${d}</div>`).join('')}`;
    for(let i=0;i<offset;i++)html+=`<div class="cal-day empty"></div>`;
    const smsDays=load('dc_sms_days',{});const cidSms=smsDays[cid]||{};
    const flowDaysCal=getFlowDays(cid);
    const clientFlowsCal=getFlows(cid);
    for(let d=1;d<=daysInMonth;d++){
      const iso=`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const val=allDates[iso]||'';const isToday=iso===isoToday();const hasSms=cidSms[iso]||false;
      let cls='cal-day clickable no-task';let dot='';
      if(val==='yes'){cls='cal-day clickable status-yes';dot='<div class="cal-dot cal-dot-yes"></div>';}
      else if(val==='no'){cls='cal-day clickable status-no';dot='<div class="cal-dot cal-dot-no"></div>';}
      else if(val==='draft'){cls='cal-day clickable status-draft';dot='<div class="cal-dot cal-dot-draft"></div>';}
      const smsBtn=val?`<div onclick="event.stopPropagation();toggleDaySms('${cid}','${iso}')" style="position:absolute;bottom:3px;right:3px;width:30px;height:17px;border-radius:12px;background:${hasSms?'rgba(48,209,88,.35)':'rgba(255,255,255,.12)'};border:1px solid ${hasSms?'rgba(48,209,88,.85)':'rgba(255,255,255,.25)'};cursor:pointer;transition:all .15s;display:flex;align-items:center;box-shadow:0 1px 3px rgba(0,0,0,.3)" title="${hasSms?'SMS есть — нажми чтобы убрать':'SMS нет — нажми чтобы добавить'}"><div style="width:12px;height:12px;border-radius:50%;background:${hasSms?'var(--green)':'rgba(255,255,255,.55)'};margin-left:${hasSms?'15px':'2px'};transition:all .15s;flex-shrink:0;box-shadow:0 1px 2px rgba(0,0,0,.4)"></div></div>`:'';
      const flowDay=flowDaysCal[iso]||null;
      const flowInfo=flowDay?clientFlowsCal.find(function(f){return f.id===flowDay.fid;}):null;
      html+=buildCalDay(cls,isToday,cid,iso,d,dot,smsBtn,flowDay,flowInfo,clientFlowsCal,val);
    }
    html+=`</div></div>`;
  });
  document.getElementById('cal-body').innerHTML=html;
}
const _undoStack=[];const MAX_UNDO=30;
function undoLastCalendarChange(){ _sfx.play('undo');
  if(!_undoStack.length){showToast('Нечего отменять');return;}
  const entry=_undoStack.pop();
  if(entry.type==='manual_done'){const manual=load('dc_manual_done',{});if(entry.prev===true)manual[entry.cid]=true;else delete manual[entry.cid];save('dc_manual_done',manual);showToast('↩ Галочка отменена');}
  else if(entry.type==='delete_client'){clients.push(entry.snapshot);if(entry.histSnapshot)historyData[entry.snapshot.name]=entry.histSnapshot;saveAll();showToast('↩ Клиент восстановлен');}
  else{const{cid,name,iso,prev}=entry;const restore=(prev===''||prev===undefined)?'':prev;
    if(!historyData[name])historyData[name]={};if(restore==='')delete historyData[name][iso];else historyData[name][iso]=restore;saveAll();
    try{ _logAct(name, iso, restore); }catch(e){}try{ if(typeof _sheetPush==='function') _sheetPush(name, iso, restore); }catch(e){}if(calCurrentCid===cid)renderCalModal(cid);showToast('↩ Отменено');}
  updateSidebar();render();
}
function showToast(msg){
  let t=document.getElementById('dispatch-toast');
  if(!t){t=document.createElement('div');t.id='dispatch-toast';t.style.cssText=`position:fixed;bottom:28px;left:50%;transform:translateX(-50%) translateY(10px);background:rgba(30,30,46,.92);border:1px solid rgba(255,255,255,.15);color:#fff;font-family:var(--mono);font-size:12px;padding:8px 18px;border-radius:26px;z-index:9999;backdrop-filter:blur(20px);box-shadow:0 4px 24px rgba(0,0,0,.4);transition:opacity .2s,transform .2s;opacity:0;pointer-events:none;`;document.body.appendChild(t);}
  t.textContent=msg;t.style.opacity='1';t.style.transform='translateX(-50%) translateY(0)';
  clearTimeout(t._timer);t._timer=setTimeout(()=>{t.style.opacity='0';t.style.transform='translateX(-50%) translateY(10px)';},1800);
}
function cycleCalDay(cid,iso){ _sfx.play('click');
  const c=clients.find(x=>x.id===cid);if(!c)return;
  // marks go into the CURRENT work space (active zone), regardless of the date's month
  if(!historyData[c.name])historyData[c.name]={};
  const prev=historyData[c.name][iso]||'';
  const cycle=['','yes','draft','no'];const next=cycle[(cycle.indexOf(prev)+1)%cycle.length];
  _undoStack.push({cid,name:c.name,iso,prev});if(_undoStack.length>MAX_UNDO)_undoStack.shift();
  if(next==='')delete historyData[c.name][iso];else historyData[c.name][iso]=next;
  saveAll();
  try{ _logAct(c.name, iso, next); }catch(e){}                                         // → action log (История)
  try{ if(typeof _sheetPush==='function') _sheetPush(c.name, iso, next); }catch(e){}   // → Google Sheet
  renderCalModal(cid);updateSidebar();
}
function closeCal(){ _sfx.play('close');document.getElementById('cal-modal').style.display='none';}

function bindEvents(){
  document.querySelectorAll('[data-action="toggle-email"]').forEach(b=>{b.onclick=()=>{const e=getLog(todayKey(),b.dataset.id);e.email=!e.email;saveAll();render();};});
  document.querySelectorAll('[data-action="toggle-sms"]').forEach(b=>{b.onclick=()=>{const e=getLog(todayKey(),b.dataset.id);e.sms=!e.sms;saveAll();render();};});
  document.querySelectorAll('[data-action="enable-sms"]').forEach(b=>{b.onclick=()=>{const c=clients.find(x=>x.id===b.dataset.id);if(c){c.smsEnabled=true;saveAll();render();}};});
  document.querySelectorAll('[data-action="block"]').forEach(b=>{b.onclick=()=>{const e=getLog(todayKey(),b.dataset.id);e.blocked=true;saveAll();render();};});
  document.querySelectorAll('[data-action="unblock"]').forEach(b=>{b.onclick=()=>{const e=getLog(todayKey(),b.dataset.id);e.blocked=false;saveAll();render();};});
  document.querySelectorAll('[data-action="unblock-date"]').forEach(b=>{b.onclick=()=>{const e=getLog(b.dataset.date,b.dataset.id);e.blocked=false;saveAll();render();};});
  document.querySelectorAll('[data-action="note"]').forEach(inp=>{inp.oninput=()=>{const e=getLog(todayKey(),inp.dataset.id);e.note=inp.value;saveAll();};});
  document.querySelectorAll('[data-action="delete-client"]').forEach(b=>{
    b.onclick=(e)=>{e.stopPropagation();deleteClient(b.dataset.id);};
  });
  document.querySelectorAll('[data-action="toggle-sms-client"]').forEach(b=>{
    b.onclick=(e)=>{
      e.stopPropagation();
      const c=clients.find(x=>x.id===b.dataset.id);if(!c)return;
      c.smsEnabled=_iosSwitch(b);   // animate the switch in place; no full re-render
      saveAll();
      updateSidebar();
    };
  });
  document.querySelectorAll('.deadline-edit').forEach(inp=>{inp.onchange=()=>{const c=clients.find(x=>x.id===inp.dataset.id);if(c){c.deadline=inp.value||null;saveAll();render();}};});
  const sched=document.getElementById('new-schedule');if(sched){sched.onchange=updateSchedExtra;updateSchedExtra();}
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeCal();},{once:true});
}
function updateSchedExtra(){
  const sched=document.getElementById('new-schedule');const extra=document.getElementById('schedule-extra');if(!sched||!extra)return;
  if(sched.value==='interval'){extra.innerHTML=`<div class="form-field"><label>Каждые сколько дней</label><input id="new-interval" type="number" value="2" min="1" max="30" style="width:80px"></div>`;}
  else if(sched.value==='weekly'){const days=['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];const vals=[1,2,3,4,5,6,0];extra.innerHTML=days.map((d,i)=>`<label style="display:flex;align-items:center;gap:4px;font-size:12px;cursor:pointer;color:var(--text3)"><input type="checkbox" value="${vals[i]}" style="accent-color:var(--accent)"> ${d}</label>`).join('');}
  else extra.innerHTML='';
}

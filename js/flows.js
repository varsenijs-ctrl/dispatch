function renderFlows(){
  var iso=isoToday();
  var tasks=load('dc_plantasks',{});
  var ac=clients.filter(function(c){return c.active&&!c.paused;}).sort(function(a,b){return a.name.localeCompare(b.name,'ru');});

  // Per-zone flow accounting: a flow issued in THIS zone counts here; a flow never
  // issued anywhere is still "to do"; a flow issued in ANOTHER zone belongs there and
  // is ignored (so June-issued flows don't inflate July's potential).
  var totalDone=0,totalPlanned=0,totalEarned=0,totalPotential=0;
  ac.forEach(function(c){
    getFlows(c.id).forEach(function(f){
      var ft=Object.values(tasks).filter(function(t){return t.cid===c.id&&t.flowId===f.id;});
      var doneInZone=ft.some(function(t){return t.done&&_inZone(t.startIso);});
      var doneAnywhere=ft.some(function(t){return t.done;});
      var val=f.count*0.60;
      if(doneInZone){ totalDone++; totalPlanned++; totalEarned+=val; totalPotential+=val; }
      else if(!doneAnywhere){ totalPlanned++; totalPotential+=val; }   // pending → still to issue
    });
  });

  var h='<div style="max-width:860px">';

  h+='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">';
  [['Выставлено',totalDone+' / '+totalPlanned,'var(--amber)'],
   ['Заработано','$'+totalEarned.toFixed(2),'var(--green)'],
   ['Максимум','$'+totalPotential.toFixed(2),'var(--text)']].forEach(function(r){
    h+='<div style="background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.09);border-radius:20px;padding:16px 18px">';
    h+='<div style="font-size:11px;color:var(--text3);'+MONO+';text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">'+r[0]+'</div>';
    h+='<div style="font-size:28px;font-weight:700;color:'+r[2]+'">'+r[1]+'</div></div>';
  });
  h+='</div>';

  h+='<div style="display:flex;gap:8px;margin-bottom:20px">';
  ['today','history'].forEach(function(t){
    var label=t==='today'?'Сегодня':'История';
    var active=_flowsTab===t;
    h+='<button onclick="_flowsTab=\''+t+'\';render()" style="padding:7px 18px;border-radius:24px;border:1px solid '+(active?'rgba(var(--accent-rgb),.5)':'rgba(255,255,255,.12)')+';background:'+(active?'rgba(var(--accent-rgb),.15)':'rgba(255,255,255,.04)')+';color:'+(active?'var(--accent)':'var(--text3)')+';font-family:Inter,sans-serif;font-size:12px;font-weight:'+(active?'600':'400')+';cursor:pointer">'+label+'</button>';
  });
  h+='</div>';

  if(_flowsTab==='today'){
    // ── СЕГОДНЯ: checkboxes ────────────────────────────────
    var overdueItems=[];
    ac.forEach(function(c){
      getFlows(c.id).forEach(function(f){
        if(!f.deadline||f.deadline>=iso) return;
        var issued=Object.values(tasks).some(function(t){return t.cid===c.id&&t.flowId===f.id&&t.done;});
        if(!issued) overdueItems.push({c:c,f:f});
      });
    });
    if(overdueItems.length){
      h+='<div style="background:rgba(248,113,113,.07);border:1px solid rgba(248,113,113,.2);border-radius:20px;margin-bottom:16px;overflow:hidden">';
      h+='<div style="padding:12px 18px;border-bottom:1px solid rgba(248,113,113,.15);font-size:12px;font-weight:600;color:var(--red)">⚠ Просрочено — '+overdueItems.length+' флоу</div>';
      overdueItems.forEach(function(item){
        var MONO2="font-family:var(--mono)";
        h+='<div style="display:flex;align-items:center;gap:12px;padding:12px 18px;border-bottom:1px solid rgba(248,113,113,.08)">';
        h+='<div onclick="event.stopPropagation();_markFlowDone(this)" data-cid="'+item.c.id+'" data-fid="'+item.f.id+'" ';
        h+='style="width:26px;height:26px;border-radius:18px;flex-shrink:0;cursor:pointer;display:flex;align-items:center;justify-content:center;border:2px solid rgba(248,113,113,.4);background:none">';
        h+='</div>';
        h+='<div style="flex:1">';
        h+='<div style="font-size:13px;font-weight:500">⚡ '+esc(item.f.name)+'</div>';
        h+='<div style="font-size:11px;color:var(--red);margin-top:2px">'+esc(item.c.name)+' · '+flowDeadlineBadge(item.f.deadline)+'</div>';
        h+='</div>';
        h+='<span style="'+MONO+';font-size:12px;color:var(--green);font-weight:600">+$'+(item.f.count*0.60).toFixed(2)+'</span>';
        h+='</div>';
      });
      h+='</div>';
    }
    var hasAny=false;
    ac.forEach(function(c){
      var flows=getFlows(c.id).filter(function(f){
        // one-time: hide flows already issued (they move to История)
        var issued=Object.values(tasks).some(function(t){return t.cid===c.id&&t.flowId===f.id&&t.done;});
        if(issued) return false;
        if(f.deadline&&f.deadline<iso) return false; // overdue shown above
        return true;
      });
      if(!flows.length) return;
      hasAny=true;
      h+='<div style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);border-radius:20px;margin-bottom:12px;overflow:hidden">';
      h+='<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid rgba(255,255,255,.06)">';
      h+='<div style="font-size:14px;font-weight:600">'+esc(c.name)+'</div>';
      var allDone=flows.every(function(f){
        return Object.values(tasks).some(function(t){return t.cid===c.id&&t.flowId===f.id&&t.startIso===iso&&t.done;});
      });
      h+='<div style="display:flex;align-items:center;gap:8px">';
      h+='<button onclick="event.stopPropagation();_markAllFlowsDone(this)" data-cid="'+c.id+'" style="font-size:11px;padding:3px 12px;border-radius:24px;border:1px solid '+(allDone?'rgba(48,209,88,.4)':'rgba(255,255,255,.15)')+';background:'+(allDone?'rgba(48,209,88,.12)':'rgba(255,255,255,.06)')+';color:'+(allDone?'var(--green)':'var(--text2)')+';cursor:pointer;font-family:Inter,sans-serif">'+(allDone?'✓ все':'✓ все флоу')+'</button>';
      h+='<button onclick="event.stopPropagation();_addFlow(this)" data-cid="'+c.id+'" class="toggle-btn" style="font-size:11px;padding:3px 10px">+ флоу</button>';
      h+='</div></div>';
      flows.forEach(function(f){
        var doneToday=Object.values(tasks).find(function(t){return t.cid===c.id&&t.flowId===f.id&&t.startIso===iso&&t.done;});
        var fp=Object.values(tasks).filter(function(t){return t.cid===c.id&&t.flowId===f.id&&!t.done;});
        h+='<div style="padding:14px 18px;border-bottom:1px solid rgba(255,255,255,.04)">';
        h+='<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">';
        h+='<div style="font-size:13px;font-weight:500;flex:1">⚡ '+esc(f.name)+(f.deadline?' '+flowDeadlineBadge(f.deadline):'')+'</div>';
        h+='<div style="'+MONO+';font-size:11px;color:var(--text3)">'+f.count+'✉ · $'+(f.count*0.60).toFixed(2)+'/раз</div>';
        h+='<input type="date" value="'+(f.deadline||'')+'" onchange="event.stopPropagation();_setFlowDl(this)" data-cid="'+c.id+'" data-fid="'+f.id+'" style="color-scheme:dark;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:14px;color:var(--text3);font-size:10px;padding:3px 6px;cursor:pointer;outline:none" title="Дедлайн">';
        h+='<button onclick="event.stopPropagation();_dfFlow(this)" data-cid="'+c.id+'" data-fid="'+f.id+'" style="background:none;border:none;color:rgba(255,100,100,.7);cursor:pointer;font-size:16px;padding:0 6px">✕</button>';
        h+='</div>';
        h+='<div style="display:flex;align-items:center;gap:12px">';
        h+='<div onclick="event.stopPropagation();_markFlowDone(this)" data-cid="'+c.id+'" data-fid="'+f.id+'" style="width:26px;height:26px;border-radius:18px;flex-shrink:0;cursor:pointer;transition:all .2s;display:flex;align-items:center;justify-content:center;border:2px solid '+(doneToday?'rgba(48,209,88,.6)':'rgba(255,255,255,.2)')+';background:'+(doneToday?'rgba(48,209,88,.15)':'none')+'">';
        if(doneToday) h+='<span style="color:var(--green);font-size:14px;font-weight:700;line-height:1">✓</span>';
        h+='</div>';
        h+='<div style="flex:1"><div style="font-size:13px;font-weight:500;color:'+(doneToday?'var(--green)':'var(--text2)')+'">'+( doneToday?'Выставлен сегодня':'Отметить выставленным')+'</div></div>';
        h+='<span style="'+MONO+';font-size:13px;color:var(--green);font-weight:600">+$'+(f.count*0.60).toFixed(2)+'</span>';
        h+='</div>';
        if(fp.length){
          h+='<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:5px">';
          fp.forEach(function(t){
            var d=new Date(t.startIso+'T00:00:00');
            var ds=d.getDate()+'.'+String(d.getMonth()+1).padStart(2,'0');
            h+='<div style="display:flex;align-items:center;gap:4px;padding:3px 8px;border-radius:14px;background:rgba(var(--accent-rgb),.08);border:1px solid rgba(var(--accent-rgb),.15)">';
            h+='<span style="'+MONO+';font-size:10px;color:var(--accent)">'+ds+'</span>';
            h+='<button onclick="event.stopPropagation();_rmTask(this)" data-tid="'+t.id+'" style="background:none;border:none;color:rgba(255,100,100,.5);cursor:pointer;font-size:11px;padding:0 2px">✕</button>';
            h+='</div>';
          });
          h+='</div>';
        }
        h+='</div>';
      });
      h+='</div>';
    });
    if(!hasAny){
      var emptyMsg = totalPlanned>0
        ? '<div style="font-size:32px;margin-bottom:12px">🎉</div><div style="font-size:14px">Все флоу выставлены — см. вкладку «История»</div>'
        : '<div style="font-size:32px;margin-bottom:12px">⚡</div><div style="font-size:14px">Нет флоу — зайди в Клиенты</div>';
      h+='<div style="text-align:center;padding:60px 20px;color:var(--text3)">'+emptyMsg+'</div>';
    }

  } else {
    var hm=_flowsHistoryMode||'date';
    var doneTasks=Object.values(tasks).filter(function(t){return t.flowId&&t.done&&_inZone(t.startIso);}).sort(function(a,b){return b.startIso.localeCompare(a.startIso);});
    h+='<div style="display:flex;gap:6px;margin-bottom:16px">';
    h+='<button onclick="_flowsHistoryMode=this.dataset.m;render()" data-m="date" style="padding:5px 14px;border-radius:20px;cursor:pointer;font-family:Inter,sans-serif;font-size:11px;border:1px solid '+(hm!=='client'?'rgba(var(--accent-rgb),.4)':'rgba(255,255,255,.1)')+';background:'+(hm!=='client'?'rgba(var(--accent-rgb),.12)':'rgba(255,255,255,.04)')+';color:'+(hm!=='client'?'var(--accent)':'var(--text3)')+'">По дате</button>';
    h+='<button onclick="_flowsHistoryMode=this.dataset.m;render()" data-m="client" style="padding:5px 14px;border-radius:20px;cursor:pointer;font-family:Inter,sans-serif;font-size:11px;border:1px solid '+(hm==='client'?'rgba(var(--accent-rgb),.4)':'rgba(255,255,255,.1)')+';background:'+(hm==='client'?'rgba(var(--accent-rgb),.12)':'rgba(255,255,255,.04)')+';color:'+(hm==='client'?'var(--accent)':'var(--text3)')+'">По клиентам</button>';
    h+='</div>';
    if(!doneTasks.length){
      h+='<div style="text-align:center;padding:60px 20px;color:var(--text3)"><div style="font-size:32px;margin-bottom:12px">📋</div><div style="font-size:14px">История пуста</div></div>';
    } else if(hm!=='client'){
      var byDate={};
      doneTasks.forEach(function(t){if(!byDate[t.startIso])byDate[t.startIso]=[];byDate[t.startIso].push(t);});
      Object.keys(byDate).sort(function(a,b){return b.localeCompare(a);}).forEach(function(dateStr){
        var d=new Date(dateStr+'T00:00:00');
        var label=dateStr===iso?'Сегодня':d.getDate()+' '+MONTHS_RU[d.getMonth()]+' '+d.getFullYear();
        h+='<div style="margin-bottom:16px"><div style="font-size:11px;'+MONO+';color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">'+label+'</div>';
        byDate[dateStr].forEach(function(t){
          var c=clients.find(function(x){return x.id===t.cid;});
          var flow=(t.cid?getFlows(t.cid):[]).find(function(f){return f.id===t.flowId;});
          var val=flow?flow.count*0.60:0;
          h+='<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:18px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.07);margin-bottom:5px">';
          h+='<span style="color:var(--green)">✓</span><div style="flex:1"><div style="font-size:13px;font-weight:500">⚡ '+esc(t.text)+'</div>';
          if(c) h+='<div style="font-size:11px;color:var(--text3)">'+esc(c.name)+'</div>';
          h+='</div>';
          if(val) h+='<span style="'+MONO+';font-size:12px;color:var(--green);font-weight:600">+$'+val.toFixed(2)+'</span>';
          h+='<button onclick="event.stopPropagation();_rmTask(this)" data-tid="'+t.id+'" style="background:none;border:none;color:rgba(255,100,100,.5);cursor:pointer;font-size:14px;padding:0 4px;margin-left:4px">✕</button>';
          h+='</div>';
        });
        h+='</div>';
      });
    } else {
      var byClient={};
      doneTasks.forEach(function(t){var key=t.cid||'x';if(!byClient[key])byClient[key]=[];byClient[key].push(t);});
      Object.keys(byClient).forEach(function(cid){
        var c=clients.find(function(x){return x.id===cid;});
        var ctasks=byClient[cid];
        var ctotal=ctasks.reduce(function(s,t){var fl=(c?getFlows(cid):[]).find(function(f){return f.id===t.flowId;});return s+(fl?fl.count*0.60:0);},0);
        h+='<div style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);border-radius:20px;margin-bottom:12px;overflow:hidden">';
        h+='<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,.06)"><div style="font-size:13px;font-weight:600">'+(c?esc(c.name):'Без клиента')+'</div><div style="'+MONO+';font-size:12px;color:var(--green)">$'+ctotal.toFixed(2)+'</div></div>';
        ctasks.forEach(function(t){
          var d=new Date(t.startIso+'T00:00:00');
          var ds=d.getDate()+' '+MONTHS_RU[d.getMonth()];
          var fl=(c?getFlows(cid):[]).find(function(f){return f.id===t.flowId;});
          var val=fl?fl.count*0.60:0;
          h+='<div style="display:flex;align-items:center;gap:12px;padding:10px 16px;border-bottom:1px solid rgba(255,255,255,.04)">';
          h+='<span style="color:var(--green)">✓</span><div style="flex:1;font-size:13px;font-weight:500">⚡ '+esc(t.text)+'</div>';
          h+='<span style="'+MONO+';font-size:11px;color:var(--text3)">'+ds+'</span>';
          if(val) h+='<span style="'+MONO+';font-size:12px;color:var(--green);font-weight:600;margin-left:8px">+$'+val.toFixed(2)+'</span>';
          h+='<button onclick="event.stopPropagation();_rmTask(this)" data-tid="'+t.id+'" style="background:none;border:none;color:rgba(255,100,100,.5);cursor:pointer;font-size:14px;padding:0 4px;margin-left:6px">✕</button>';
          h+='</div>';
        });
        h+='</div>';
      });
    }
  }

  h+='</div>';
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
  flows.push({id:'fl_'+Date.now(), name:name, count:count, deadline:deadline});
  saveFlows(_flowModalCid, flows);
  closeFlowModal();
  _sfx.play('done');
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
  // One-time model: each flow counts ONCE. A flow is "issued" once it has a
  // done task (in scope); earned = issued flows, potential = all flows.
  const flows=getFlows(cid);
  if(!flows.length) return {earned:0,potential:0,tasks:[]};
  const tasks=load('dc_plantasks',{});
  let earned=0, potential=0;
  const list=[];
  flows.forEach(f=>{
    const val=f.count*0.60;
    const issuedTask=Object.values(tasks).find(t=>
      t.cid===cid && t.flowId===f.id && t.done && (scope!=='month'||_inZone(t.startIso)));   // active zone only
    potential+=val;
    if(issuedTask) earned+=val;
    list.push({flow:f, val, done:!!issuedTask, task:issuedTask||null});
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


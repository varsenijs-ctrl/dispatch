let financeSelectedCid=null;let financeScope='all';   // 'all' = все месяцы вместе (default) · 'month' = активная зона. Toggle in the Finance header.

// Single source of truth for earnings totals — used by BOTH Finance and Home so
// the two earnings blocks always agree. Counts email (yes/draft) + flows +
// invoices; skips pay-disabled days; SMS days pay the higher rate.
// read a month-namespaced key for a specific month (not just the active one)
function _loadM(base, mk, def){ try{ const v=localStorage.getItem(base+'__'+mk); return v==null?def:(JSON.parse(v)??def); }catch(e){ return def; } }

// Label the Finance header with the active work-zone (month), e.g. "июль 2026".
function _finZoneLabel(){ try{ var p=(activeMonth||'').split('-'); if(p.length<2) return ''; var mi=parseInt(p[1],10)-1; return (MONTHS_RU[mi]||'')+' '+p[0]; }catch(e){ return ''; } }

// Per-client dated entries for the CURRENT work space (zone) only — zones are
// independent, so we never read other months' buckets. 'all' = every date in this
// zone; 'month' = only dates whose calendar month matches the zone.
// Each entry: {iso, v, sms, disabled, cid, rate}.
function _clientEntries(name){
  const res=[];
  const days=historyData[name]||{};
  let cid=null; clients.forEach(c=>{ if(c&&c.name===name) cid=c.id; });
  const sms=load('dc_sms_days',{}), dis=load('dc_pay_disabled',{});
  const cidSms=(cid&&sms[cid])||{}, cidDis=(cid&&dis[cid])||{};
  Object.keys(days).forEach(iso=>{
    if(!_inZone(iso)) return;   // active zone only — dates of THIS zone's month
    res.push({iso, v:days[iso], sms:!!cidSms[iso], disabled:!!cidDis[iso], cid, rate:cidSms[iso]?SMS_DAY_RATE:EMAIL_RATE});
  });
  return res;
}

// Totals for the CURRENT work space (zone) only — zones are independent, never
// summed together. 'all' = everything in this zone; 'month' = only dates whose
// calendar month matches the zone.
// Totals for the ACTIVE zone only (this month's slice) — fully independent of other
// zones. scope is ignored; a zone always shows only what was done in it.
function computeFinanceTotals(scope){
  const smsDays=load('dc_sms_days',{});const dis=load('dc_pay_disabled',{});
  let earned=0,potential=0,sentCount=0,totalCount=0;
  _zac().forEach(c=>{                              // only clients added to THIS zone
    const cidSms=smsDays[c.id]||{};const cidDis=dis[c.id]||{};const hist=historyData[c.name]||{};
    Object.entries(hist).forEach(([d,v])=>{
      if(!_inZone(d)) return;                 // this zone's month only
      if(cidDis[d])return;
      const rate=cidSms[d]?SMS_DAY_RATE:EMAIL_RATE;
      if(v==='yes'||v==='draft'){earned+=rate;potential+=rate;sentCount++;totalCount++;}
      else if(v==='no'){potential+=rate;totalCount++;}
    });
    const fe=getFlowEarnings(c.id,'month');earned+=fe.earned;potential+=fe.potential;
  });
  const invTotal=invoiceTotalForScope('month');
  earned+=invTotal;potential+=invTotal;
  return {earned:earned,potential:potential,sentCount:sentCount,totalCount:totalCount,invTotal:invTotal};
}
function renderFinance(){
  const mk=monthKey(getTODAY());const smsDays=load('dc_sms_days',{});const dis=load('dc_pay_disabled',{});
  const ac=_zac().sort((a,b)=>a.name.localeCompare(b.name,'ru'));   // only THIS zone's clients
  const _T=computeFinanceTotals(financeScope);
  const invTotal=_T.invTotal;
  const totalWithInv=_T.earned;
  const totalPotentialWithInv=_T.potential;
  const earnPct=totalPotentialWithInv?Math.round(totalWithInv/totalPotentialWithInv*100):0;
  let clientRows='';
  ac.forEach(c=>{
    const entries=_clientEntries(c.name); let ce=0,cp=0,cDone=0,cTotal=0;
    entries.forEach(e=>{ cTotal++;
      if(e.v==='yes'||e.v==='draft'){ cDone++; if(!e.disabled) ce+=e.rate; }
      if(!e.disabled&&(e.v==='yes'||e.v==='no'||e.v==='draft')) cp+=e.rate; });
    const cfe=getFlowEarnings(c.id, 'month');
    ce+=cfe.earned; cp+=cfe.potential;
    // every client added to this zone is shown (even at $0 — you'll mark it here)
    const isSel=financeSelectedCid===c.id;
    clientRows+=`<div onclick="_sfx.play('click');financeSelectedCid='${c.id}';render()" style="display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,.05);transition:background .15s;background:${isSel?'rgba(var(--accent-rgb),.1)':'none'}">
      <div style="flex:1;overflow:hidden">
        <div style="font-size:12px;font-weight:${isSel?600:400};color:${isSel?'var(--green)':'var(--text)'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.name)}</div>
        <div style="font-family:var(--mono);font-size:10px;color:var(--text3);margin-top:2px">${cDone}/${cTotal} мейлов</div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-family:var(--mono);font-size:11px;color:${ce>0?'var(--green)':'var(--text3)'};font-weight:600">$${ce.toFixed(2)}</div>
        <div style="font-family:var(--mono);font-size:10px;color:var(--text3)">/ $${cp.toFixed(2)}</div>
      </div>
    </div>`;
  });
  const detailHtml=financeSelectedCid?renderFinanceDetail(financeSelectedCid,financeScope):'<div style="color:var(--text3);font-size:13px;padding:24px;text-align:center;font-family:var(--mono)">← выбери клиента</div>';
  // Mobile: the side-by-side grid stacks, so a selected client's report ends up
  // far below the list. Show it full-width with a back button instead.
  const _finMobile = typeof window!=='undefined' && window.matchMedia && window.matchMedia('(max-width:720px)').matches;
  if(_finMobile && financeSelectedCid){
    const selName=(clients.find(x=>x.id===financeSelectedCid)||{}).name||'';
    return `<div style="max-width:860px">
      <div class="section-header" style="margin-bottom:14px;align-items:center;gap:10px">
        <button class="toggle-btn" style="font-size:12px;padding:5px 12px" onclick="financeSelectedCid=null;render()">← Клиенты</button>
        <h2 style="font-size:18px;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(selName)}</h2>
      </div>
      <div style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:16px">${detailHtml}</div>
    </div>`;
  }
    return `<div style="max-width:860px"><div class="section-header" style="margin-bottom:12px;align-items:center;gap:10px"><h2>Финансы 💰</h2><span style="font-family:var(--mono);font-size:12px;color:var(--text3)">${_finZoneLabel()}</span></div>
    <div class="earn-card" style="background:linear-gradient(135deg,rgba(var(--accent-rgb),.1),rgba(48,209,88,.05));border:1px solid rgba(var(--accent-rgb),.2);border-radius:22px;padding:18px 22px;margin-bottom:16px;display:flex;gap:28px;align-items:center;flex-wrap:wrap">
      <div><div style="font-size:11px;color:var(--text3);font-family:var(--mono);letter-spacing:.06em;text-transform:uppercase;margin-bottom:4px">Заработано</div><div style="font-size:30px;font-weight:700;color:var(--green);line-height:1">$${totalWithInv.toFixed(2)}</div></div>
      <div style="width:1px;height:40px;background:rgba(255,255,255,.1)"></div>
      <div><div style="font-size:11px;color:var(--text3);font-family:var(--mono);letter-spacing:.06em;text-transform:uppercase;margin-bottom:4px">Максимум</div><div style="font-size:30px;font-weight:700;color:var(--text);line-height:1">$${totalPotentialWithInv.toFixed(2)}</div></div>
      <div style="flex:1;min-width:150px"><div style="display:flex;justify-content:space-between;margin-bottom:5px"><span style="font-size:11px;color:var(--text3);font-family:var(--mono)">выполнено</span><span style="font-size:11px;color:var(--green);font-family:var(--mono);font-weight:600">${earnPct}%</span></div><div style="height:5px;background:rgba(255,255,255,.08);border-radius:12px;overflow:hidden"><div style="width:${earnPct}%;height:100%;background:var(--green);border-radius:12px;box-shadow:0 0 6px var(--green-glow)"></div></div><div style="margin-top:5px;font-size:11px;color:var(--text3);font-family:var(--mono)">осталось: <span style="color:var(--amber)">$${(totalPotentialWithInv-totalWithInv).toFixed(2)}</span>${invTotal>0?` <span style="color:var(--text3)">+$${invTotal.toFixed(2)} инвойсы</span>`:""}</div></div>
    </div>
    <div style="display:grid;grid-template-columns:260px 1fr;gap:12px;align-items:start">
      <div style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:20px;overflow:hidden">${clientRows}</div>
      <div style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:16px;min-height:200px">${detailHtml}</div>
    </div></div>`;
}
function renderFinanceDetail(cid,scope){
  const c=clients.find(x=>x.id===cid);if(!c)return '';
  const valColor={'yes':'var(--green)','no':'var(--red)','draft':'var(--purple)'};
  const fe=getFlowEarnings(cid, 'month');
  let earned=fe.earned,potential=fe.potential,rowsHtml='';
  // One row per flow (issued or not) — count matches the client's actual flows.
  fe.tasks.forEach(function(ft){
    rowsHtml+=`<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:14px;margin-bottom:4px;background:rgba(251,191,36,.06);border:1px solid rgba(251,191,36,.12)">
      <span style="font-size:11px;padding:2px 9px;border-radius:13px;background:rgba(251,191,36,.14);color:var(--amber);font-family:var(--mono);font-weight:600">⚡ ${esc(ft.flow.name)}</span>
      <div style="font-family:var(--mono);font-size:11px;color:var(--text3)">${ft.flow.count}✉</div>
      <div style="font-size:11px;color:${ft.done?'var(--green)':'var(--text3)'}">${ft.done?'✓ выставлен':'не выставлен'}</div>
      <div style="flex:1"></div>
      <div style="font-family:var(--mono);font-size:13px;color:${ft.done?'var(--green)':'var(--text3)'};font-weight:${ft.done?600:400}">$${ft.done?ft.val.toFixed(2):'0.00'}</div>
    </div>`;
  });
  const entries=_clientEntries(c.name).sort((a,b)=>b.iso.localeCompare(a.iso));
  entries.forEach(e=>{
    const v=e.v, rate=e.rate, disabled=e.disabled;
    const dayEarned=((v==='yes'||v==='draft')&&!disabled)?rate:0;
    if(!disabled&&(v==='yes'||v==='no'||v==='draft'))potential+=rate;
    earned+=dayEarned;
    const dt=new Date(e.iso+'T00:00:00');
    const smsTag=e.sms?'<span style="font-size:9px;padding:1px 6px;border-radius:13px;background:rgba(var(--accent-rgb),.12);color:var(--green);font-family:var(--mono);font-weight:600">SMS</span>':'<span style="min-width:30px;display:inline-block"></span>';
    const disCid=e.cid||cid;
    const disBtn=`<button onclick="togglePayDisabled('${disCid}','${e.iso}')" style="font-family:var(--mono);font-size:10px;padding:3px 9px;border-radius:14px;border:1px solid ${disabled?'rgba(var(--accent-rgb),.3)':'rgba(255,255,255,.12)'};background:${disabled?'rgba(var(--accent-rgb),.1)':'none'};color:${disabled?'var(--green)':'var(--text3)'};cursor:pointer;white-space:nowrap">${disabled?'включить':'откл.'}</button>`;
    rowsHtml+=`<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:14px;margin-bottom:4px;background:rgba(255,255,255,.06);${disabled?'opacity:.4':''}"><div style="font-family:var(--mono);font-size:11px;color:var(--text3);min-width:90px">${fmtDate(dt)} ${DAYS_RU[dt.getDay()]}</div><div style="font-size:11px;font-weight:600;color:${valColor[v]||'var(--text3)'};min-width:36px">${v}</div>${smsTag}<div style="font-family:var(--mono);font-size:12px;color:${disabled?'var(--text3)':dayEarned>0?'var(--green)':'var(--text3)'};font-weight:${dayEarned>0?600:400};min-width:50px">${disabled?'—':dayEarned>0?'$'+dayEarned.toFixed(2):'$0.00'}</div><div style="flex:1"></div>${disBtn}</div>`;
  });
  return `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px"><div style="font-size:14px;font-weight:600">${esc(c.name)}</div><div style="font-family:var(--mono);font-size:13px;color:var(--green);font-weight:700">$${earned.toFixed(2)} <span style="color:var(--text3);font-weight:400;font-size:11px">/ $${potential.toFixed(2)}</span></div></div><div style="max-height:480px;overflow-y:auto">${rowsHtml||'<div style="color:var(--text3);font-size:12px;font-family:var(--mono)">Нет данных</div>'}</div>`;
}

function flowDeadlineBadge(deadline){
  if(!deadline) return '';
  const dl = new Date(deadline+'T00:00:00');
  const diff = Math.ceil((dl - new Date(getTODAY().toDateString())) / 86400000);
  if(diff < 0)  return '<span style="font-family:var(--mono);font-size:10px;padding:2px 8px;border-radius:14px;background:rgba(248,113,113,.18);color:var(--red);border:1px solid rgba(248,113,113,.25)">просрочен '+(Math.abs(diff))+'д</span>';
  if(diff === 0) return '<span style="font-family:var(--mono);font-size:10px;padding:2px 8px;border-radius:14px;background:rgba(248,113,113,.15);color:var(--red)">сегодня!</span>';
  if(diff <= 3)  return '<span style="font-family:var(--mono);font-size:10px;padding:2px 8px;border-radius:14px;background:rgba(251,191,36,.15);color:var(--amber)">'+diff+'д</span>';
  if(diff <= 7)  return '<span style="font-family:var(--mono);font-size:10px;padding:2px 8px;border-radius:14px;background:rgba(255,255,255,.07);color:var(--text3)">'+diff+'д</span>';
  return '<span style="font-family:var(--mono);font-size:10px;color:var(--text3)">'+diff+'д</span>';
}
let clientsSort='alpha';
function renderClients(){
  // Per-zone: this tab shows ONLY the clients you added to the active zone. The
  // global pool (dc_clients) is untouched — clients are pulled from it into a zone
  // via the picker below. Removing here only takes a client OUT of this zone.
  const active=_zoneClients().filter(c=>c.active);
  const sorted=[...active].sort((a,b)=>{
    if(clientsSort==='alpha')return a.name.localeCompare(b.name,'ru');
    if(clientsSort==='count')return clientSentCount(a)-clientSentCount(b);
    if(clientsSort==='deadline'){const da=a.deadline?new Date(a.deadline+'T00:00:00').getTime():Infinity;const db=b.deadline?new Date(b.deadline+'T00:00:00').getTime():Infinity;return da-db;}
    return 0;
  });
  let html=`<div class="section-header"><h2>Клиенты</h2><span class="badge badge-done">${active.length}</span><span style="font-family:var(--mono);font-size:12px;color:var(--text3);margin-left:8px">${_finZoneLabel()} · только эта зона</span></div>`;
  html+=renderImportBox();
  html+=`<div class="sort-tabs"><span style="font-size:10px;color:var(--text3);align-self:center;font-family:var(--mono)">сортировка:</span><button class="sort-tab ${clientsSort==='alpha'?'active':''}" onclick="setClientsSort('alpha')">А→Я</button><button class="sort-tab ${clientsSort==='count'?'active':''}" onclick="setClientsSort('count')">меньше отправлено</button><button class="sort-tab ${clientsSort==='deadline'?'active':''}" onclick="setClientsSort('deadline')">дедлайн</button></div>`;
  if(!sorted.length){
    html+=`<div style="text-align:center;padding:26px 18px;color:var(--text3);font-family:var(--mono);font-size:13px;line-height:1.6;background:rgba(255,255,255,.04);border:1px dashed rgba(255,255,255,.12);border-radius:18px;margin-bottom:14px">В зоне «${_finZoneLabel()}» пока нет клиентов.<br>Добавь нужных ниже — список берётся из твоей общей базы,<br>старые данные никуда не делись.</div>`;
  }
  sorted.forEach(c=>{
    const hasHistory=historyData[c.name]&&Object.keys(historyData[c.name]).length>0;
    const ld=lastDoneInfo(c);
    const isPaused = c.paused||false;
    const clientFlows=getFlows(c.id);
    html+=`<div class="client-row${isPaused?' completed-today':''}" onclick="openCal('${c.id}')" style="${isPaused?'opacity:.45':''}">
      <div onclick="event.stopPropagation()" style="display:flex;align-items:center;justify-content:center"><button class="del-btn" onclick="event.stopPropagation();removeClientFromZone('${c.id}')" title="Убрать из этой зоны (данные не удаляются)">✕</button></div>
      <div><div style="display:flex;align-items:center;gap:4px"><span class="client-name">${esc(c.name)}</span>${deadlineBadge(c,true)}${isPaused?'<span class="badge badge-pending" style="margin-left:4px">пауза</span>':''}${hasHistory?`<span class="badge badge-done" style="margin-left:4px">история</span>`:''}</div><div class="client-sub">${ld.text} · ${clientSentCount(c)} отпр.</div></div>
      <div onclick="event.stopPropagation()" style="display:flex;flex-direction:column;gap:4px"><input type="date" class="deadline-edit" data-id="${c.id}" value="${c.deadline||''}" style="background:var(--glass);border:1px solid var(--glass-border2);color:var(--text);font-size:11px;padding:3px 6px;border-radius:10px;outline:none;color-scheme:dark" title="дедлайн"><div style="font-size:10px;color:${c.deadline?'var(--amber)':'var(--text3)'};font-family:var(--mono)">${c.deadline?'до '+fmtDate(new Date(c.deadline+'T00:00:00')):'нет дедлайна'}</div></div>
      <div onclick="event.stopPropagation()" style="display:flex;flex-direction:column;align-items:flex-start;gap:6px">
        <span style="font-size:10px;color:var(--text3);font-family:var(--mono);letter-spacing:.04em">SMS</span>
        <button class="ios-switch${c.smsEnabled?' on':''}" data-action="toggle-sms-client" data-id="${c.id}" role="switch" aria-checked="${c.smsEnabled?'true':'false'}" title="SMS вкл/выкл"><span class="ios-knob"></span></button>
      </div>
      <div onclick="event.stopPropagation()" style="display:flex;flex-direction:column;gap:4px">
        <button class="toggle-btn" onclick="togglePauseClient('${c.id}')" style="font-size:10px;padding:4px 8px;color:${isPaused?'var(--green)':' var(--amber)'};border-color:${isPaused?'rgba(var(--accent-rgb),.3)':' rgba(255,214,10,.3)'}">${isPaused?'▶':' ⏸'} ${isPaused?'возобновить':' пауза'}</button>
        <button onclick="event.stopPropagation();addFlow('${c.id}')" class="flow-add-btn" style="font-size:10px;padding:4px 8px">⚡ флоу</button>
      </div>
    </div>
    <div style="padding:7px 16px 9px;border-top:1px solid rgba(255,255,255,.05);display:flex;flex-wrap:wrap;gap:6px;align-items:center" onclick="event.stopPropagation()">

    </div>`;
  });
  html+=renderZonePool();
  html+=renderAddForm();return html;
}

// Picker: pull existing clients from the global pool into the ACTIVE zone. Nothing
// is added automatically — the user clicks each one (or "добавить всех").
function renderZonePool(){
  const pool=_poolNotInZone().sort((a,b)=>a.name.localeCompare(b.name,'ru'));
  let h=`<div class="add-section" style="margin-bottom:14px"><div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:10px"><h3 style="margin:0">Добавить клиента в зону <span style="font-family:var(--mono);font-size:11px;color:var(--text3);font-weight:400">(${_finZoneLabel()})</span></h3>`;
  if(pool.length) h+=`<button class="toggle-btn" style="font-size:11px;padding:4px 10px" onclick="addAllToZone()">＋ добавить всех (${pool.length})</button>`;
  h+=`</div>`;
  if(!pool.length){ h+=`<div style="font-size:12px;color:var(--text3);font-family:var(--mono)">Все клиенты из базы уже в этой зоне.</div></div>`; return h; }
  h+=`<input id="zone-pool-search" placeholder="поиск клиента из базы…" oninput="_filterZonePool(this.value)" style="width:100%;box-sizing:border-box;background:var(--glass);border:1px solid var(--glass-border2);color:var(--text);font-size:12px;padding:7px 10px;border-radius:12px;outline:none;margin-bottom:10px">`;
  h+=`<div id="zone-pool-chips" style="display:flex;flex-wrap:wrap;gap:6px">`;
  pool.forEach(c=>{
    h+=`<button class="zone-pool-chip" data-name="${esc(c.name).toLowerCase()}" onclick="addClientToZone('${c.id}')" title="Добавить в зону" style="display:inline-flex;align-items:center;gap:5px;padding:5px 11px;border-radius:16px;border:1px solid rgba(var(--accent-rgb),.25);background:rgba(var(--accent-rgb),.08);color:var(--text);font-size:12px;cursor:pointer;font-family:'Inter',sans-serif"><span style="color:var(--accent);font-weight:700">＋</span> ${esc(c.name)}</button>`;
  });
  h+=`</div></div>`;
  return h;
}
function _filterZonePool(q){
  q=(q||'').trim().toLowerCase();
  document.querySelectorAll('#zone-pool-chips .zone-pool-chip').forEach(function(el){
    el.style.display = (!q || (el.dataset.name||'').indexOf(q)>=0) ? '' : 'none';
  });
}
function addClientToZone(cid){ _sfx.play('click'); _addToRoster(cid); render(); }
function removeClientFromZone(cid){ _sfx.play('delete'); _removeFromRoster(cid); render(); }
function addAllToZone(){
  var m=_rosterMap(); var mk=activeMonth; if(!Array.isArray(m[mk])) m[mk]=[];
  _poolNotInZone().forEach(function(c){ if(m[mk].indexOf(c.id)<0) m[mk].push(c.id); });
  save('dc_zone_roster', m); _sfx.play('done'); render();
}

function renderFlowTags(cid){
  var fl=getFlows(cid);
  if(!fl.length) return '';
  return fl.map(function(f){
    var oc="deleteFlow('"+cid+"','"+f.id+"');render()";
    return '<span class="flow-tag">⚡ '+esc(f.name)
      +' <span style="opacity:.6;font-size:10px">'+f.count+'✉</span>'
      +' <span onclick="event.stopPropagation();'+oc+'" style="cursor:pointer;opacity:.55;font-size:14px;padding:0 3px;line-height:1">✕</span>'
      +'</span>';
  }).join(' ');
}
function setClientsSort(s){clientsSort=s;render();}
function renderImportBox(){
  return `<div class="import-box"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px"><h3 style="margin:0">Импорт из таблицы</h3><span style="font-size:11px;color:var(--text3);font-family:var(--mono)">⌘A → ⌘C → вставить сюда</span></div><div style="font-size:12px;color:var(--text3);margin-bottom:10px;line-height:1.6">Открой Google Sheets, выдели всё <kbd style="background:var(--glass2);padding:1px 5px;border-radius:10px;font-size:11px">⌘A</kbd>, скопируй <kbd style="background:var(--glass2);padding:1px 5px;border-radius:10px;font-size:11px">⌘C</kbd> и вставь ниже.</div><textarea id="paste-data" placeholder="Вставь сюда скопированные данные из таблицы..." style="width:100%;height:90px;background:var(--glass);border:1px solid var(--glass-border2);color:var(--text);font-family:var(--mono);font-size:11px;padding:8px;border-radius:10px;outline:none;resize:vertical;line-height:1.4" onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='var(--glass-border2)'"></textarea><div style="display:flex;gap:8px;margin-top:8px;align-items:center;flex-wrap:wrap"><button class="btn-add" onclick="importFromPaste()">Импортировать</button><button class="toggle-btn" onclick="resetToInitial()" style="color:var(--red);border-color:rgba(255,69,58,.3)">↺ сброс до таблицы</button><div class="import-status" id="import-status" style="margin:0"></div></div><div style="border-top:1px solid var(--glass-border2);margin-top:14px;padding-top:14px"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px"><h3 style="margin:0">Бэкап данных</h3><span style="font-size:11px;color:var(--text3);font-family:var(--mono)">JSON</span></div><div style="font-size:12px;color:var(--text3);margin-bottom:10px;line-height:1.6">Сохрани все данные в файл или восстанови из бэкапа. Используй экспорт, если переносишь приложение в новую папку — данные браузера привязаны к адресу страницы.</div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn-add" onclick="exportData()">⬇ Экспорт в файл</button><button class="toggle-btn" onclick="importData()">⬆ Импорт из файла</button></div></div>${typeof renderSyncPanel==='function'?renderSyncPanel():''}${typeof renderSheetSyncPanel==='function'?renderSheetSyncPanel():''}</div>`;
}
function renderAddForm(){
  return `<div class="add-section"><h3>Добавить клиента</h3><div class="form-row"><div class="form-field"><label>Имя клиента</label><input id="new-name" placeholder="CozyGirl..."></div><div class="form-field"><label>Дедлайн (опц.)</label><input id="new-deadline" type="date" style="color-scheme:dark"></div><div class="form-field"><label>SMS</label><button type="button" id="new-sms" class="ios-switch" role="switch" aria-checked="false" onclick="_iosSwitch(this)" title="SMS вкл/выкл" style="margin-top:3px"><span class="ios-knob"></span></button></div><button class="btn-add" onclick="addClient()">+ добавить</button></div><div style="margin-top:10px"><label style="font-size:10px;color:var(--text3);font-family:var(--mono);letter-spacing:.05em;display:block;margin-bottom:6px">РАСПИСАНИЕ (необязательно)</label><div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center"><select id="new-schedule" style="background:var(--glass);border:1px solid var(--glass-border2);color:var(--text);font-family:'Inter',sans-serif;font-size:12px;padding:6px 8px;border-radius:10px;outline:none"><option value="">— без расписания —</option><option value="monthly">Каждый день</option><option value="interval">Каждые N дней</option><option value="weekly">По дням недели</option></select><div id="schedule-extra" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"></div></div></div></div>`;
}
function addClient(){ _sfx.play('done');
  const name=document.getElementById('new-name')?.value?.trim();
  if(!name){_sfx.play('error');alert('Введи имя клиента');return;}
  // no duplicates: if a client with the same normalized name already exists in the
  // pool, just add THAT one to this zone instead of creating a near-duplicate.
  const dup=clients.find(x=>_normName(x.name)===_normName(name));
  if(dup){ _addToRoster(dup.id); showToast('«'+dup.name+'» уже есть — добавлен в зону'); const _n=document.getElementById('new-name'); if(_n)_n.value=''; render(); return; }
  const schedule=document.getElementById('new-schedule')?.value||'';
  const smsEnabled=document.getElementById('new-sms')?.classList.contains('on')||false;
  const deadline=document.getElementById('new-deadline')?.value||'';
  const id='c_'+Date.now();
  const c={id,name,active:true,smsEnabled,schedule,deadline:deadline||null};
  if(schedule==='interval'){c.interval=parseInt(document.getElementById('new-interval')?.value||'2',10);c.startDate=toISO(getTODAY());}
  if(schedule==='weekly')c.daysOfWeek=[...document.querySelectorAll('#schedule-extra input[type=checkbox]:checked')].map(x=>parseInt(x.value));
  const histMatch=Object.keys(historyData).find(k=>k.toLowerCase()===name.toLowerCase());
  if(histMatch&&histMatch!==name)historyData[name]=historyData[histMatch];
  clients.push(c);saveAll();_addToRoster(id);render();   // new client belongs to the zone it was created in
}
const INV_RATE = 0.50;

function loadInvoices(){ return load('dc_invoices',[]); }
function saveInvoices(inv){ save('dc_invoices',inv); }
function addInvoice(date,count,note){
  var inv=loadInvoices();
  inv.push({id:'inv_'+Date.now(),date:date,count:count,note:note||''});
  saveInvoices(inv);
}
function deleteInvoice(id){_sfx.play('delete');
  saveInvoices(loadInvoices().filter(function(i){return i.id!==id;}));
  render();
}
function invoiceTotalForScope(scope){
  return loadInvoices()
    .filter(function(i){return scope==='month'?_inZone(i.date):true;})   // active zone only
    .reduce(function(s,i){return s+i.count*INV_RATE;},0);
}
function _addInvoice(){_sfx.play('invoice');
  var dateEl=document.getElementById('inv-date');
  var countEl=document.getElementById('inv-count');
  var noteEl=document.getElementById('inv-note');
  var date=dateEl?dateEl.value:isoToday();
  var count=parseInt(countEl?countEl.value:'50')||50;
  var note=noteEl?noteEl.value:'';
  if(count<1){_sfx.play('error');return;}
  addInvoice(date||isoToday(),count,note);
  _sfx.play('done');
  showToast('+$'+(count*INV_RATE).toFixed(2)+' · '+count+' инвойсов');
  render();
}
function _setTod(btn){
  var wasActive=btn.classList.contains('active');
  document.querySelectorAll('#day-modal .tod-btn').forEach(function(b){b.classList.remove('active');});
  if(!wasActive) btn.classList.add('active');
  // Show night day toggle
  var ntog=document.getElementById('night-day-toggle');
  if(ntog) ntog.style.display=(btn.dataset.tod==='night'&&!wasActive)?'flex':'none';
}
function _setNightDay(btn){
  document.querySelectorAll('#night-day-toggle .tod-btn').forEach(function(b){b.classList.remove('active');});
  btn.classList.add('active');
}
function _isNightHour(val){
  if(!val) return false;
  var h=parseInt(val.split(':')[0]);
  return h>=21||h<6;
}
function _checkTimeNight(val){
  var ntog=document.getElementById('night-day-toggle');
  if(!ntog) return;
  // Show toggle if time is in night range AND night tod not already selected
  var activeTod=document.querySelector('#day-modal .tod-btn.active');
  var todIsNight=activeTod&&activeTod.dataset.tod==='night';
  if(_isNightHour(val)&&!todIsNight){
    ntog.style.display='flex';
  } else if(!_isNightHour(val)&&!todIsNight){
    ntog.style.display='none';
  }
}
function _getNightDay(){
  var btn=document.querySelector('#night-day-toggle .tod-btn.active');
  return btn?parseInt(btn.dataset.nday):0;
}
function _getTod(){
  var active=document.querySelector('.tod-btn.active');
  return active?active.dataset.tod:'';
}
function _addInvoiceFromPlanner(){
  var count=parseInt(document.getElementById('dm-inv-count')?.value||'50');
  if(!count||count<1){_sfx.play('error');return;}
  var date=currentDayIso||isoToday();
  addInvoice(date,count,'');
  _sfx.play('done');
  showToast('✓ '+count+' инвойсов — +$'+(count*INV_RATE).toFixed(2));
  var el=document.getElementById('dm-inv-count');
  if(el) el.value='50';
}

function renderInvoices(){
  var inv=loadInvoices().slice().sort(function(a,b){return b.date.localeCompare(a.date);});
  var mk=monthKey(getTODAY());
  var totalMonth=invoiceTotalForScope('month');
  var totalAll=invoiceTotalForScope('all');
  var countMonth=inv.filter(function(i){return i.date.startsWith(mk);}).reduce(function(s,i){return s+i.count;},0);

  var h='<div style="max-width:780px">';
  h+='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px"><h2 style="font-size:22px;font-weight:700">Инвойсы 📄</h2></div>';

  // Stats
  h+='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">';
  [['За месяц','$'+totalMonth.toFixed(2),'var(--green)'],
   ['Всего','$'+totalAll.toFixed(2),'var(--text)'],
   ['Штук за месяц',countMonth,'var(--amber)']].forEach(function(r){
    h+='<div style="background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.09);border-radius:20px;padding:16px 18px">';
    h+='<div style="font-size:11px;color:var(--text3);font-family:var(--mono);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">'+r[0]+'</div>';
    h+='<div style="font-size:28px;font-weight:700;color:'+r[2]+'">'+r[1]+'</div></div>';
  });
  h+='</div>';

  // Add form
  var today=isoToday();
  h+='<div style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.09);border-radius:20px;padding:18px;margin-bottom:20px">';
  h+='<div style="font-size:13px;font-weight:600;margin-bottom:14px">Добавить</div>';
  h+='<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">';
  h+='<div><label style="font-size:11px;color:var(--text3);font-family:var(--mono);display:block;margin-bottom:5px;letter-spacing:.06em">ДАТА</label>';
  h+='<input type="date" id="inv-date" value="'+today+'" style="color-scheme:dark;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);border-radius:16px;color:var(--text);font-size:13px;padding:8px 12px;outline:none"></div>';
  h+='<div><label style="font-size:11px;color:var(--text3);font-family:var(--mono);display:block;margin-bottom:5px;letter-spacing:.06em">КОЛ-ВО</label>';
  h+='<input type="number" id="inv-count" value="50" min="1" style="width:100px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);border-radius:16px;color:var(--text);font-size:13px;padding:8px 12px;outline:none"></div>';
  h+='<div style="flex:1"><label style="font-size:11px;color:var(--text3);font-family:var(--mono);display:block;margin-bottom:5px;letter-spacing:.06em">ЗАМЕТКА</label>';
  h+='<input type="text" id="inv-note" placeholder="необязательно" style="width:100%;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);border-radius:16px;color:var(--text);font-size:13px;padding:8px 12px;outline:none;box-sizing:border-box"></div>';
  h+='<button onclick="_addInvoice()" class="btn-add">+ добавить</button>';
  h+='</div></div>';

  // List
  if(!inv.length){
    h+='<div style="text-align:center;padding:40px;color:var(--text3);font-family:var(--mono)">Нет инвойсов — добавь первый</div>';
  } else {
    var curMonth='';
    inv.forEach(function(i){
      var m=i.date.slice(0,7);
      if(m!==curMonth){
        curMonth=m;
        var d=new Date(m+'-01T00:00:00');
        var months=['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
        h+='<div style="font-size:11px;color:var(--text3);font-family:var(--mono);text-transform:uppercase;letter-spacing:.06em;margin:16px 0 8px">'+months[d.getMonth()]+' '+d.getFullYear()+'</div>';
      }
      var dt=new Date(i.date+'T00:00:00');
      var ds=dt.getDate()+' '+['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'][dt.getMonth()];
      var amt=(i.count*INV_RATE).toFixed(2);
      h+='<div style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:18px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.07);margin-bottom:6px">';
      h+='<div style="font-family:var(--mono);font-size:11px;color:var(--text3);min-width:60px">'+ds+'</div>';
      h+='<div style="flex:1"><div style="font-size:13px;font-weight:500">'+i.count+' инвойсов</div>';
      if(i.note) h+='<div style="font-size:11px;color:var(--text3);margin-top:2px">'+esc(i.note)+'</div>';
      h+='</div>';
      h+='<div style="font-family:var(--mono);font-size:13px;color:var(--green);font-weight:600">+$'+amt+'</div>';
      h+='<button onclick="deleteInvoice(this.dataset.id)" data-id="'+i.id+'" style="background:none;border:none;color:rgba(255,100,100,.6);cursor:pointer;font-size:15px;padding:0 4px;margin-left:4px">✕</button>';
      h+='</div>';
    });
  }
  h+='</div>';
  return h;
}


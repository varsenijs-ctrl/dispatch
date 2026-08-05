let financeSelectedCid=null;let financeScope='all';   // 'all' = все месяцы вместе (default) · 'month' = активная зона. Toggle in the Finance header.
let financeFilter='all';   // Finance breakdown filter: all | email | sms | flows | invoices
function setFinanceFilter(f){ financeFilter=f; render(); }

// Per-client earnings split into components for the active zone. An email-day pays
// EMAIL_RATE (email part); an SMS day adds SMS_EXTRA on top (sms part). Flows are
// separate. Returns {email:{e,p}, sms:{e,p}, flows:{e,p}, doneN, totalN}.
function _clientFinanceParts(c){
  const smsDays=load('dc_sms_days',{}),dis=load('dc_pay_disabled',{});
  const cidSms=smsDays[c.id]||{},cidDis=dis[c.id]||{},hist=historyData[c.name]||{};
  let email=0,emailPot=0,sms=0,smsPot=0,doneN=0,totalN=0;
  Object.entries(hist).forEach(([d,v])=>{
    if(!_markInActiveZone(c.id,d))return;
    const isSms=!!cidSms[d], disabled=!!cidDis[d];
    if(v==='yes'||v==='draft'){ doneN++;totalN++; if(!disabled){ email+=EMAIL_RATE;emailPot+=EMAIL_RATE; if(isSms){sms+=SMS_EXTRA;smsPot+=SMS_EXTRA;} } }
    else if(v==='no'){ totalN++; if(!disabled){ emailPot+=EMAIL_RATE; if(isSms)smsPot+=SMS_EXTRA; } }
  });
  const fe=getFlowEarnings(c.id,'month');
  return {email:{e:email,p:emailPot}, sms:{e:sms,p:smsPot}, flows:{e:fe.earned,p:fe.potential}, doneN:doneN, totalN:totalN};
}
// Pick a client's {earned,potential} for a given filter (invoices aren't per-client → 0).
function _clientFinance(c, filter){
  const p=_clientFinanceParts(c);
  if(filter==='email') return {e:p.email.e,p:p.email.p, doneN:p.doneN,totalN:p.totalN};
  if(filter==='sms')   return {e:p.sms.e,  p:p.sms.p,   doneN:p.doneN,totalN:p.totalN};
  if(filter==='flows') return {e:p.flows.e,p:p.flows.p, doneN:p.doneN,totalN:p.totalN};
  if(filter==='invoices') return {e:0,p:0, doneN:p.doneN,totalN:p.totalN};
  return {e:p.email.e+p.sms.e+p.flows.e, p:p.email.p+p.sms.p+p.flows.p, doneN:p.doneN,totalN:p.totalN};
}

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
    if(!_markInActiveZone(cid, iso)) return;   // all of this zone's earnings (incl. "July for August"), no cross-zone bleed
    res.push({iso, v:days[iso], sms:!!cidSms[iso], disabled:!!cidDis[iso], cid, rate:cidSms[iso]?SMS_DAY_RATE:EMAIL_RATE});
  });
  return res;
}

// Totals for the CURRENT work space (zone) only — zones are independent, never
// summed together. 'all' = everything in this zone; 'month' = only dates whose
// calendar month matches the zone.
// Totals for the ACTIVE zone only (this month's slice) — fully independent of other
// zones. scope is ignored; a zone always shows only what was done in it.
function computeFinanceTotals(scope, filter){
  filter = filter || 'all';
  let email=0,emailPot=0,sms=0,smsPot=0,flows=0,flowsPot=0,sentCount=0,totalCount=0;
  _zac().forEach(c=>{                              // only clients added to THIS zone
    const p=_clientFinanceParts(c);
    email+=p.email.e; emailPot+=p.email.p; sms+=p.sms.e; smsPot+=p.sms.p; flows+=p.flows.e; flowsPot+=p.flows.p;
    sentCount+=p.doneN; totalCount+=p.totalN;
  });
  const invTotal=invoiceTotalForScope('month');
  let earned,potential;
  if(filter==='email'){ earned=email; potential=emailPot; }
  else if(filter==='sms'){ earned=sms; potential=smsPot; }
  else if(filter==='flows'){ earned=flows; potential=flowsPot; }
  else if(filter==='invoices'){ earned=invTotal; potential=invTotal; }
  else { earned=email+sms+flows+invTotal; potential=emailPot+smsPot+flowsPot+invTotal; }
  return {earned:earned,potential:potential,sentCount:sentCount,totalCount:totalCount,invTotal:invTotal,
          parts:{email:email,emailPot:emailPot,sms:sms,smsPot:smsPot,flows:flows,flowsPot:flowsPot,inv:invTotal}};
}
// ── Финансы — тотал + фильтры + по клиентам / по дням (по макету) ──
// Фильтры (Всё / Имейлы / SMS / Флоу / Инвойсы) и детализация клиента с кнопками
// «откл./включить» день сохранены.
function renderFinance(){
  const ac=_zac().sort((a,b)=>a.name.localeCompare(b.name,'ru'));
  const _T=computeFinanceTotals(financeScope,financeFilter);
  const P=_T.parts||{email:0,sms:0,flows:0,inv:0};
  const earned=_T.earned, potential=_T.potential;
  const pct=potential?Math.round(earned/potential*100):0;
  const parts=activeMonth.split('-'); const y=+parts[0], m=+parts[1];
  const daysInMonth=new Date(y,m,0).getDate();
  const smsDays=load('dc_sms_days',{}), disAll=load('dc_pay_disabled',{});

  // per-day earnings of the zone (emails+sms part; flows/invoices aren't per-day here)
  const byDay={};
  ac.forEach(c=>{
    const hist=historyData[c.name]||{}, cidSms=smsDays[c.id]||{}, cidDis=disAll[c.id]||{};
    Object.keys(hist).forEach(d=>{
      if(!_markInActiveZone(c.id,d))return;
      const v=hist[d]; if(v!=='yes'&&v!=='draft')return; if(cidDis[d])return;
      byDay[d]=(byDay[d]||0)+(cidSms[d]?SMS_DAY_RATE:EMAIL_RATE);
    });
  });
  const dayKeys=Object.keys(byDay).sort((a,b)=>b.localeCompare(a));
  const activeDays=dayKeys.length;
  const avgDay=activeDays?(P.email+P.sms)/activeDays:0;
  const forecast=avgDay*daysInMonth+P.flows+P.inv;
  const maxDay=dayKeys.reduce((mx,k)=>Math.max(mx,byDay[k]),0)||1;

  const FL=[['all','Всё',earnedAllOf(_T)],['email','Имейлы',P.email],['sms','SMS',P.sms],['flows','Флоу',P.flows],['invoices','Инвойсы',P.inv]];
  const FLABEL={all:'Заработано',email:'Только имейлы',sms:'Только SMS-надбавка',flows:'Только флоу',invoices:'Только инвойсы'};

  let html=`<div style="max-width:1040px">
    <div class="dcard dcard-lg" style="padding:22px 24px;margin-bottom:14px;display:flex;align-items:flex-end;gap:40px;flex-wrap:wrap">
      <div>
        <div class="dcaps">${FLABEL[financeFilter]||'Заработано'} · ${_finZoneLabel()}</div>
        <div class="dnum" style="font-size:46px;letter-spacing:-2.2px;color:var(--green);margin-top:5px;line-height:1">$${earned.toFixed(2)}</div>
      </div>
      <div style="padding-bottom:10px"><div class="dcaps">Средний день</div><div class="dnum" style="font-size:22px;letter-spacing:-.7px;margin-top:4px;color:var(--text)">$${avgDay.toFixed(2)}</div></div>
      <div style="padding-bottom:10px"><div class="dcaps">Прогноз месяца</div><div class="dnum" style="font-size:22px;letter-spacing:-.7px;margin-top:4px;color:var(--text2)">$${forecast.toFixed(2)}</div></div>
      <div style="flex:1;min-width:170px;padding-bottom:6px">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span class="dmeta">максимум $${potential.toFixed(2)}</span><span style="font-family:var(--mono);font-size:11px;color:var(--green);font-weight:600">${pct}%</span></div>
        <div style="height:8px;border-radius:980px;background:rgba(255,255,255,.06);overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,.4) inset"><div style="height:100%;border-radius:980px;background:linear-gradient(90deg,rgba(48,209,88,.75),#30d158);box-shadow:0 1px 0 rgba(255,255,255,.35) inset;transition:width .6s cubic-bezier(.2,.8,.2,1);width:${pct}%"></div></div>
        <div class="dmeta" style="margin-top:5px">осталось: <span style="color:#ffe066">$${(potential-earned).toFixed(2)}</span></div>
      </div>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">
      ${FL.map(f=>`<button class="dpill ${financeFilter===f[0]?'active':''}" onclick="setFinanceFilter('${f[0]}')">${f[1]}<span class="n">$${(f[2]||0).toFixed(2)}</span></button>`).join('')}
    </div>`;

  // ── по клиентам + по дням ──
  let clientRows='';
  if(financeFilter==='invoices'){
    clientRows=`<div class="dmeta" style="line-height:1.8">Инвойсы не привязаны к клиентам.<br>Сумма — в карточке выше, список — на вкладке «Инвойсы».<br><button class="dbtn dbtn-sm" style="margin-top:10px;font-family:var(--font)" onclick="setView('invoices')">→ Инвойсы</button></div>`;
  } else {
    const rows=ac.map(c=>{ const cf=_clientFinance(c,financeFilter); const p=_clientFinanceParts(c);
      return {c:c,e:cf.e,p:cf.p,em:Math.round(p.email.e/EMAIL_RATE),fl:Math.round(p.flows.e/0.6),sm:Math.round(p.sms.e/SMS_EXTRA)};
    }).sort((a,b)=>b.e-a.e);
    rows.forEach(r=>{
      const sel=financeSelectedCid===r.c.id;
      const detail=[r.em+'e',r.sm?r.sm+'s':'',r.fl?r.fl+'f':''].filter(Boolean).join(' · ');
      clientRows+=`<div class="drow" onclick="_sfx.play('click');financeSelectedCid='${sel?'':r.c.id}';render()" style="cursor:pointer;${sel?'background:rgba(64,203,224,.10)':''}">
        <div style="flex:1;min-width:0;font-size:13px;letter-spacing:-.1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;${sel?'color:var(--accent);font-weight:600':''}">${esc(r.c.name)}</div>
        <div class="dmeta">${detail}</div>
        <div style="font-family:var(--mono);font-size:12.5px;font-weight:600;width:60px;text-align:right;color:${r.e>0?'var(--green)':'var(--text3)'}">$${r.e.toFixed(2)}</div>
      </div>`;
    });
    if(!clientRows) clientRows=`<div class="dmeta">Нет клиентов в этой зоне.</div>`;
  }

  let dayRows='';
  dayKeys.slice(0,14).forEach(d=>{
    const dt=new Date(d+'T00:00:00');
    dayRows+=`<div style="display:flex;align-items:center;gap:11px">
      <div style="font-family:var(--mono);font-size:12px;width:52px;color:var(--text2)">${dt.getDate()} ${_MSHORT[dt.getMonth()]}</div>
      <div style="flex:1;height:7px;border-radius:980px;background:rgba(255,255,255,.06);overflow:hidden"><div style="height:100%;border-radius:980px;background:var(--accent);box-shadow:0 1px 0 rgba(255,255,255,.3) inset;width:${Math.round(byDay[d]/maxDay*100)}%"></div></div>
      <div style="font-family:var(--mono);font-size:12.5px;font-weight:600;width:54px;text-align:right">$${byDay[d].toFixed(2)}</div>
    </div>`;
  });
  if(!dayRows) dayRows=`<div class="dmeta">Пока нет отметок в этой зоне.</div>`;

  html+=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
    <div class="dcard dcard-p">
      <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:14px"><div class="dcard-t">По клиентам</div><div class="dmeta">клик — детали</div></div>
      <div style="display:flex;flex-direction:column;gap:2px;max-height:420px;overflow-y:auto">${clientRows}</div>
    </div>
    <div class="dcard dcard-p">
      <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:14px"><div class="dcard-t">Детализация по дням</div><div class="dmeta">${activeDays} дн.</div></div>
      <div style="display:flex;flex-direction:column;gap:11px;max-height:420px;overflow-y:auto">${dayRows}</div>
    </div>
  </div>`;

  if(financeSelectedCid){
    const selC=clients.find(x=>x.id===financeSelectedCid);
    html+=`<div class="dcard dcard-p" style="margin-top:12px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <div class="dcard-t">Детали · ${selC?esc(selC.name):''}</div>
        <div style="flex:1"></div>
        <button class="dbtn dbtn-sm" onclick="openCal('${financeSelectedCid}')">📅 календарь</button>
        <button class="dicon neutral" onclick="financeSelectedCid=null;render()" title="Закрыть">✕</button>
      </div>
      ${renderFinanceDetail(financeSelectedCid,financeScope)}
    </div>`;
  }
  html+=`</div>`;
  return html;
}
// «Всё» для кнопки-фильтра: сумма всех составляющих зоны
function earnedAllOf(T){ const P=T.parts||{}; return (P.email||0)+(P.sms||0)+(P.flows||0)+(P.inv||0); }

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
// ── Клиенты — панель добавления + таблица (по макету) ─────────
// Сохранено всё, что было: расписание, дедлайн, пауза, флоу, импорт вставкой,
// бэкап/экспорт, панели синхронизации, пул клиентов зоны, сортировки.
let clientsShowImport=false;
let clientsShowMore=false;
function toggleClientsImport(){ _sfx.play('click'); clientsShowImport=!clientsShowImport; render(); }
function toggleClientsMore(){ _sfx.play('click'); clientsShowMore=!clientsShowMore; render(); }
function _newSmsToggle(el){ _iosSwitch(el); }
function renderClients(){
  const active=_zoneClients().filter(c=>c.active);
  const sorted=[...active].sort((a,b)=>{
    if(clientsSort==='alpha')return a.name.localeCompare(b.name,'ru');
    if(clientsSort==='count')return clientSentCount(a)-clientSentCount(b);
    if(clientsSort==='money'){const ma=_clientFinanceParts(a),mb=_clientFinanceParts(b);return (mb.email.e+mb.sms.e+mb.flows.e)-(ma.email.e+ma.sms.e+ma.flows.e);}
    if(clientsSort==='deadline'){const da=a.deadline?new Date(a.deadline+'T00:00:00').getTime():Infinity;const db=b.deadline?new Date(b.deadline+'T00:00:00').getTime():Infinity;return da-db;}
    return 0;
  });
  const iso=isoToday();

  let html=`<div style="max-width:1040px">`;

  // ── add panel ──
  html+=`<div class="dcard" style="padding:14px 16px;margin-bottom:12px;display:flex;align-items:center;flex-wrap:wrap;gap:10px">
    <input id="new-name" class="dinput" placeholder="Название клиента" style="flex:1 1 220px;min-width:200px" onkeydown="if(event.key==='Enter')addClient()">
    <button class="dbtn" onclick="_newSmsToggle(document.getElementById('new-sms'))" style="gap:9px">SMS<span id="new-sms" class="dsw" role="switch" aria-checked="false"><i></i></span></button>
    <input type="date" id="new-deadline" class="dinput ddate" style="padding:9px 12px;font-size:12.5px" title="Дедлайн (необязательно)">
    <button class="dbtn dbtn-primary" onclick="addClient()" style="padding:10px 17px">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" style="flex:none"><path d="M12 5v14M5 12h14"/></svg>
      Добавить клиента
    </button>
    <div style="width:1px;height:24px;background:rgba(255,255,255,.08)"></div>
    <button class="dbtn${clientsShowImport?' on':''}" onclick="toggleClientsImport()" style="padding:10px 15px">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" style="flex:none"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2M9 2h6v4H9z"/></svg>
      Импорт вставкой
    </button>
    <button class="dbtn${clientsShowMore?' on':''}" onclick="toggleClientsMore()" title="Расписание и прочее">⋯ ещё</button>
    ${clientsShowMore?`<div style="flex:1 1 100%;display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding-top:10px;border-top:1px solid rgba(255,255,255,.07)">
      <span class="dmeta">расписание:</span>
      <select id="new-schedule" class="dinput dinput-sm" style="font-family:var(--font)">
        <option value="">— без расписания —</option><option value="monthly">Каждый день</option><option value="interval">Каждые N дней</option><option value="weekly">По дням недели</option>
      </select>
      <div id="schedule-extra" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"></div>
    </div>`:''}
  </div>`;

  if(clientsShowImport) html+=`<div style="margin-bottom:12px">${renderImportBox()}</div>`;

  // ── sort + count ──
  const SORTS=[['alpha','А→Я'],['money','по деньгам'],['count','меньше отправлено'],['deadline','дедлайн']];
  html+=`<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap">
    ${SORTS.map(s=>`<button class="dpill ${clientsSort===s[0]?'active':''}" onclick="setClientsSort('${s[0]}')">${s[1]}</button>`).join('')}
    <div style="flex:1"></div>
    <span class="dmeta">${active.length} в зоне «${_finZoneLabel()}»</span>
  </div>`;

  // ── table ──
  if(!sorted.length){
    // Пустая зона: сразу предлагаем перенести состав клиентов из прошлой зоны,
    // иначе приходится набирать список заново («работает только в одной зоне»).
    const _rm=_rosterMap();
    const _prevZ=Object.keys(_rm).filter(k=>k<activeMonth&&Array.isArray(_rm[k])&&_rm[k].length).sort().pop()
              || Object.keys(_rm).filter(k=>Array.isArray(_rm[k])&&_rm[k].length).sort()[0];
    const _prevLabel=_prevZ?(()=>{const p=_prevZ.split('-');return `${MONTHS_RU[+p[1]-1]} ${p[0]}`;})():'';
    html+=`<div class="dcard dcard-p" style="text-align:center;padding:28px 18px;color:var(--text3);font-family:var(--mono);font-size:13px;line-height:1.7">В зоне «${_finZoneLabel()}» пока нет клиентов.<br>Добавь нового выше или возьми из базы ниже —<br>старые данные никуда не делись.
      ${_prevZ?`<div style="margin-top:14px"><button class="dbtn dbtn-primary" style="font-family:var(--font)" onclick="copyRosterFromPrevZone()">↩ Перенести ${_rm[_prevZ].length} ${_plural(_rm[_prevZ].length,'клиента','клиентов','клиентов')} из «${_prevLabel}»</button></div>`:''}
    </div>`;
  } else {
    html+=`<div class="dcard" style="overflow:hidden">
      <div class="dth">
        <div style="flex:1">Клиент</div>
        <div style="width:52px;text-align:center">SMS</div>
        <div style="width:120px;text-align:right">Дедлайн</div>
        <div style="width:70px;text-align:right">Отправлено</div>
        <div style="width:48px;text-align:right">Флоу</div>
        <div style="width:76px;text-align:right">Заработок</div>
        <div style="width:104px"></div>
      </div>`;
    sorted.forEach(c=>{
      const p=_clientFinanceParts(c);
      const money=p.email.e+p.sms.e+p.flows.e;
      const nFlows=getFlows(c.id).length;
      const hasHistory=historyData[c.name]&&Object.keys(historyData[c.name]).length>0;
      const past=c.deadline&&c.deadline<iso;
      html+=`<div class="dtr" style="${c.paused?'opacity:.5':''}">
        <div style="flex:1;min-width:0;display:flex;align-items:center;gap:7px">
          <span onclick="openCal('${c.id}')" style="font-size:13.5px;font-weight:540;letter-spacing:-.15px;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="Открыть календарь">${esc(c.name)}</span>
          ${c.paused?'<span class="dchip dchip-warn">пауза</span>':''}
          ${hasHistory?'<span class="dchip dchip-dim">история</span>':''}
        </div>
        <div style="width:52px;display:flex;justify-content:center">
          <button class="dsw${c.smsEnabled?' on':''}" data-action="toggle-sms-client" data-id="${c.id}" role="switch" aria-checked="${c.smsEnabled?'true':'false'}" title="SMS вкл/выкл"><i></i></button>
        </div>
        <div style="width:120px;display:flex;justify-content:flex-end">
          <input type="date" class="deadline-edit dinput dinput-sm ddate" data-id="${c.id}" value="${c.deadline||''}" title="Дедлайн" style="font-size:11px;padding:4px 6px;${past?'color:#ff8078;border-color:rgba(255,69,58,.3)':''}">
        </div>
        <div style="width:70px;text-align:right;font-family:var(--mono);font-size:12.5px">${clientSentCount(c)}</div>
        <div style="width:48px;text-align:right;font-family:var(--mono);font-size:12.5px;color:${nFlows?'#d08bf5':'var(--text3)'}">${nFlows}</div>
        <div style="width:76px;text-align:right;font-family:var(--mono);font-size:12.5px;font-weight:600;color:${money>0?'var(--green)':'var(--text3)'}">$${money.toFixed(2)}</div>
        <div style="width:104px;display:flex;justify-content:flex-end;gap:4px">
          <button class="dicon neutral" onclick="event.stopPropagation();togglePauseClient('${c.id}')" title="${c.paused?'Возобновить':'Поставить на паузу'}">${c.paused?'▶':'⏸'}</button>
          <button class="dicon neutral" onclick="event.stopPropagation();addFlow('${c.id}')" title="Добавить флоу">⚡</button>
          <button class="dicon neutral" onclick="event.stopPropagation();openCal('${c.id}')" title="Календарь">📅</button>
          <button class="dicon" onclick="event.stopPropagation();removeClientFromZone('${c.id}')" title="Убрать из этой зоны (данные не удаляются)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
      </div>`;
    });
    html+=`</div>`;
  }

  // ── zone pool (pull clients from the global base into this zone) ──
  const pool=_poolNotInZone().sort((a,b)=>a.name.localeCompare(b.name,'ru'));
  html+=`<div class="dcard dcard-p" style="margin-top:12px">
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:${pool.length?'12px':'0'}">
      <div class="dcard-t">Добавить в зону из базы <span class="dmeta" style="font-weight:400">(${_finZoneLabel()})</span></div>
      ${pool.length?`<button class="dbtn dbtn-sm" onclick="addAllToZone()">＋ добавить всех (${pool.length})</button>`:''}
    </div>`;
  if(!pool.length){ html+=`<div class="dmeta">Все клиенты из базы уже в этой зоне.</div>`; }
  else {
    html+=`<input id="zone-pool-search" class="dinput dinput-sm" placeholder="поиск клиента из базы…" oninput="_filterZonePool(this.value)" style="width:100%;box-sizing:border-box;margin-bottom:10px">
      <div id="zone-pool-chips" style="display:flex;flex-wrap:wrap;gap:6px">`;
    pool.forEach(c=>{
      html+=`<button class="zone-pool-chip dbtn dbtn-sm" data-name="${esc(c.name).toLowerCase()}" onclick="addClientToZone('${c.id}')" title="Добавить в зону"><span style="color:var(--accent);font-weight:700">＋</span> ${esc(c.name)}</button>`;
    });
    html+=`</div>`;
  }
  html+=`</div></div>`;
  return html;
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

// ── Инвойсы — сводка + пачки по месяцам (по макету) ───────────
// Данные те же ({date,count,note}); добавлен флаг «оплачено», чтобы работали
// статусы и кнопка «Отметить оплаченной» из макета. Форма добавления сохранена.
let invOpenBatch=null;
function toggleInvBatch(mk){ _sfx.play('click'); invOpenBatch=(invOpenBatch===mk?null:mk); render(); }
function toggleInvoicePaid(id){
  const inv=loadInvoices();
  const it=inv.find(x=>x.id===id); if(!it) return;
  it.paid=!it.paid; saveInvoices(inv); _sfx.play(it.paid?'done':'click'); render();
}
function markBatchPaid(mk){
  const inv=loadInvoices();
  const list=inv.filter(i=>i.date.slice(0,7)===mk);
  const allPaid=list.length&&list.every(i=>i.paid);
  list.forEach(i=>{ i.paid=!allPaid; });
  saveInvoices(inv); _sfx.play(allPaid?'click':'done'); render();
}
function renderInvoices(){
  const inv=loadInvoices().slice().sort((a,b)=>b.date.localeCompare(a.date));
  const mkNow=monthKey(getTODAY());
  const total=inv.reduce((s,i)=>s+i.count*INV_RATE,0);
  const paidTotal=inv.filter(i=>i.paid).reduce((s,i)=>s+i.count*INV_RATE,0);
  const overdue=inv.filter(i=>!i.paid&&i.date.slice(0,7)<mkNow);
  const overdueTotal=overdue.reduce((s,i)=>s+i.count*INV_RATE,0);
  const monthTotal=invoiceTotalForScope('month');
  const countAll=inv.reduce((s,i)=>s+i.count,0);

  let h=`<div style="max-width:1040px">
    <div style="display:flex;gap:12px;margin-bottom:14px;flex-wrap:wrap">
      ${[['Выставлено','$'+total.toFixed(2),'var(--text)',countAll+' инвойсов'],
         ['Оплачено','$'+paidTotal.toFixed(2),'var(--green)',inv.filter(i=>i.paid).length+' пачек отмечено'],
         ['Просрочено','$'+overdueTotal.toFixed(2),overdueTotal>0?'#ff8078':'var(--text3)',overdue.length?overdue.length+' с прошлых месяцев':'всё чисто']].map(s=>
        `<div class="dcard" style="flex:1;min-width:170px;padding:15px 18px"><div class="dcaps">${s[0]}</div><div class="dnum" style="font-size:28px;letter-spacing:-1.1px;margin-top:7px;color:${s[2]}">${s[1]}</div><div style="font-size:11.5px;color:var(--text3);margin-top:2px">${s[3]}</div></div>`).join('')}
    </div>`;

  // add form (kept)
  h+=`<div class="dcard" style="padding:14px 16px;margin-bottom:14px;display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap">
    <div><div class="dcaps" style="margin-bottom:5px">Дата</div><input type="date" id="inv-date" class="dinput ddate" value="${isoToday()}" style="padding:9px 12px;font-size:12.5px"></div>
    <div><div class="dcaps" style="margin-bottom:5px">Кол-во</div><input type="number" id="inv-count" class="dinput" value="50" min="1" style="width:110px;padding:9px 12px;font-size:12.5px;font-family:var(--mono)"></div>
    <div style="flex:1;min-width:200px"><div class="dcaps" style="margin-bottom:5px">Заметка</div><input type="text" id="inv-note" class="dinput" placeholder="необязательно" style="width:100%;box-sizing:border-box;padding:9px 12px;font-size:12.5px"></div>
    <button class="dbtn dbtn-primary" onclick="_addInvoice()" style="padding:10px 17px">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" style="flex:none"><path d="M12 5v14M5 12h14"/></svg>Добавить</button>
    <span class="dmeta">1 инвойс = $${INV_RATE.toFixed(2)} · за ${MONTHS_RU[+mkNow.split('-')[1]-1]}: $${monthTotal.toFixed(2)}</span>
  </div>`;

  if(!inv.length){
    return h+`<div class="dcard dcard-p" style="text-align:center;padding:40px;color:var(--text3);font-family:var(--mono);font-size:13px">Нет инвойсов — добавь первый выше.</div></div>`;
  }

  // batches by month
  const byMonth={};
  inv.forEach(i=>{ (byMonth[i.date.slice(0,7)]=byMonth[i.date.slice(0,7)]||[]).push(i); });
  const mks=Object.keys(byMonth).sort((a,b)=>b.localeCompare(a));
  if(invOpenBatch===null) invOpenBatch=mks[0];

  h+=`<div style="display:flex;flex-direction:column;gap:12px">`;
  mks.forEach(mk=>{
    const list=byMonth[mk].slice().sort((a,b)=>b.date.localeCompare(a.date));
    const sum=list.reduce((s,i)=>s+i.count*INV_RATE,0);
    const cnt=list.reduce((s,i)=>s+i.count,0);
    const allPaid=list.every(i=>i.paid), somePaid=list.some(i=>i.paid);
    const isOverdue=!allPaid&&mk<mkNow;
    const open=invOpenBatch===mk;
    const y=+mk.split('-')[0], m=+mk.split('-')[1];
    const dates=list.map(i=>i.date).sort();
    const period=dates.length?(new Date(dates[0]+'T00:00:00').getDate()+'–'+new Date(dates[dates.length-1]+'T00:00:00').getDate()+' '+_MSHORT[m-1]):'';
    const chip=allPaid?'<span class="dchip dchip-ok">Оплачена</span>':isOverdue?'<span class="dchip dchip-bad">Просрочена</span>':somePaid?'<span class="dchip dchip-warn">Частично</span>':'<span class="dchip dchip-warn">Отправлена</span>';
    let rows='';
    list.forEach((i,idx)=>{
      const dt=new Date(i.date+'T00:00:00');
      rows+=`<div class="drow" style="padding:9px 10px;margin:0 -10px">
        <div style="width:62px;font-family:var(--mono);font-size:12px;color:var(--text2)">№${String(list.length-idx).padStart(3,'0')}</div>
        <div style="flex:1;min-width:0;font-size:12.5px;letter-spacing:-.1px;color:rgba(255,255,255,.85)">${i.count} инвойсов${i.note?' · '+esc(i.note):''}</div>
        <button class="dbtn dbtn-sm${i.paid?' on':''}" onclick="event.stopPropagation();toggleInvoicePaid('${i.id}')" title="${i.paid?'Снять отметку об оплате':'Отметить оплаченным'}" style="padding:3px 9px;font-size:10.5px">${i.paid?'✓ оплачен':'не оплачен'}</button>
        <div class="dmeta">${dt.getDate()} ${_MSHORT[dt.getMonth()]}</div>
        <div style="font-family:var(--mono);font-size:12.5px;font-weight:600;width:54px;text-align:right">$${(i.count*INV_RATE).toFixed(2)}</div>
        <button class="dicon" onclick="event.stopPropagation();deleteInvoice('${i.id}')" title="Удалить">✕</button>
      </div>`;
    });
    h+=`<div class="dcard" style="overflow:hidden">
      <div style="display:flex;align-items:center;gap:13px;padding:15px 18px;${open?'border-bottom:1px solid rgba(255,255,255,.06)':''}">
        <button class="dcaret" onclick="toggleInvBatch('${mk}')" title="${open?'Свернуть':'Развернуть'}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" style="transition:transform .2s ease;transform:rotate(${open?90:0}deg)"><path d="M9 6l6 6-6 6"/></svg>
        </button>
        <div style="flex:1;min-width:0">
          <div style="font-size:15px;font-weight:620;letter-spacing:-.3px">${(MONTHS_RU[m-1]||'').charAt(0).toUpperCase()+(MONTHS_RU[m-1]||'').slice(1)} ${y}</div>
          <div class="dmeta" style="margin-top:3px">${period} · пачка из ${list.length} · ${cnt} инвойсов</div>
        </div>
        ${chip}
        <div class="dnum" style="font-size:17px;letter-spacing:-.5px;width:86px;text-align:right;color:${allPaid?'var(--green)':'var(--text)'}">$${sum.toFixed(2)}</div>
        <button class="dbtn dbtn-sm ${allPaid?'':'dbtn-ok'}" onclick="markBatchPaid('${mk}')">${allPaid?'снять оплату':'отметить оплаченной'}</button>
      </div>
      ${open?`<div style="padding:6px 18px 12px">${rows}</div>`:''}
    </div>`;
  });
  h+=`</div></div>`;
  return h;
}


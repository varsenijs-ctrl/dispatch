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
let _lastRenderedView=null;   // чтобы возвращать прокрутку только внутри той же вкладки
function render(){
  const _now=getTODAY();
  const dateEl=document.getElementById('topbar-date');
  if(dateEl) dateEl.textContent=fmtDate(_now)+' '+DAYS_RU[_now.getDay()]+' · '+MONTHS_RU[_now.getMonth()];
  updateTopbar();
  updateSidebar();
  const el=document.getElementById('main-content');
  // Перерисовка заменяет весь HTML, из-за чего страница прыгала в начало после каждой
  // отметки. Запоминаем прокрутку (вертикальную и горизонтальную у помеченных сеток)
  // и возвращаем её сразу после вставки — визуально ничего не дёргается.
  const _keepTop=el?el.scrollTop:0;
  const _keepLeft={};
  if(el) el.querySelectorAll('[data-keepscroll]').forEach(n=>{ _keepLeft[n.getAttribute('data-keepscroll')]=n.scrollLeft; });
  const _sameView=(_lastRenderedView===view);
  _lastRenderedView=view;
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
  if(el&&_sameView){
    el.scrollTop=_keepTop;
    el.querySelectorAll('[data-keepscroll]').forEach(n=>{
      const k=n.getAttribute('data-keepscroll');
      if(_keepLeft[k]!=null) n.scrollLeft=_keepLeft[k];
    });
  } else if(el){
    el.scrollTop=0;                                   // новая вкладка открывается сверху
  }
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
// ── Обзор — по макету «Dark iOS dashboard 2» ──────────────────
// Крупная карточка заработка со спарклайном и кольцом прогресса, разбивка заработка
// стек-полосой, 4 стат-карточки с мини-барами, дедлайны, задачи и топ-клиенты.
function _homeToggleTask(id){const t=load('dc_plantasks',{});if(t[id]){t[id].done=!t[id].done;if(t[id].done){t[id].status='yes';t[id].doneDate=isoToday();}else{t[id].status='';delete t[id].doneDate;}save('dc_plantasks',t);render();}}
// Сглаженный путь для спарклайна + залитая область под ним.
function _sparkPaths(vals, w, h){
  if(!vals||!vals.length) return {line:'',area:''};
  const max=Math.max.apply(null, vals.concat([0.01]));
  const n=vals.length;
  const X=i=>(n===1?w/2:(i/(n-1))*w);
  const Y=v=>h-4-(v/max)*(h-12);
  let line='M'+X(0).toFixed(1)+' '+Y(vals[0]).toFixed(1);
  for(let i=1;i<n;i++){
    const x0=X(i-1),y0=Y(vals[i-1]),x1=X(i),y1=Y(vals[i]),cx=(x0+x1)/2;
    line+=' C'+cx.toFixed(1)+' '+y0.toFixed(1)+','+cx.toFixed(1)+' '+y1.toFixed(1)+','+x1.toFixed(1)+' '+y1.toFixed(1);
  }
  return {line:line, area:line+' L'+X(n-1).toFixed(1)+' '+h+' L'+X(0).toFixed(1)+' '+h+' Z'};
}
// Заработок зоны mk (для сравнения с прошлым месяцем). Без побочных эффектов.
function _zoneEarned(mk){
  const smsDays=load('dc_sms_days',{}), dis=load('dc_pay_disabled',{}), tasks=load('dc_plantasks',{});
  const ids=_zoneRoster(mk);
  let sum=0;
  ids.forEach(function(cid){
    const c=clients.find(x=>x.id===cid); if(!c) return;
    const hist=historyData[c.name]||{}, cs=smsDays[cid]||{}, cd=dis[cid]||{};
    Object.keys(hist).forEach(function(iso){
      if(iso.slice(0,7)!==mk) return;
      const v=hist[iso]; if(v!=='yes'&&v!=='draft') return;
      if(cd[iso]) return;
      sum+=cs[iso]?SMS_DAY_RATE:EMAIL_RATE;
    });
    (getFlows(cid)||[]).forEach(function(f){
      const done=Object.values(tasks).some(t=>t.cid===cid&&t.flowId===f.id&&t.done&&(t.startIso||'').slice(0,7)===mk);
      if(done) sum+=f.count*0.60;
    });
  });
  return sum;
}
function renderHome(){
  const iso=isoToday(), mk=activeMonth;
  const ac=_zac();
  const parts=mk.split('-'); const zy=+parts[0], zm=+parts[1];
  const monthName=MONTHS_RU[zm-1]||mk;
  const monthPrep=_MPREP[zm-1]||monthName;   // «в августе»
  const smsDays=load('dc_sms_days',{}), disAll=load('dc_pay_disabled',{});
  const _tasks=load('dc_plantasks',{});

  // ── деньги зоны (тот же источник, что и Финансы) ──
  const _T=computeFinanceTotals(financeScope);
  const earned=_T.earned, potential=_T.potential;
  const pct=potential?Math.round(earned/potential*100):0;
  const P=_T.parts||{email:0,sms:0,flows:0,inv:0};

  // ── динамика к прошлому месяцу ──
  const prevMk=(function(){ const d=new Date(zy, zm-2, 1); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); })();
  const prevEarned=_zoneEarned(prevMk);
  const delta=prevEarned>0?Math.round((earned-prevEarned)/prevEarned*100):null;

  // ── заработок по дням месяца → спарклайн + рабочие дни ──
  const daysInMonth=new Date(zy, zm, 0).getDate();
  const byDay=new Array(daysInMonth).fill(0);
  ac.forEach(function(c){
    const hist=historyData[c.name]||{}, cs=smsDays[c.id]||{}, cd=disAll[c.id]||{};
    Object.keys(hist).forEach(function(k){
      if(k.slice(0,7)!==mk) return;
      const v=hist[k]; if(v!=='yes'&&v!=='draft') return;
      if(cd[k]) return;
      const d=+k.slice(8,10);
      if(d>=1&&d<=daysInMonth) byDay[d-1]+=cs[k]?SMS_DAY_RATE:EMAIL_RATE;
    });
  });
  const workedDays=byDay.filter(v=>v>0).length;
  const upto=(mk===iso.slice(0,7))?+iso.slice(8,10):daysInMonth;   // текущий месяц — до сегодня
  const sparkVals=byDay.slice(0, Math.max(2, upto));
  const SP=_sparkPaths(sparkVals, 520, 66);
  const sparkLabels=(function(){
    const out=[], n=sparkVals.length, steps=Math.min(5,n);
    for(let i=0;i<steps;i++){
      const d=1+Math.round(i*(n-1)/(steps-1||1));
      out.push(d+' '+_MSHORT[zm-1]);
    }
    return out;
  })();

  // ── стат-карточки ──
  let streak=0;
  for(let i=0;i<60;i++){
    const d=new Date(getTODAY()); d.setDate(d.getDate()-i);
    const diso=toISO(d);
    const dman=load('dc_manual_done',{})[diso];
    const hasManual=dman&&Object.keys(dman).length>0;
    const hasHist=ac.some(c=>historyData[c.name]&&historyData[c.name][diso]==='yes');
    if(hasManual||hasHist) streak++; else if(i>0) break;
  }
  const todayTasks=Object.values(_tasks).filter(t=>!t.flowId&&!_isTaskClientPaused(t)&&t.startIso===iso);
  const overdueN=Object.values(_tasks).filter(t=>!t.flowId&&!_isTaskClientPaused(t)&&_overdue(t)).length;
  // мини-бары: последние 7 дней (отметки / деньги / активность)
  const last7=(function(){ const out=[]; for(let i=6;i>=0;i--){ const d=new Date(getTODAY()); d.setDate(d.getDate()-i); out.push(toISO(d)); } return out; })();
  const marksPerDay=last7.map(function(di){ return ac.filter(c=>{const v=(historyData[c.name]||{})[di];return v==='yes'||v==='draft';}).length; });
  const moneyPerDay=last7.map(function(di){ const d=+di.slice(8,10); return (di.slice(0,7)===mk&&byDay[d-1])?byDay[d-1]:0; });
  const tasksPerDay=last7.map(function(di){ return Object.values(_tasks).filter(t=>!t.flowId&&t.startIso===di).length; });
  const bars=(arr)=>{ const m=Math.max.apply(null,arr.concat([1])); return arr.map(v=>Math.max(12,Math.round(v/m*100))+'%'); };

  const IC={
    send:'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z',
    money:'M12 2v20M17 6.5c0-2-2.2-3-5-3s-5 1-5 3.4S9 10 12 10.6s5 1.2 5 3.5-2.2 3.4-5 3.4-5-1-5-3',
    flame:'M12 22a7 7 0 007-7c0-5-4-6-4-10-3 1-5 4-5 7-1 0-2-1-2-3-2 2-3 4-3 6a7 7 0 007 7z',
    check:'M22 11.1V12a10 10 0 11-5.9-9.1M22 4L12 14.01l-3-3'
  };
  const statCards=[
    {label:'Рассылки', value:_T.sentCount, sub:'за '+_MSHORT[zm-1], color:'var(--accent)', bg:'rgba(64,203,224,.14)', d:IC.send,  bars:bars(marksPerDay), go:"setView('today')"},
    {label:'Заработано', value:'$'+earned.toFixed(2), sub:'этот месяц', color:'var(--green)', bg:'rgba(48,209,88,.14)', d:IC.money, bars:bars(moneyPerDay), go:"setView('finance')"},
    {label:'Стрик', value:streak, sub:'дней подряд', color:'#ffd60a', bg:'rgba(255,214,10,.14)', d:IC.flame, bars:bars(marksPerDay), go:''},
    {label:'Задачи сегодня', value:todayTasks.length, sub:overdueN?(overdueN+' просрочено'):(todayTasks.filter(t=>t.done).length+' выполнено'), color:overdueN?'#ff8078':'var(--accent)', bg:overdueN?'rgba(255,69,58,.14)':'rgba(64,203,224,.14)', d:IC.check, bars:bars(tasksPerDay), go:"setView('day_today')"}
  ];
  const statHtml=statCards.map(s=>`
    <div class="dcard dlift-card" style="padding:16px 18px;border-radius:20px${s.go?';cursor:pointer':''}"${s.go?` onclick="${s.go}"`:''}>
      <div style="display:flex;align-items:center;gap:8px">
        <span style="width:24px;height:24px;border-radius:8px;flex:none;display:flex;align-items:center;justify-content:center;background:${s.bg}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="${s.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${s.d}"/></svg>
        </span>
        <div style="font-size:11px;font-weight:580;letter-spacing:.1px;color:rgba(255,255,255,.55)">${s.label}</div>
      </div>
      <div style="font-family:var(--mono);font-size:33px;font-weight:600;letter-spacing:-1.4px;margin-top:11px;line-height:1;color:${s.color}">${s.value}</div>
      <div style="display:flex;align-items:flex-end;gap:9px;margin-top:11px">
        <div style="flex:1;font-size:11.5px;color:var(--text3)">${s.sub}</div>
        <div class="dbars">${s.bars.map(h=>`<span style="background:${s.color};height:${h}"></span>`).join('')}</div>
      </div>
    </div>`).join('');

  // ── разбивка заработка ──
  const brk=[
    {label:'Имейлы', color:'var(--accent)', money:P.email, count:Math.round(P.email/EMAIL_RATE)},
    {label:'SMS-надбавка', color:'var(--blue)', money:P.sms, count:Math.round(P.sms/SMS_EXTRA)},
    {label:'Флоу', color:'#bf5af2', money:P.flows, count:Math.round(P.flows/0.60)},
    {label:'Инвойсы', color:'var(--green)', money:P.inv, count:Math.round(P.inv/INV_RATE)}
  ];
  const brkTotal=brk.reduce((s,b)=>s+b.money,0)||1;
  const brkBar=brk.map(b=>`<div style="height:100%;box-shadow:0 1px 0 rgba(255,255,255,.28) inset;transition:width .55s cubic-bezier(.2,.8,.2,1);background:${b.color};width:${(b.money/brkTotal*100).toFixed(1)}%"></div>`).join('');
  const brkRows=brk.map(b=>`
    <div style="display:flex;align-items:center;gap:10px">
      <span style="width:9px;height:9px;border-radius:3px;flex:none;background:${b.color}"></span>
      <span style="flex:1;font-size:13px;letter-spacing:-.1px">${b.label}</span>
      <span style="font-family:var(--mono);font-size:11px;color:var(--text3)">${b.count||0}</span>
      <span style="font-family:var(--mono);font-size:12.5px;font-weight:600;width:58px;text-align:right">$${b.money.toFixed(2)}</span>
    </div>`).join('');

  // ── дедлайны ──
  const deadlines=ac.filter(c=>c.deadline).map(function(c){
    const dl=new Date(c.deadline+'T00:00:00');
    const diff=Math.ceil((dl-new Date(getTODAY().toDateString()))/86400000);
    return {c:c, diff:diff, dl:dl};
  }).filter(x=>x.diff>=-14&&x.diff<=21).sort((a,b)=>a.diff-b.diff);
  const hotN=deadlines.filter(x=>x.diff<=1).length;
  const dlRows=deadlines.slice(0,6).map(function(x){
    const col=x.diff<0?'var(--red)':x.diff===0?'var(--red)':x.diff<=3?'#ffd60a':'rgba(255,255,255,.3)';
    const txt=x.diff<0?(Math.abs(x.diff)+'д назад'):x.diff===0?'сегодня':x.diff===1?'завтра':(x.dl.getDate()+' '+_MSHORT[x.dl.getMonth()]);
    const nF=getFlows(x.c.id).length;
    return `<div class="drow2" onclick="openCal('${x.c.id}')" style="cursor:pointer">
      <span style="width:3px;height:26px;border-radius:980px;flex:none;background:${col}"></span>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;letter-spacing:-.1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(x.c.name)}</div>
        <div style="font-family:var(--mono);font-size:10.5px;color:rgba(255,255,255,.28);margin-top:3px">${nF?nF+' флоу':'дедлайн клиента'}</div>
      </div>
      <div style="font-family:var(--mono);font-size:11.5px;font-weight:600;color:${col}">${txt}</div>
    </div>`;
  }).join('');

  // ── задачи сегодня ──
  const PR={4:['СРОЧНО','#ff8078','rgba(255,69,58,.16)'],3:['ВЫСОКИЙ','#ff8078','rgba(255,69,58,.16)'],
            2:['СРЕДНИЙ','#ffe066','rgba(255,214,10,.14)'],1:['НИЗКИЙ','rgba(255,255,255,.6)','rgba(255,255,255,.08)']};
  const taskRows=todayTasks.slice(0,6).map(function(t){
    const pr=PR[+t.prio||0];
    const box=t.done
      ? `<span style="width:17px;height:17px;border-radius:6px;flex:none;background:var(--green);display:flex;align-items:center;justify-content:center"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#06371a" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg></span>`
      : `<span style="width:17px;height:17px;border-radius:6px;flex:none;border:1.5px solid rgba(255,255,255,.2);background:rgba(0,0,0,.25)"></span>`;
    return `<div class="drow2">
      <span onclick="_homeToggleTask('${t.id}')" style="cursor:pointer;display:flex">${box}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;letter-spacing:-.1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;${t.done?'opacity:.5;text-decoration:line-through':''}">${esc(t.text||'')}</div>
        <div style="font-family:var(--mono);font-size:10.5px;color:rgba(255,255,255,.28);margin-top:3px">${t.clientName?esc(t.clientName):'общее'}</div>
      </div>
      ${pr?`<div style="font-size:9.5px;font-weight:700;letter-spacing:.5px;padding:3px 8px;border-radius:980px;background:${pr[2]};color:${pr[1]}">${pr[0]}</div>`:''}
    </div>`;
  }).join('');

  // ── топ-клиенты месяца ──
  const top=ac.map(function(c){ const p=_clientFinanceParts(c); return {c:c, m:p.email.e+p.sms.e+p.flows.e, n:p.doneN}; })
    .filter(x=>x.m>0).sort((a,b)=>b.m-a.m).slice(0,6);
  const maxM=top.length?top[0].m:1;
  const topRows=top.map(x=>`
    <div class="drow2" onclick="openCal('${x.c.id}')" style="cursor:pointer;display:block">
      <div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:6px">
        <span style="font-size:13px;letter-spacing:-.1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(x.c.name)}</span>
        <span style="font-family:var(--mono);font-size:12.5px;font-weight:600;flex:none">$${x.m.toFixed(2)}</span>
      </div>
      <div style="height:5px;border-radius:980px;background:rgba(255,255,255,.06);overflow:hidden">
        <div style="height:100%;border-radius:980px;background:var(--accent);box-shadow:0 1px 0 rgba(255,255,255,.3) inset;width:${Math.round(x.m/maxM*100)}%"></div>
      </div>
    </div>`).join('');

  const hh=new Date().getHours();
  const greet=hh<12?'Доброе утро':hh<17?'Добрый день':'Добрый вечер';
  const R=38, C=2*Math.PI*R;
  const ringDash=(pct/100*C).toFixed(1)+' '+C.toFixed(1);
  const left=ac.filter(c=>!((historyData[c.name]||{})[iso])).length;

  return `<div class="dfade" style="max-width:1240px">
    <div style="display:flex;align-items:flex-end;gap:20px;margin-bottom:22px;flex-wrap:wrap">
      <div style="flex:1;min-width:220px">
        <div style="font-size:32px;font-weight:700;letter-spacing:-1.1px;line-height:1.05">${greet}, Арсений</div>
        <div style="font-family:var(--mono);font-size:12.5px;color:rgba(255,255,255,.32);margin-top:8px">${_DFULL[getTODAY().getDay()]}, ${getTODAY().getDate()} ${_MGEN[getTODAY().getMonth()]} ${getTODAY().getFullYear()} · ${left} ${_plural(left,'клиент','клиента','клиентов')} ждут отметки</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;padding:8px 13px;border-radius:980px;background:linear-gradient(180deg,rgba(255,214,10,.16),rgba(255,214,10,.06));border:1px solid rgba(255,214,10,.22)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffd60a" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="${IC.flame}"/></svg>
        <span style="font-family:var(--mono);font-size:12px;font-weight:600;color:#ffe066">${streak} ${_plural(streak,'день','дня','дней')} стрик</span>
      </div>
    </div>

    <div class="home-grid-2" style="display:grid;grid-template-columns:1.55fr 1fr;gap:12px;margin-bottom:12px">
      <div class="dcard" style="position:relative;overflow:hidden;padding:22px 24px;border-radius:24px">
        <div aria-hidden="true" style="position:absolute;top:-60px;right:-40px;width:280px;height:200px;background:radial-gradient(closest-side,rgba(48,209,88,.16),transparent);pointer-events:none"></div>
        <div style="display:flex;align-items:flex-start;gap:20px;position:relative;flex-wrap:wrap">
          <div style="flex:1;min-width:200px">
            <div class="dcaps" style="font-size:9.5px;letter-spacing:1.1px">Заработано в ${monthPrep}</div>
            <div style="display:flex;align-items:baseline;gap:12px;margin-top:8px;flex-wrap:wrap">
              <div style="font-family:var(--mono);font-size:52px;font-weight:600;letter-spacing:-2.6px;color:var(--green);line-height:.95">$${earned.toFixed(2)}</div>
              ${delta!==null?`<div style="display:flex;align-items:center;gap:4px;padding:3px 8px;border-radius:7px;background:${delta>=0?'rgba(48,209,88,.14)':'rgba(255,69,58,.14)'};border:1px solid ${delta>=0?'rgba(48,209,88,.22)':'rgba(255,69,58,.22)'}">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="${delta>=0?'#30d158':'#ff8078'}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="${delta>=0?'M6 15l6-6 6 6':'M6 9l6 6 6-6'}"/></svg>
                <span style="font-family:var(--mono);font-size:11px;font-weight:600;color:${delta>=0?'#30d158':'#ff8078'}">${delta>=0?'+':''}${delta}%</span>
              </div>`:''}
            </div>
            <div style="font-family:var(--mono);font-size:12px;color:rgba(255,255,255,.34);margin-top:8px">из $${potential.toFixed(2)} максимума · ${workedDays} ${_plural(workedDays,'рабочий день','рабочих дня','рабочих дней')}${delta!==null?' · прошлый месяц $'+prevEarned.toFixed(2):''}</div>
          </div>
          <div style="position:relative;width:88px;height:88px;flex:none">
            <svg width="88" height="88" viewBox="0 0 88 88" style="transform:rotate(-90deg)">
              <circle cx="44" cy="44" r="${R}" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="9"></circle>
              <circle cx="44" cy="44" r="${R}" fill="none" stroke="var(--green)" stroke-width="9" stroke-linecap="round" stroke-dasharray="${ringDash}" style="transition:stroke-dasharray .7s cubic-bezier(.2,.8,.2,1)"></circle>
            </svg>
            <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">
              <div style="font-family:var(--mono);font-size:19px;font-weight:600;letter-spacing:-.7px">${pct}%</div>
              <div style="font-size:9px;font-weight:600;letter-spacing:.5px;color:rgba(255,255,255,.34);margin-top:1px">ВЫПОЛНЕНО</div>
            </div>
          </div>
        </div>
        <div style="margin-top:18px;position:relative">
          <svg width="100%" height="66" viewBox="0 0 520 66" preserveAspectRatio="none" style="display:block">
            <defs><linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="rgba(64,203,224,.34)"/><stop offset="100%" stop-color="rgba(64,203,224,0)"/>
            </linearGradient></defs>
            ${SP.area?`<path d="${SP.area}" fill="url(#sparkFill)"></path>`:''}
            ${SP.line?`<path d="${SP.line}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>`:''}
          </svg>
          <div style="display:flex;justify-content:space-between;margin-top:6px">
            ${sparkLabels.map(l=>`<span style="font-family:var(--mono);font-size:9.5px;color:rgba(255,255,255,.24)">${l}</span>`).join('')}
          </div>
        </div>
      </div>

      <div class="dcard" style="padding:20px 22px;border-radius:24px;display:flex;flex-direction:column">
        <div class="dcaps" style="font-size:9.5px;letter-spacing:1.1px">Разбивка заработка</div>
        <div style="display:flex;height:11px;border-radius:980px;overflow:hidden;margin-top:15px;background:rgba(0,0,0,.38);box-shadow:0 1px 2px rgba(0,0,0,.5) inset">${brkBar}</div>
        <div style="display:flex;flex-direction:column;gap:12px;margin-top:17px">${brkRows}</div>
        <div style="flex:1"></div>
        <button class="dbtn dbtn-sm" style="margin-top:16px;align-self:flex-start" onclick="setView('finance')">Все финансы →</button>
      </div>
    </div>

    <div class="home-stats-4" style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:12px">${statHtml}</div>

    <div class="home-grid-2" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
      <div class="dcard" style="padding:18px 20px;border-radius:22px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:13px">
          <div style="font-size:14.5px;font-weight:650;letter-spacing:-.3px">Дедлайны</div>
          ${hotN?`<div style="font-family:var(--mono);font-size:10.5px;font-weight:600;padding:2px 7px;border-radius:6px;background:rgba(255,69,58,.14);color:#ff8078">${hotN} ${_plural(hotN,'горит','горят','горят')}</div>`
                :`<div style="font-family:var(--mono);font-size:11px;color:var(--text3)">${deadlines.length}</div>`}
        </div>
        <div style="display:flex;flex-direction:column;gap:1px">${dlRows||'<div class="dmeta" style="padding:6px 0">Нет дедлайнов</div>'}</div>
      </div>

      <div class="dcard" style="padding:18px 20px;border-radius:22px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:13px">
          <div style="font-size:14.5px;font-weight:650;letter-spacing:-.3px;cursor:pointer" onclick="setView('day_today')">Задачи сегодня</div>
          <div style="font-family:var(--mono);font-size:11px;color:${overdueN?'#ff8078':'var(--text3)'}">${overdueN?'⚠ '+overdueN:todayTasks.length}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:1px">${taskRows||'<div class="dmeta" style="padding:6px 0">Нет задач на сегодня</div>'}</div>
      </div>
    </div>

    <div class="dcard" style="padding:18px 20px;border-radius:22px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:15px">
        <div style="font-size:14.5px;font-weight:650;letter-spacing:-.3px">Топ-клиенты · ${monthName}</div>
        <div style="font-family:var(--mono);font-size:11px;color:var(--text3)">${top.length}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px">${topRows||'<div class="dmeta">Нет данных — отметь рассылки на «Сегодня»</div>'}</div>
    </div>
  </div>`;
}

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
// Статус ЗАДАЧИ: yes = сделано, draft = отложено, no = не сделано.
// Повторный клик по активной кнопке снимает статус. `done` держим в синхроне,
// чтобы группировка задач и «Готово сегодня» работали как раньше.
function _setTaskStatus(tid, st){
  const tasks=load('dc_plantasks',{});
  const t=tasks[tid]; if(!t) return;
  const cur=t.status||(t.done?'yes':'');
  const next=(cur===st)?'':st;
  t.status=next;
  t.done=(next==='yes');
  if(t.done) t.doneDate=isoToday(); else delete t.doneDate;
  save('dc_plantasks',tasks);
  _sfx.play(next==='yes'?'done':'click');
  render();
}
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
    // Вместо тумблера — понятный бейдж: серый «SMS» = нет, синий залитый = есть.
    const smsToggle=v?`<span class="dday-sms${sms?' on':''}" onclick="event.stopPropagation();_dayToggleSmsInline('${c.id}','${iso}')" title="${sms?'SMS есть — нажми, чтобы убрать (день станет $'+EMAIL_RATE.toFixed(2)+')':'SMS нет — нажми, чтобы добавить (день станет $'+SMS_DAY_RATE.toFixed(2)+')'}">SMS</span>`:'';
    cells+=`<button class="${cls}" onclick="_dayCycleInline('${c.id}','${iso}')" title="${iso}${v?' · '+v:''}">
      <span class="dday-num">${d}</span><span class="dday-dot"></span>${smsToggle}</button>`;
  }
  return `<div style="padding:4px 17px 20px">
    <div class="dsunk" style="padding:16px 18px 18px">
      <div class="dhover" style="display:flex;align-items:center;gap:12px;margin-bottom:14px;flex-wrap:wrap">
        <div style="font-size:13px;font-weight:620;letter-spacing:-.2px">${(MONTHS_RU[m-1]||'').charAt(0).toUpperCase()+(MONTHS_RU[m-1]||'').slice(1)} ${y} · ${esc(c.name)}</div>
        <div class="dmeta">${marks} отправлено · $${money.toFixed(2)}</div>
        <div style="flex:1"></div>
        <span class="dact"><button class="dicon neutral" onclick="event.stopPropagation();openCal('${c.id}')" title="Открыть полный календарь (3 месяца)" style="width:22px;height:22px;font-size:12px">📅</button></span>
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
    // ── строка задачи в стиле макета: каретка → точка статуса → чекбокс → текст,
    //    справа выпадающий список клиента, переключатель Да/Черновик/Нет и сумма.
    //    Каретка раскрывает календарь месяца этого клиента (как на «Рассылках»).
    // Статус ЗАДАЧИ: Yes = сделано, Draft = отложено, No = не сделано.
    const stt=t.status||(t.done?'yes':'');
    const dot=stt==='yes'?'var(--green)':stt==='draft'?'#bf5af2':stt==='no'?'var(--red)':'rgba(255,255,255,.22)';
    const halo=stt==='yes'?'rgba(48,209,88,.18)':stt==='draft'?'rgba(191,90,242,.18)':stt==='no'?'rgba(255,69,58,.18)':'rgba(255,255,255,.06)';
    const exp=_cl&&dayExpandedCid===_cl.id;
    // Клик по строке раскрывает календарь месяца этого клиента (как было на «Сегодня»).
    const rowClick=_cl?` onclick="_dayToggleExpand('${_cl.id}')" style="cursor:pointer"`:'';
    const caret=_cl
      ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.32)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" style="flex:none;margin-top:3px;transition:transform .2s ease;transform:rotate(${exp?90:0}deg)"><path d="M9 6l6 6-6 6"/></svg>`
      : `<span style="width:13px;flex:none"></span>`;
    const clientChip=cname?`<span class="dchip dchip-sms" style="font-weight:560;letter-spacing:0;flex:none">${esc(cname)}</span>`:'';
    const smsChip=(_cl&&_cl.smsEnabled)?`<div class="dchip" style="flex:none;background:rgba(10,132,255,.18);color:#5eb0ff;border:1px solid rgba(10,132,255,.24)">SMS</div>`:'';
    const seg=`<div class="dseg" onclick="event.stopPropagation()">`+
      [['yes','Yes','on-yes','сделано'],['draft','Later','on-draft','отложено'],['no','No','on-no','не сделано']].map(o=>
        `<button class="${stt===o[0]?'on '+o[2]:''}" onclick="event.stopPropagation();_setTaskStatus('${t.id}','${o[0]}')" title="${o[3]}${stt===o[0]?' · нажми ещё раз, чтобы снять':''}">${o[1]}</button>`).join('')+`</div>`;
    return `<div class="dhover" data-tid="${t.id}" draggable="true" ondragstart="_startDrag(this,event)" ondragend="_endDrag(this)" ondragover="_dragOver(this,event)" ondragleave="_dragLeave(this)" ondrop="_drop(this,event)"
      style="border:1px solid ${bc};border-radius:14px;margin-bottom:7px;background:${bg}">
      <div${rowClick||' style="cursor:default"'} title="${_cl?(exp?'Свернуть календарь':'Нажми, чтобы открыть календарь клиента'):''}">
      <div style="display:flex;align-items:flex-start;gap:11px;padding:11px 13px">
        ${caret}
        <div style="width:8px;height:8px;border-radius:980px;flex:none;margin-top:6px;background:${dot};box-shadow:0 0 0 3px ${halo}"></div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;flex-wrap:wrap;gap:6px">${prioFlag(t.prio)}${todIcon}<span class="task-text" ondblclick="event.stopPropagation();_editTask('${t.id}')" style="font-size:13px;font-weight:540;letter-spacing:-.1px;${stt==='yes'?'text-decoration:line-through;color:var(--text3);':''}${over&&stt!=='yes'?'color:#ff8078':''}" title="Двойной клик — редактировать">${esc(t.text)}</span>${clientChip}${smsChip}</div>
          ${metaHtml}${note}
        </div>
        ${seg}
        <span class="dact" style="margin-top:1px">
          <input type="date" class="dinput dinput-sm ddate" value="${t.startIso}" onclick="event.stopPropagation()" onchange="event.stopPropagation();moveTask('${t.id}',this.value)" title="Перенести на другой день" style="font-size:10px;padding:3px 6px">
          <button class="dicon neutral" onclick="event.stopPropagation();_editTask('${t.id}')" title="Редактировать">✎</button>
          <button class="dicon" onclick="event.stopPropagation();removeDayTask('${t.id}');render()" title="Удалить">✕</button>
        </span>
      </div>
      </div>
      ${exp?_dayInlineCalendar(_cl):''}
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
// Режим отметок в сетке «Рассылки»: 'status' (да → черновик → нет → пусто) или 'sms'.
let gridMode='status';
// Клик по ячейке сетки: в режиме SMS (или с Shift) переключает SMS этого дня,
// иначе циклит статус. SMS можно ставить и на пустой день — отметка появится
// сама, когда поставишь статус.
function _gridCellClick(ev, cid, dIso){
  if(ev&&ev.shiftKey) return _gridToggleSms(cid,dIso);
  if(gridMode==='sms') return _gridToggleSms(cid,dIso);
  _dayCycleInline(cid,dIso);
}
function _gridToggleSms(cid, dIso){
  const smsDays=load('dc_sms_days',{});
  if(!smsDays[cid]) smsDays[cid]={};
  if(smsDays[cid][dIso]) delete smsDays[cid][dIso]; else smsDays[cid][dIso]=true;
  save('dc_sms_days',smsDays);
  _sfx.play('click');
  render();
}
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
      <div style="display:flex;align-items:center;gap:7px;flex:none;white-space:nowrap"><div style="width:11px;height:11px;border-radius:4px;flex:none;background:var(--blue)"></div><span style="font-size:12px;color:var(--text2)">SMS</span></div>
      <div style="width:1px;height:14px;background:rgba(255,255,255,.1)"></div>
      <span style="font-size:12px;color:var(--text3)">${gridMode==='sms'
        ? 'Режим SMS: клик по ячейке добавляет/убирает SMS'
        : 'Клик по ячейке меняет статус · Shift+клик — SMS'}</span>
      <div style="flex:1"></div>
      <button class="dpill ${gridMode==='status'?'active':''}" onclick="gridMode='status';render()" title="Клик по ячейке меняет статус">статус</button>
      <button class="dpill ${gridMode==='sms'?'active':''}" onclick="gridMode='sms';render()" title="Клик по ячейке отмечает SMS за этот день">SMS</button>
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
      // SMS: синяя обводка ячейки + уголок. Клик — статус, Shift+клик (или режим SMS) — SMS.
      const hasSms=!!cidSms[dIso];
      const cls='dgcell'+(v?' g-'+v:'')+(dIso===iso?' today':'')+(hasSms?' has-sms':'');
      const ring=dIso===iso?'box-shadow:0 0 0 1.5px var(--accent)':'';
      cells+=`<button class="${cls}" style="${ring}" onclick="_gridCellClick(event,'${c.id}','${dIso}')" title="${dIso}${v?' · '+v:''}${hasSms?' · SMS':''} — ${gridMode==='sms'?'клик: SMS':'клик: статус, Shift+клик: SMS'}"></button>`;
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

  html+=`<div class="dcard" data-keepscroll="grid" style="padding:18px;overflow-x:auto">
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
// ── История — по макету «Dark iOS dashboard 2» ────────────────
// Карточка на день: «5 августа, среда · N событий» и сумма справа. В строке —
// иконка типа события в кружке, текст, время и деньги.
// ── История — как история браузера ───────────────────────────
// День = когда ты РАБОТАЛ. Внутри дня — что именно сделал: отметки за один заход
// по одному клиенту сводятся в одну запись с диапазоном дат
// («BareRitual — 14 имейлов · 5–31 авг»), плюс выставленные флоу и инвойсы.
function renderHistory(){
  const mk=activeMonth;
  const parts=mk.split('-'); const yy=+parts[0], mm=+parts[1];
  const monthName=((MONTHS_RU[mm-1]||mk).charAt(0).toUpperCase()+(MONTHS_RU[mm-1]||'').slice(1))+' '+yy;
  const smsAll=load('dc_sms_days',{}), disAll=load('dc_pay_disabled',{});
  const EV={
    sent:  {d:'M20 6L9 17l-5-5',                                  color:'#30d158', bg:'rgba(48,209,88,.14)'},
    draft: {d:'M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z',  color:'#d08bf5', bg:'rgba(191,90,242,.14)'},
    miss:  {d:'M18 6L6 18M6 6l12 12',                              color:'#ff8078', bg:'rgba(255,69,58,.14)'},
    flow:  {d:'M6 3v12M18 9a3 3 0 100-6 3 3 0 000 6zM6 21a3 3 0 100-6 3 3 0 000 6zM15 6H9a3 3 0 00-3 3v3', color:'#d08bf5', bg:'rgba(191,90,242,.14)'},
    inv:   {d:'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M9 13h6M9 17h6', color:'#5eb0ff', bg:'rgba(10,132,255,.14)'}
  };
  const hhmm=t=>{ if(!t) return ''; const d=new Date(t); return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'); };
  const dm=iso=>{ const d=new Date(iso+'T00:00:00'); return d.getDate()+' '+_MSHORT[d.getMonth()]; };
  // «5–31 авг» / «12 авг» / «12 авг + 3 дня» (если даты вразброс по разным месяцам)
  const rangeLabel=list=>{
    const s=list.slice().sort();
    if(s.length===1) return dm(s[0]);
    const a=new Date(s[0]+'T00:00:00'), b=new Date(s[s.length-1]+'T00:00:00');
    if(a.getMonth()===b.getMonth()) return a.getDate()+'–'+b.getDate()+' '+_MSHORT[b.getMonth()];
    return dm(s[0])+' – '+dm(s[s.length-1]);
  };

  const dayMap={};   // день РАБОТЫ → {rows, earned}
  const push=(w,row)=>{ if(!w||w.slice(0,7)!==mk) return;
    (dayMap[w]=dayMap[w]||{rows:[],earned:0}); dayMap[w].rows.push(row); dayMap[w].earned+=row.val||0; };

  // ── 1) отметки рассылок: группируем по (день работы → клиент → статус) ──
  const _zNames=_zoneClientNames();
  const log=gload('dc_actlog',[]).slice().sort((a,b)=>(a.t||0)-(b.t||0));
  const finalOf={};                                  // клиент|дата → последний статус (что в итоге стоит)
  log.forEach(e=>{ if(e&&e.c&&e.d) finalOf[e.c+'|'+e.d]=e; });
  const groups={};                                   // w|client|status → {dates, t, c, s}
  log.forEach(e=>{
    if(!e||!e.c||!e.d||!e.w) return;
    if(!e.s) return;                                  // снятие отметки не показываем отдельной строкой
    if(!_zNames[String(e.c).toLowerCase()]) return;    // только клиенты этой зоны
    if(finalOf[e.c+'|'+e.d]!==e) return;               // учитываем только итоговый статус даты
    const k=e.w+'|'+e.c+'|'+e.s;
    const g=groups[k]||(groups[k]={w:e.w,c:e.c,s:e.s,dates:[],t:0});
    if(g.dates.indexOf(e.d)<0) g.dates.push(e.d);
    if((e.t||0)>g.t) g.t=e.t||0;
  });
  Object.values(groups).forEach(g=>{
    const c=clients.find(x=>x.name===g.c);
    let val=0, withSms=0;
    g.dates.forEach(d=>{
      const sms=c?!!((smsAll[c.id]||{})[d]):false;
      const off=c?!!((disAll[c.id]||{})[d]):false;
      if(sms) withSms++;
      if((g.s==='yes'||g.s==='draft')&&!off) val+=sms?SMS_DAY_RATE:EMAIL_RATE;
    });
    const n=g.dates.length;
    const what=g.s==='yes'
      ? (n===1?(withSms?'имейл + SMS':'имейл'):(n+' '+_plural(n,'имейл','имейла','имейлов')+(withSms?' · '+withSms+' с SMS':'')))
      : g.s==='draft'
        ? (n===1?'черновик':(n+' '+_plural(n,'черновик','черновика','черновиков')))
        : (n===1?'не сделано':(n+' '+_plural(n,'день','дня','дней')+' не сделано'));
    const money=(g.s==='yes')?('$'+val.toFixed(2)):(g.s==='draft'?('черновик · $'+val.toFixed(2)):'—');
    push(g.w,{
      text:esc(g.c)+' — '+what,
      forDates:rangeLabel(g.dates),
      time:hhmm(g.t),
      val:(g.s==='yes')?val:0,                        // в сумму дня идёт только отправленное
      money:(g.s==='yes')?('$'+val.toFixed(2)):(g.s==='draft'?'~$'+val.toFixed(2):'—'),
      ev:g.s==='yes'?EV.sent:g.s==='draft'?EV.draft:EV.miss,
      cname:g.c
    });
  });

  // ── 2) выставленные флоу (день работы = дата, на которую отмечено) ──
  Object.values(load('dc_plantasks',{})).forEach(t=>{
    if(!t.flowId||!t.done) return;
    if(!_inRoster(t.cid)) return;
    const c=clients.find(x=>x.id===t.cid);
    const fl=(t.cid?getFlows(t.cid):[]).find(f=>f.id===t.flowId);
    const val=fl?fl.count*0.60:0;
    push(t.startIso,{text:(c?esc(c.name):'Без клиента')+' — флоу «'+esc(fl?fl.name:t.text)+'»',
      forDates:'', time:'', val:val, money:'$'+val.toFixed(2), ev:EV.flow, cname:c?c.name:''});
  });

  // ── 3) инвойсы ──
  loadInvoices().forEach(i=>{
    const val=i.count*INV_RATE;
    push(i.date,{text:'Инвойсы — '+i.count+' шт'+(i.note?' · '+esc(i.note):''),
      forDates:'', time:'', val:val, money:'$'+val.toFixed(2), ev:EV.inv, cname:''});
  });

  const days=Object.keys(dayMap).sort((a,b)=>b.localeCompare(a));
  const total=days.reduce((s,d)=>s+dayMap[d].earned,0);
  const events=days.reduce((s,d)=>s+dayMap[d].rows.length,0);

  let html=`<div class="dfade" style="max-width:900px">`;
  if(!days.length){
    return html+`<div class="dcard dcard-p" style="text-align:center;padding:34px 22px;color:var(--text3);font-family:var(--mono);font-size:13px;line-height:1.8">В «${monthName}» ты пока ничего не отмечал.<br>Ставь статусы на «Сегодня» или «Рассылках» —<br>здесь появится, что и когда было сделано.<br><button class="dbtn dbtn-primary" style="margin-top:14px;font-family:var(--font)" onclick="setView('day_today')">→ Сегодня</button></div></div>`;
  }
  html+=`<div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;flex-wrap:wrap">
    <div class="dmeta">${monthName} · ${days.length} ${_plural(days.length,'рабочий день','рабочих дня','рабочих дней')} · ${events} ${_plural(events,'запись','записи','записей')}</div>
    <div style="flex:1"></div>
    <div style="font-family:var(--mono);font-size:13px;font-weight:600;color:var(--green)">$${total.toFixed(2)}</div>
  </div>`;
  html+=`<div style="display:flex;flex-direction:column;gap:10px">`;
  days.forEach(function(w){
    const D=dayMap[w];
    const dt=new Date(w+'T00:00:00');
    const title=dt.getDate()+' '+_MGEN[dt.getMonth()]+', '+_DFULL[dt.getDay()]+(w===isoToday()?' · сегодня':'');
    const rows=D.rows.slice().sort((a,b)=>(b.time||'').localeCompare(a.time||''));   // позже сделанное — выше
    const rowsHtml=rows.map(function(r){
      return `<div class="drow2"${r.cname?` onclick="openCalByName('${jsq(r.cname)}')" style="cursor:pointer"`:''}>
        <span class="devt" style="background:${r.ev.bg}">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="${r.ev.color}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="${r.ev.d}"/></svg>
        </span>
        <div style="flex:1;min-width:0">
          <div style="font-size:12.5px;color:rgba(255,255,255,.86);letter-spacing:-.1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.text}</div>
          ${r.forDates?`<div style="font-family:var(--mono);font-size:10.5px;color:rgba(255,255,255,.28);margin-top:3px">за ${r.forDates}</div>`:''}
        </div>
        <div style="font-family:var(--mono);font-size:11px;color:rgba(255,255,255,.28);flex:none">${r.time}</div>
        <div style="font-family:var(--mono);font-size:12px;font-weight:600;width:56px;text-align:right;flex:none">${r.money}</div>
      </div>`;
    }).join('');
    html+=`<div class="dcard dlift-card" style="padding:17px 20px;border-radius:20px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:13px;gap:10px">
        <div style="display:flex;align-items:baseline;gap:10px;min-width:0">
          <div style="font-size:14.5px;font-weight:650;letter-spacing:-.3px;white-space:nowrap">${title}</div>
          <div style="font-family:var(--mono);font-size:10.5px;color:rgba(255,255,255,.28);white-space:nowrap">${D.rows.length} ${_plural(D.rows.length,'запись','записи','записей')}</div>
        </div>
        <div style="font-family:var(--mono);font-size:16px;font-weight:600;letter-spacing:-.5px;color:var(--green);flex:none">$${D.earned.toFixed(2)}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:1px">${rowsHtml}</div>
    </div>`;
  });
  html+=`</div></div>`;
  return html;
}


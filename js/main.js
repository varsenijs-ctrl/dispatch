// Build stamp — bump on each deploy so you can tell at a glance whether the
// running app has the latest files (если метки нет — крутится старый JS из кэша).
const BUILD='08.28 · фоновый ClickUp без звука';
console.log('Dispatch build: '+BUILD+' — _overdue '+(typeof _overdue==='function'?'OK':'ОТСУТСТВУЕТ (старый код)'));
try{ const _bt=document.getElementById('build-tag'); if(_bt) _bt.textContent=BUILD; }catch(e){}
try{ const _td=document.getElementById('topbar-date'); if(_td) _td.textContent=fmtDate(getTODAY())+' '+DAYS_RU[getTODAY().getDay()]+' · '+MONTHS_RU[getTODAY().getMonth()]; }catch(e){}
try{ _dedupeFlowTasks(); }catch(e){}   // repair any duplicate flow tasks from older builds
try{ _migrateManualDone(); }catch(e){} // persistent "done" marks (no daily reset)
try{ _seedActLog(); }catch(e){}        // seed the История action log from existing marks (one-time)
try{ _consolidateClientsToJune(); clients = load('dc_clients',[]); historyData = load('dc_history',{}); }catch(e){}  // one-time: move a set of clients' history into июнь 2026
try{ _dedupeClients(); clients = load('dc_clients',[]); }catch(e){}   // one-time: remove empty duplicate client records (Macro Beauty ↔ macrobeauty)
try{ _cleanupAutoZones(); }catch(e){}     // разово: убрать зоны будущих месяцев, созданные автоматически
try{ _ensureZonesForData(); }catch(e){}   // месяц с отметками всегда доступен как зона и содержит своих клиентов
render();
try{ if(typeof _syncInit==='function') _syncInit(); }catch(e){}  // cloud sync (if configured)
setTimeout(renderMonthBar, 0);

(function(){
  const VIEWS = ['home','day_today','today','planner','history','clients','finance','flows','invoices'];

  function ensureWrapper(){
    const main = document.getElementById('main-content');
    if(!main || main.parentElement.id === 'swipe-clip') return;
    const clip = document.createElement('div');
    clip.id = 'swipe-clip';
    clip.style.cssText = 'overflow:hidden;position:relative;width:100%;height:100%;isolation:isolate;';
    main.parentNode.insertBefore(clip, main);
    clip.appendChild(main);
    main.style.cssText += 'will-change:transform;';
  }
  ensureWrapper();

  // ── Tab strip: a scroll is not a tap ──
  // The mobile nav is a horizontal scroll strip; lifting a finger after
  // swiping it used to fire the tab's onclick. Track finger movement and
  // cancel the click (capture phase, before the button's handler) if the
  // touch actually scrolled.
  (function(){
    const nav = document.querySelector('.navlist');
    if(!nav) return;
    let sx=0, sy=0, moved=false;
    nav.addEventListener('touchstart', e=>{ const t=e.touches[0]; sx=t.clientX; sy=t.clientY; moved=false; }, {passive:true});
    nav.addEventListener('touchmove', e=>{ const t=e.touches[0]; if(Math.abs(t.clientX-sx)>8 || Math.abs(t.clientY-sy)>8) moved=true; }, {passive:true});
    nav.addEventListener('click', e=>{ if(moved){ e.preventDefault(); e.stopPropagation(); moved=false; } }, true);
  })();

  // Keep the active tab visible when it scrolls off-screen on a narrow strip.
  function scrollActiveTabIntoView(){
    const a=document.querySelector('.navlist .tab.active');
    if(a && a.scrollIntoView){ try{ a.scrollIntoView({inline:'center',block:'nearest',behavior:'smooth'}); }catch(e){} }
  }

  // ── Жесты убраны ──
  // Свайпы вкладок (трекпад + палец) удалены по просьбе: они перехватывали
  // горизонтальную прокрутку сеток («Рассылки») и срабатывали не вовремя.
  // Навигация осталась: клик по вкладке, стрелки ←/→ и цифры 1–9.

  function modalsOpen(){
    return document.getElementById('cal-modal').style.display !== 'none'
        || document.getElementById('day-modal').style.display !== 'none';
  }

  function currentIndex(){ return Math.max(0, VIEWS.indexOf(view)); }

  function updateTabs(v){
    document.querySelectorAll('.tab').forEach(t => {
      const oc = t.getAttribute('onclick') || '';
      t.classList.toggle('active', oc.includes("'"+v+"'"));
    });
    try{ syncMoreTab(v); }catch(e){}   // пилюля «Ещё» в мобильном таб-баре
  }

  // ── Gesture navigation ──
  // Switch views instantly (same path as clicking a tab). The old transform
  // "slide" absolutely-positioned both views, which collapsed the page height
  // and jumped the scroll position mid-animation — that was the stretch/hang.
  function navTo(nextView){
    if(!nextView || nextView === view) return;
    _sfx.play('swipe');
    window.setView(nextView);
  }
  function goNext(){
    const i = currentIndex();
    if(i < VIEWS.length-1) navTo(VIEWS[i+1]);
  }
  function goPrev(){
    const i = currentIndex();
    if(i > 0) navTo(VIEWS[i-1]);
  }





  // ── Keyboard ──
  document.addEventListener('keydown', e => {
    const inInput = e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.tagName==='SELECT';

    if((e.ctrlKey||e.metaKey) && e.key==='z' && !inInput){
      e.preventDefault();
      undoLastCalendarChange();
      return;
    }

    if(e.key==='Escape'){
      const _ms=document.getElementById('more-sheet');
      if(_ms && _ms.classList.contains('open')){ closeMoreSheet(); return; }
      if(document.getElementById('cal-modal').style.display!=='none'){ closeCal(); return; }
      if(document.getElementById('day-modal').style.display!=='none'){ closeDayModal(); return; }
    }

    if(inInput) return;
    if(modalsOpen()) return;

    if(e.key==='ArrowRight'){ e.preventDefault(); goNext(); }
    if(e.key==='ArrowLeft'){ e.preventDefault(); goPrev(); }

    const numMap = {'1':'home','2':'day_today','3':'today','4':'planner','5':'history','6':'clients','7':'finance','8':'flows'};
    if(!e.ctrlKey && !e.metaKey && numMap[e.key]){
      e.preventDefault();
      window.setView(numMap[e.key]);
    }
  });

  window.setView = function(v){
    const _m = document.getElementById('main-content');
    if(_m){ _m.style.transform=''; _m.style.transition=''; }
    view = v;
    updateTabs(v);
    scrollActiveTabIntoView();
    render();
    // smooth content transition on view change (cheap opacity+translate, GPU only)
    if(_m && _m.animate){
      try{ _m.animate(
        [{opacity:0,transform:'translateY(10px)'},{opacity:1,transform:'none'}],
        {duration:300,easing:'cubic-bezier(.32,.72,0,1)'}
      ); }catch(e){}
    }
  };

})();
try{localStorage.removeItem('dc_accent_color');}catch(e){}  // fixed teal accent (#40cbe0) — color picker removed

// ── Авто-обновление ──────────────────────────────────────────
// GitHub Pages кэширует index.html на 10 минут, а установленное PWA — ещё дольше,
// поэтому после деплоя браузер продолжал крутить старый JS (и казалось, что
// «ничего не поменялось»). Сверяем свою версию ассетов с серверной и, если она
// устарела, один раз перезагружаемся по новому URL (чтобы не взять html из кэша).
(function(){
  const MY_V=(function(){
    try{
      const s=document.currentScript||[].slice.call(document.scripts).filter(x=>/js\/main\.js/.test(x.src||''))[0];
      const m=s&&(s.src||'').match(/[?&]v=([A-Za-z0-9.\-]+)/);
      return m?m[1]:'';
    }catch(e){ return ''; }
  })();
  if(!MY_V) return;

  // Версия списка задач из ClickUp (js/pending-inject.js?v=…). Бот переписывает
  // этот файл каждые 15 минут, поэтому открытую страницу не надо перезагружать
  // целиком: достаточно подгрузить свежий инжектор — он сам перезапишет
  // dc_plantasks (зеркало ClickUp) — и перерисовать вкладку.
  let MY_PI=(function(){
    try{
      const s=[].slice.call(document.scripts).filter(x=>/js\/pending-inject\.js/.test(x.src||''))[0];
      const m=s&&(s.src||'').match(/[?&]v=([A-Za-z0-9.\-]+)/);
      return m?m[1]:'';
    }catch(e){ return ''; }
  })();
  let piLoading=false;
  function pullTasks(newPI){
    if(piLoading || !newPI || newPI===MY_PI) return;
    piLoading=true; MY_PI=newPI;
    const s=document.createElement('script');
    s.src='js/pending-inject.js?v='+newPI;
    s.onload=function(){
      piLoading=false;
      try{ if(typeof render==='function') render(); }catch(e){}
      try{ if(typeof renderMonthBar==='function') renderMonthBar(); }catch(e){}
    };
    s.onerror=function(){ piLoading=false; };
    document.body.appendChild(s);
  }

  let checking=false, lastCheck=0;
  function banner(newV){
    if(document.getElementById('dc-update-bar')) return;
    const b=document.createElement('div');
    b.id='dc-update-bar';
    b.style.cssText='position:fixed;left:50%;transform:translateX(-50%);bottom:20px;z-index:9999;display:flex;align-items:center;gap:12px;'+
      'padding:10px 14px 10px 16px;border-radius:980px;font-family:var(--font);font-size:12.5px;color:#062227;'+
      'background:linear-gradient(180deg,#40cbe0,rgba(64,203,224,.82));box-shadow:0 10px 34px rgba(0,0,0,.5),0 1px 0 rgba(255,255,255,.45) inset';
    b.innerHTML='Доступна новая версия'+
      '<button style="border:none;cursor:pointer;font:inherit;font-weight:700;padding:5px 12px;border-radius:980px;background:rgba(6,34,39,.16);color:#062227">Обновить</button>';
    b.querySelector('button').onclick=function(){ location.replace(location.pathname+'?v='+newV); };
    document.body.appendChild(b);
  }
  function check(){
    const now=Date.now();
    if(checking||now-lastCheck<60000) return;      // не чаще раза в минуту
    checking=true; lastCheck=now;
    fetch('./index.html?cb='+now,{cache:'no-store'})
      .then(r=>r.ok?r.text():Promise.reject())
      .then(html=>{
        const pm=html.match(/js\/pending-inject\.js\?v=([A-Za-z0-9.\-]+)/);
        if(pm) pullTasks(pm[1]);                       // новые задачи из ClickUp — без перезагрузки
        const m=html.match(/js\/main\.js\?v=([A-Za-z0-9.\-]+)/);
        const newV=m&&m[1];
        if(!newV||newV===MY_V) return;
        const tried=sessionStorage.getItem('dc_reloaded_for');
        if(tried===newV){ banner(newV); return; }   // авто-перезагрузка не помогла → спросим
        sessionStorage.setItem('dc_reloaded_for',newV);
        location.replace(location.pathname+'?v='+newV);
      })
      .catch(()=>{})
      .then(()=>{ checking=false; });
  }
  // Если задан токен ClickUp, приложение подтягивает задачи само: при запуске и
  // при возврате в приложение, но не чаще раза в 5 минут. Бот остаётся страховкой
  // на случай, когда приложение не открыто.
  (function(){
    let lastCu=0;
    function cuTick(){
      try{
        if(typeof cuToken!=='function' || !cuToken()) return;
        if(typeof clickupPullNow!=='function') return;
        const now=Date.now(); if(now-lastCu<300000) return;
        lastCu=now; clickupPullNow(true);   // тихо: без звука и всплывашек
      }catch(e){}
    }
    setTimeout(cuTick, 2500);
    document.addEventListener('visibilitychange', function(){ if(!document.hidden) cuTick(); });
    window.addEventListener('focus', cuTick);
    setInterval(cuTick, 300000);
  })();

  setTimeout(check,1500);                                            // при запуске
  document.addEventListener('visibilitychange',function(){ if(!document.hidden) check(); });  // при возврате в приложение
  window.addEventListener('focus',check);
  setInterval(check,5*60*1000);   // и сама, раз в 5 минут: задачи из ClickUp приезжают, пока вкладка открыта
})();

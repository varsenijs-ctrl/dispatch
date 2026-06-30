// Build stamp — bump on each deploy so you can tell at a glance whether the
// running app has the latest files (если метки нет — крутится старый JS из кэша).
const BUILD='01.07 · рассылки-синк';
console.log('Dispatch build: '+BUILD+' — _overdue '+(typeof _overdue==='function'?'OK':'ОТСУТСТВУЕТ (старый код)'));
try{ const _bt=document.getElementById('build-tag'); if(_bt) _bt.textContent=BUILD; }catch(e){}
document.getElementById('topbar-date').textContent=fmtDate(getTODAY())+' '+DAYS_RU[getTODAY().getDay()]+' · '+MONTHS_RU[getTODAY().getMonth()];
try{ _dedupeFlowTasks(); }catch(e){}   // repair any duplicate flow tasks from older builds
try{ _migrateManualDone(); }catch(e){} // persistent "done" marks (no daily reset)
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

  // ── Trackpad / mouse wheel: one switch per swipe ──
  // macOS sends a long inertial "momentum" tail after a swipe. We switch once
  // when the threshold is crossed, then lock and swallow that tail so it can't
  // trigger a second switch. You can swipe again either when the wheel settles
  // (~90ms idle) OR immediately by pushing again: momentum only DECELERATES,
  // so a delta that rises back up past the decaying trend = a deliberate new
  // swipe, and we release the lock for it right away.
  let wAccumX = 0;
  let wLocked = false;
  let wPrevAbs = 0;
  let wDecaying = false;
  let wIdleTimer = null;
  let wResetTimer = null;  // forget a partial swipe that never reached threshold
  const W_THRESHOLD = 46;
  const W_IDLE = 90;
  function wUnlock(){ wLocked = false; wAccumX = 0; wPrevAbs = 0; wDecaying = false; clearTimeout(wIdleTimer); }

  document.addEventListener('wheel', e => {
    if(modalsOpen()) return;
    if(e.target.closest('.hist-wrap,.pcal-grid,.sidebar,.day-modal,.modal,.modal-overlay')) return;

    const ax = Math.abs(e.deltaX), ay = Math.abs(e.deltaY);
    if(ax < ay * 0.8 || ax < 2) return;   // vertical scroll → leave it alone
    e.preventDefault();

    if(wLocked){
      clearTimeout(wIdleTimer);
      wIdleTimer = setTimeout(wUnlock, W_IDLE);     // momentum stopped → unlock
      if(!wDecaying){ if(ax < wPrevAbs - 1) wDecaying = true; }   // wait for the peak
      else if(ax > wPrevAbs + 8 && ax >= 12){ wUnlock(); }        // rising again → new swipe
      wPrevAbs = ax;
      if(wLocked) return;   // still cooling down → swallow the momentum tail
    }

    wAccumX += e.deltaX;
    wPrevAbs = ax;
    clearTimeout(wResetTimer);
    wResetTimer = setTimeout(()=>{ wAccumX = 0; }, 130);

    if(Math.abs(wAccumX) >= W_THRESHOLD){
      const dir = wAccumX > 0 ? 1 : -1;
      wAccumX = 0;
      wLocked = true;
      wDecaying = false;
      wPrevAbs = ax;
      clearTimeout(wIdleTimer); wIdleTimer = setTimeout(wUnlock, W_IDLE);
      if(dir > 0) goNext(); else goPrev();
    }
  }, { passive: false });

  // ── Touch (mobile) ──
  // Ignore swipes that begin inside something horizontally scrollable (the tab
  // strip, calendar grid, tables) or a form control — there a sideways drag means
  // "scroll this", not "switch view".
  let tx = 0, ty = 0, tIgnore = false;
  document.addEventListener('touchstart', e => {
    tx = e.touches[0].clientX;
    ty = e.touches[0].clientY;
    tIgnore = !!(e.target.closest && e.target.closest('.navlist,.sidebar,.hist-wrap,.pcal-grid,.cal-grid,.day-modal,.modal,.modal-overlay,.month-bar,input,textarea,select'));
  }, { passive: true });
  document.addEventListener('touchend', e => {
    if(tIgnore || modalsOpen()) return;
    const dx = e.changedTouches[0].clientX - tx;
    const dy = e.changedTouches[0].clientY - ty;
    if(Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
    if(dx < 0) goNext(); else goPrev();
  }, { passive: true });

  // ── Keyboard ──
  document.addEventListener('keydown', e => {
    const inInput = e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.tagName==='SELECT';

    if((e.ctrlKey||e.metaKey) && e.key==='z' && !inInput){
      e.preventDefault();
      undoLastCalendarChange();
      return;
    }

    if(e.key==='Escape'){
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
const _savedAccent=localStorage.getItem('dc_accent_color');if(_savedAccent)setAccentColor(_savedAccent);

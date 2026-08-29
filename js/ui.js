const _sfx = (function(){
  let ctx=null;
  // Create context on first call, keep it alive
  function G(){
    if(!ctx){
      try{ ctx=new(window.AudioContext||window.webkitAudioContext)(); }catch(e){}
    }
    // Always resume — async, but schedules sounds ahead so they catch up
    if(ctx&&ctx.state!=='running'){ try{ctx.resume();}catch(e){} }
    return ctx;
  }
  // Pre-warm on any gesture
  ['click','touchstart','pointerdown','keydown'].forEach(function(ev){
    document.addEventListener(ev,function(){G();},{capture:true,passive:true});
  });

  function pink(c,gain){
    gain=gain||1;
    var bs=c.createBufferSource(),buf=c.createBuffer(1,44100,44100),d=buf.getChannelData(0);
    var b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
    for(var i=0;i<44100;i++){
      var w=Math.random()*2-1;
      b0=.99886*b0+w*.0555179;b1=.99332*b1+w*.0750759;b2=.96900*b2+w*.1538520;
      b3=.86650*b3+w*.3104856;b4=.55000*b4+w*.5329522;b5=-.7616*b5-w*.0168980;
      d[i]=(b0+b1+b2+b3+b4+b5+b6+w*.5362)*0.11*gain;b6=w*.115926;
    }
    bs.buffer=buf;return bs;
  }

  function play(type){
    var c=G();if(!c)return;
    try{
      // Schedule slightly ahead so async resume can catch up
      var t=c.currentTime+0.02;
      if(type==='click'){
        // dull, muffled "thud" (глухой стук) — low sine knock + short low-passed body
        var o=c.createOscillator(),g=c.createGain();
        o.type='sine';o.frequency.setValueAtTime(175,t);o.frequency.exponentialRampToValueAtTime(72,t+.06);
        g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.3,t+.005);g.gain.exponentialRampToValueAtTime(.0001,t+.12);
        o.connect(g);g.connect(c.destination);o.start(t);o.stop(t+.13);
        var n=pink(c,.5),lp=c.createBiquadFilter(),g2=c.createGain();
        lp.type='lowpass';lp.frequency.value=380;lp.Q.value=.7;
        g2.gain.setValueAtTime(.2,t);g2.gain.exponentialRampToValueAtTime(.0001,t+.06);
        n.connect(lp);lp.connect(g2);g2.connect(c.destination);n.start(t);n.stop(t+.08);
      }
      else if(type==='done'){
        [523,659,784].forEach(function(f,i){var o=c.createOscillator(),g=c.createGain();o.frequency.value=f;o.type='sine';var s=t+i*.07;g.gain.setValueAtTime(.12,s);g.gain.exponentialRampToValueAtTime(.001,s+.25);o.connect(g);g.connect(c.destination);o.start(s);o.stop(s+.25);});
      }
      else if(type==='open'){
        var n=pink(c,.55),lp=c.createBiquadFilter(),g=c.createGain();
        lp.type='bandpass';lp.frequency.value=600;lp.Q.value=.8;
        g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.8,t+.03);g.gain.exponentialRampToValueAtTime(.001,t+.26);
        n.connect(lp);lp.connect(g);g.connect(c.destination);n.start(t);n.stop(t+.4);
      }
      else if(type==='close'){
        var n=pink(c,.45),hp=c.createBiquadFilter(),g=c.createGain();
        hp.type='highpass';hp.frequency.value=800;
        g.gain.setValueAtTime(.6,t);g.gain.exponentialRampToValueAtTime(.001,t+.12);
        n.connect(hp);hp.connect(g);g.connect(c.destination);n.start(t);n.stop(t+.3);
      }
      else if(type==='swipe'){
        var n=pink(c,.65),lp=c.createBiquadFilter(),g=c.createGain();
        lp.type='lowpass';lp.frequency.value=400;
        g.gain.setValueAtTime(.01,t);g.gain.linearRampToValueAtTime(.7,t+.04);g.gain.exponentialRampToValueAtTime(.001,t+.45);
        n.connect(lp);lp.connect(g);g.connect(c.destination);n.start(t);n.stop(t+.5);
      }
      else if(type==='add'){
        var o=c.createOscillator(),g=c.createGain();
        o.frequency.setValueAtTime(600,t);o.frequency.linearRampToValueAtTime(900,t+.08);
        o.type='sine';g.gain.setValueAtTime(.1,t);g.gain.exponentialRampToValueAtTime(.001,t+.15);
        o.connect(g);g.connect(c.destination);o.start(t);o.stop(t+.15);
      }
      else if(type==='delete'){
        var n=pink(c,.5),bp=c.createBiquadFilter(),g=c.createGain();
        bp.type='bandpass';bp.frequency.setValueAtTime(3000,t);bp.frequency.exponentialRampToValueAtTime(500,t+.15);bp.Q.value=2;
        g.gain.setValueAtTime(.6,t);g.gain.exponentialRampToValueAtTime(.001,t+.18);
        n.connect(bp);bp.connect(g);g.connect(c.destination);n.start(t);n.stop(t+.22);
      }
      else if(type==='warn'||type==='error'){
        [0,.15].forEach(function(d){var o=c.createOscillator(),g=c.createGain();o.frequency.value=220;o.type='sawtooth';g.gain.setValueAtTime(.06,t+d);g.gain.exponentialRampToValueAtTime(.001,t+d+.1);o.connect(g);g.connect(c.destination);o.start(t+d);o.stop(t+d+.12);});
      }
      else if(type==='invoice'){
        [660,880].forEach(function(f,i){var o=c.createOscillator(),g=c.createGain();o.frequency.value=f;o.type='sine';var s=t+i*.06;g.gain.setValueAtTime(.09,s);g.gain.exponentialRampToValueAtTime(.001,s+.15);o.connect(g);g.connect(c.destination);o.start(s);o.stop(s+.18);});
      }
      else if(type==='success'){
        [523,659,784,1047].forEach(function(f,i){var o=c.createOscillator(),g=c.createGain();o.frequency.value=f;o.type='sine';var s=t+i*.06;g.gain.setValueAtTime(.1,s);g.gain.exponentialRampToValueAtTime(.001,s+.35);o.connect(g);g.connect(c.destination);o.start(s);o.stop(s+.4);});
      }
    }catch(e){}
  }
  return {play:play};
})()

// ── Accent color / theme ─────────────────────────────────────
// (Previously referenced by the topbar color picker but never defined, so the
//  whole feature was dead. Implemented here.)
function _hexToRgb(hex){
  hex=String(hex||'').trim().replace(/^#/,'');
  if(hex.length===3) hex=hex.split('').map(function(c){return c+c;}).join('');
  if(hex.length!==6 || /[^0-9a-fA-F]/.test(hex)) return null;
  const n=parseInt(hex,16);
  return [(n>>16)&255,(n>>8)&255,n&255];
}
function setAccentColor(hex){
  const rgb=_hexToRgb(hex);
  if(!rgb) return;
  const r=rgb[0],g=rgb[1],b=rgb[2];
  const norm='#'+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);
  const s=document.documentElement.style;
  s.setProperty('--accent',norm);
  s.setProperty('--accent-rgb',r+','+g+','+b);
  s.setProperty('--accent-dim','rgba('+r+','+g+','+b+',.15)');
  s.setProperty('--accent-glow','rgba('+r+','+g+','+b+',.35)');
  s.setProperty('--accent-border','rgba('+r+','+g+','+b+',.3)');
  try{ localStorage.setItem('dc_accent_color',norm); }catch(e){}
  const inp=document.getElementById('custom-color-input');
  if(inp) inp.value=norm;
}
function toggleColorPicker(){
  const p=document.getElementById('color-picker-popup');
  if(!p) return;
  p.style.display=(p.style.display==='none'||!p.style.display)?'block':'none';
}

// ── Universal click feedback: a dull thud on every button press ──
// Capture phase so it still fires when the handler re-renders/removes the button.
document.addEventListener('click', function(e){
  const el = e.target;
  if(el && el.closest && el.closest('button')) _sfx.play('click');
}, true);

// ── iOS liquid-glass switch: flip state + replay the liquid knob animation ──
// (sound comes from the universal button listener above, so none here)
function _iosSwitch(el){
  const on = el.classList.toggle('on');
  el.setAttribute('aria-checked', on ? 'true' : 'false');
  el.classList.remove('flip');
  void el.offsetWidth;        // force reflow so the keyframe restarts every toggle
  el.classList.add('flip');
  setTimeout(function(){ el.classList.remove('flip'); }, 480);
  return on;
}

// ── Лист «Ещё» (мобильный таб-бар) ───────────────────────────────────────────
// В таб-бар влезает пять пилюль, поэтому История/Клиенты/Финансы/Флоу/Инвойсы
// живут в выезжающем листе — на телефоне доступны все девять вкладок.
const MORE_VIEWS = ['history','clients','finance','flows','invoices'];
function toggleMoreSheet(){
  const s=document.getElementById('more-sheet'); if(!s) return;
  if(s.classList.contains('open')){ closeMoreSheet(); return; }
  s.querySelectorAll('.more-item').forEach(function(b){
    b.classList.toggle('active', b.getAttribute('data-view')===view);
  });
  s.classList.add('open');
  try{ _sfx.play('click'); }catch(e){}
}
function closeMoreSheet(){
  const s=document.getElementById('more-sheet'); if(s) s.classList.remove('open');
}
function moreGo(v){ closeMoreSheet(); window.setView(v); }
// Пилюля «Ещё» подсвечена, пока открыта одна из её вкладок
function syncMoreTab(v){
  const m=document.getElementById('tab-more');
  if(m) m.classList.toggle('active', MORE_VIEWS.indexOf(v)>=0);
}

// ── Стрик: навязчивые напоминания ────────────────────────────────────────────
// Правило простое: стрик держится, пока не сорван ни один срок. Поэтому пока есть
// незакрытый дедлайн, приложение не даёт об этом забыть — полоса поверх интерфейса,
// пульсирующий счётчик в сайдбаре и системное уведомление (если разрешено).
function _streakBanner(streak, risk){
  let el=document.getElementById('streak-banner');
  if(!risk.length){ if(el) el.remove(); document.body.classList.remove('has-streak-banner'); return; }
  if(!el){
    el=document.createElement('div');
    el.id='streak-banner';
    document.body.appendChild(el);
  }
  document.body.classList.add('has-streak-banner');
  const first=risk[0];
  const what=(first.clientName?first.clientName+' — ':'')+(first.text||'задача');
  const head=streak>0
    ? '<b>'+streak+' '+_plural(streak,'день','дня','дней')+' без просрочек под угрозой</b>'
    : '<b>Стрик сброшен — закрой просроченное и начни заново</b>';
  el.innerHTML='<span class="sb-flame">🔥</span>'
    +'<span class="sb-txt">'+head+' · '
    +risk.length+' '+_plural(risk.length,'срок','срока','сроков')+' просрочено: '+esc(what).slice(0,70)+'</span>'
    +'<button class="sb-go" onclick="setView(\'day_today\')">Закрыть</button>'
    +'<button class="sb-mute" onclick="_streakSnooze()" title="Скрыть до завтра">×</button>';
}
function _streakSnooze(){
  _markStreakNudge('banner');
  const el=document.getElementById('streak-banner');
  if(el) el.remove();
  document.body.classList.remove('has-streak-banner');
  showToast('Ок, напомню завтра — но стрик всё равно сгорит');
}
// Разрешение на уведомления просим только по кнопке — иначе браузер откажет молча
function streakNotifyAsk(){
  if(!('Notification' in window)){ showToast('Этот браузер не умеет уведомления'); return; }
  Notification.requestPermission().then(function(p){
    gsave('dc_streak_notify', p==='granted'?'1':'0');
    showToast(p==='granted'?'🔔 Буду напоминать про сроки':'Уведомления запрещены в браузере');
    render();
  });
}
function _streakNotify(streak, risk){
  try{
    if(!('Notification' in window) || Notification.permission!=='granted') return;
    const now=new Date();
    const due=(typeof _dueToday==='function')?_dueToday():[];
    // Утром напоминаем про просроченное, вечером — про сроки, которые истекают
    // сегодня: до конца дня их ещё можно закрыть и не потерять стрик.
    const slot=now.getHours()>=18?'evening':(now.getHours()>=10?'morning':'');
    if(!slot || _streakNudgeShown(slot)) return;
    const list=(slot==='evening'&&due.length)?due:risk;
    if(!list.length) return;
    _markStreakNudge(slot);
    const first=list[0];
    const title=(list===due)
      ? ('⏳ Сегодня истекает '+due.length+' '+_plural(due.length,'срок','срока','сроков'))
      : ('🔥 Стрик '+streak+' '+_plural(streak,'день','дня','дней')+' под угрозой');
    new Notification(title, {
      body: ((first.clientName?first.clientName+' — ':'')+(first.text||'')).slice(0,80)
            +(list===due?' · закрой до конца дня, чтобы стрик не сгорел':' · срок уже прошёл'),
      tag: 'dc-streak', renotify: true
    });
  }catch(e){}
}
function _streakNudge(streak, risk){
  if(!_streakNudgeShown('banner')) _streakBanner(streak, risk);
  _streakNotify(streak, risk);
}

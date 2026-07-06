/* ═══════════════════════════════════════════════════════
   Cloud sync via Supabase (optional, user-configured)
   - Credentials are entered in the app (stored locally), NOT in the source,
     so the public GitHub Pages repo contains no secrets.
   - Whole-state push/pull (last-write-wins) + realtime + polling fallback.
   ═══════════════════════════════════════════════════════ */
const SYNC = {
  url(){ return gload('dc_sync_url',''); },
  key(){ return gload('dc_sync_key',''); },
  code(){ return gload('dc_sync_code',''); },
  device(){ let d=gload('dc_sync_device',''); if(!d){ d='dev_'+Math.random().toString(36).slice(2,8); gsave('dc_sync_device',d);} return d; },
  enabled(){ return !!(this.url() && this.key() && this.code()); }
};
let _sbClient=null, _syncPushTimer=null, _syncApplying=false, _syncChan=null, _syncPolling=false;

async function _sb(){
  if(_sbClient) return _sbClient;
  if(!SYNC.enabled()) return null;
  const m = await import('https://esm.sh/@supabase/supabase-js@2');
  _sbClient = m.createClient(_syncCleanUrl(SYNC.url()), SYNC.key(), {auth:{persistSession:false}});
  return _sbClient;
}
// Accept what people actually paste: strip an accidental /rest/v1 (REST endpoint),
// query strings and trailing slashes, leaving just https://xxxx.supabase.co
function _syncCleanUrl(u){
  u=(u||'').trim().replace(/\s+/g,'');
  u=u.replace(/[?#].*$/,'');          // drop query/hash
  u=u.replace(/\/rest\/v1.*$/i,'');   // drop accidental REST path
  u=u.replace(/\/+$/,'');             // drop trailing slash(es)
  return u;
}
function _syncStatus(msg,cls){ const el=document.getElementById('sync-status'); if(el){ el.textContent=msg; el.dataset.cls=cls||''; } }

// All shareable dc_* keys (exclude the local-only sync config)
function _syncCollect(){
  const data={};
  for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k&&k.indexOf('dc_')===0&&k.indexOf('dc_sync_')!==0) data[k]=localStorage.getItem(k); }
  return data;
}
function _syncApply(data){
  if(!data) return;
  _syncApplying=true;
  try{
    const del=[]; for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k&&k.indexOf('dc_')===0&&k.indexOf('dc_sync_')!==0) del.push(k); }
    del.forEach(function(k){ localStorage.removeItem(k); });
    Object.keys(data).forEach(function(k){ if(k.indexOf('dc_')===0&&k.indexOf('dc_sync_')!==0) localStorage.setItem(k, data[k]); });
  } finally { _syncApplying=false; }
}

async function syncPushNow(){
  try{
    const sb=await _sb(); if(!sb) return;
    _syncStatus('⬆ выгрузка…','load');
    const row={ id:SYNC.code(), data:_syncCollect(), device:SYNC.device(), updated_at:new Date().toISOString() };
    const {error}=await sb.from('dispatch_sync').upsert(row);
    if(error){ _syncStatus('⚠ '+error.message,'err'); return; }
    gsave('dc_sync_ts', row.updated_at);
    _syncStatus('✓ синхронизировано','');
  }catch(e){ _syncStatus('⚠ '+(e.message||'ошибка сети'),'err'); }
}
function _syncSchedulePush(){ if(!SYNC.enabled()||_syncApplying) return; clearTimeout(_syncPushTimer); _syncPushTimer=setTimeout(syncPushNow, 1500); }

async function syncPullNow(silent){
  try{
    const sb=await _sb(); if(!sb) return;
    if(!silent) _syncStatus('⬇ загрузка…','load');
    const {data,error}=await sb.from('dispatch_sync').select('data,updated_at,device').eq('id',SYNC.code()).maybeSingle();
    if(error){ _syncStatus('⚠ '+error.message,'err'); return false; }
    if(!data){ _syncStatus('облако пусто',''); return false; }
    _syncApply(data.data);
    gsave('dc_sync_ts', data.updated_at);
    _syncStatus('✓ загружено','');
    showToast('🔄 Данные обновлены из облака');
    setTimeout(function(){ location.reload(); }, 450);
    return true;
  }catch(e){ _syncStatus('⚠ '+(e.message||'ошибка сети'),'err'); return false; }
}

async function _syncSubscribe(){
  try{
    const sb=await _sb(); if(!sb) return;
    if(_syncChan){ try{ sb.removeChannel(_syncChan); }catch(e){} _syncChan=null; }
    _syncChan=sb.channel('dc_'+SYNC.code())
      .on('postgres_changes',{event:'*',schema:'public',table:'dispatch_sync',filter:'id=eq.'+SYNC.code()},function(payload){
        const row=payload.new; if(!row||!row.data) return;
        if(row.device===SYNC.device()) return;                 // ignore our own push
        if(row.updated_at && row.updated_at===gload('dc_sync_ts','')) return;
        _syncApply(row.data); gsave('dc_sync_ts',row.updated_at);
        showToast('🔄 Обновлено с другого устройства');
        setTimeout(function(){ location.reload(); }, 450);
      }).subscribe();
  }catch(e){}
}
function _syncStartPolling(){
  if(_syncPolling) return; _syncPolling=true;
  setInterval(async function(){
    if(!SYNC.enabled()||document.hidden) return;
    try{
      const sb=await _sb(); if(!sb) return;
      const {data}=await sb.from('dispatch_sync').select('updated_at,device').eq('id',SYNC.code()).maybeSingle();
      if(data && data.device!==SYNC.device() && data.updated_at!==gload('dc_sync_ts','')) syncPullNow(true);
    }catch(e){}
  }, 20000);
}

async function syncConnect(){
  const url=(document.getElementById('sync-url')||{}).value||'';
  const key=(document.getElementById('sync-key')||{}).value||'';
  const code=(document.getElementById('sync-code')||{}).value||'';
  let keyVal=key.trim();
  if(/^[•·∙*]+$/.test(keyVal)) keyVal=SYNC.key();   // field shows a mask → keep the saved key
  if(!url.trim()||!keyVal||!code.trim()){ showToast('Заполни URL, ключ и код'); return; }
  gsave('dc_sync_url',_syncCleanUrl(url)); gsave('dc_sync_key',keyVal); gsave('dc_sync_code',code.trim());
  _sbClient=null;
  _syncStatus('проверка…','load');
  let sb; try{ sb=await _sb(); }catch(e){ _syncStatus('⚠ не загрузился клиент','err'); return; }
  if(!sb){ _syncStatus('⚠ нет данных','err'); return; }
  let res;
  try{ res=await sb.from('dispatch_sync').select('data,updated_at').eq('id',code.trim()).maybeSingle(); }
  catch(e){ _syncStatus('⚠ '+(e.message||'ошибка'),'err'); return; }
  if(res.error){ _syncStatus('⚠ '+res.error.message,'err'); showToast('Ошибка: '+res.error.message); return; }
  if(res.data){
    const when=new Date(res.data.updated_at).toLocaleString();
    if(confirm('В облаке уже есть данные (обновлены '+when+').\n\nОК — загрузить из облака (заменить локальные).\nОтмена — выгрузить локальные в облако (заменить облачные).')){
      await syncPullNow();
    } else {
      await syncPushNow();
    }
  } else {
    await syncPushNow();   // create the row from local data
  }
  _syncSubscribe(); _syncStartPolling();
  render();
}
function syncDisconnect(){
  ['dc_sync_url','dc_sync_key','dc_sync_code'].forEach(function(k){ localStorage.removeItem(k); });
  _sbClient=null; if(_syncChan){ try{ _sbClient&&_sbClient.removeChannel(_syncChan); }catch(e){} _syncChan=null; }
  showToast('Синхронизация отключена'); render();
}

// Auto-push on any data change (chains onto the existing save/gsave wrappers)
const _origSaveSync=save;  save  = function(k,v){ _origSaveSync(k,v);  if(String(k).indexOf('dc_sync')!==0) _syncSchedulePush(); };
const _origGsaveSync=gsave; gsave = function(k,v){ _origGsaveSync(k,v); if(String(k).indexOf('dc_sync')!==0) _syncSchedulePush(); };

// Settings panel (rendered inside the Clients data area)
function renderSyncPanel(){
  const on=SYNC.enabled();
  const url=esc(_syncCleanUrl(SYNC.url())), code=esc(SYNC.code()), key=esc(SYNC.key());
  return `<div style="border-top:1px solid var(--glass-border2);margin-top:14px;padding-top:14px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
      <h3 style="margin:0">Синхронизация (облако)</h3>
      <span style="font-size:11px;color:${on?'var(--green)':'var(--text3)'};font-family:var(--mono)">${on?'● подключено':'○ выкл'}</span>
    </div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:10px;line-height:1.6">Supabase: введи данные проекта и общий «код синхронизации» — одинаковый на всех устройствах. Ключ хранится только на устройстве.</div>
    <div style="display:flex;flex-direction:column;gap:8px;max-width:520px">
      <input id="sync-url" placeholder="Project URL (https://xxxx.supabase.co)" value="${url}" style="background:rgba(255,255,255,.07);border:1px solid var(--glass-border2);color:var(--text);font-family:var(--mono);font-size:11px;padding:9px 12px;border-radius:13px;outline:none">
      <input id="sync-key" type="password" placeholder="anon public key" value="${key}" style="background:rgba(255,255,255,.07);border:1px solid var(--glass-border2);color:var(--text);font-family:var(--mono);font-size:11px;padding:9px 12px;border-radius:13px;outline:none">
      <input id="sync-code" placeholder="Код синхронизации (придумай, держи в секрете)" value="${code}" style="background:rgba(255,255,255,.07);border:1px solid var(--glass-border2);color:var(--text);font-family:var(--mono);font-size:11px;padding:9px 12px;border-radius:13px;outline:none">
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;align-items:center">
      <button class="btn-add" onclick="syncConnect()">${on?'↻ Переподключить':'Подключить'}</button>
      ${on?`<button class="toggle-btn" onclick="syncPushNow()">⬆ Выгрузить</button>
      <button class="toggle-btn" onclick="syncPullNow()">⬇ Загрузить</button>
      <button class="toggle-btn" onclick="syncDisconnect()" style="color:var(--red);border-color:rgba(251,113,133,.3)">Отключить</button>`:''}
      <span id="sync-status" style="font-size:11px;color:var(--text3);font-family:var(--mono);margin-left:4px"></span>
    </div>
  </div>`;
}

/* ═══════════════════════════════════════════════════════
   Google Sheets push — mirror per-date statuses into a Google Sheet via a
   user-deployed Apps Script web app. Fire-and-forget (no-cors) so a status
   tick in Dispatch lands in the sheet's right month tab + client column.
   ═══════════════════════════════════════════════════════ */
function _sheetUrl(){ return gload('dc_sheet_sync_url',''); }
function _sheetPush(client, iso, status){
  const url=_sheetUrl(); if(!url) return;
  try{
    fetch(url,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},
      body:JSON.stringify({client:client,iso:iso,status:status})});
  }catch(e){}
}
// One-shot backfill: send every recorded status in one bulk request
function sheetPushAll(){
  const url=_sheetUrl(); if(!url){ showToast('Сначала укажи URL таблицы'); return; }
  const bulk=[];
  // one global history store
  const hist=load('dc_history',{});
  Object.keys(hist).forEach(name=>{ const days=hist[name]||{}; Object.keys(days).forEach(iso=>{ if(days[iso]) bulk.push({client:name,iso:iso,status:days[iso]}); }); });
  if(!bulk.length){ showToast('Нет отмеченных статусов'); return; }
  try{
    fetch(url,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({bulk:bulk})});
    showToast('⬆ Отправил '+bulk.length+' отметок в таблицу');
  }catch(e){ showToast('Ошибка отправки'); }
}
// Push the active work zone's actual statuses to the sheet. Only writes yes/draft/no
// that exist in the app — NEVER clears cells (the sheet's manual 'no' must survive).
function sheetMirrorZone(){
  const url=_sheetUrl(); if(!url){ showToast('Сначала укажи URL таблицы'); return; }
  const ac=clients.filter(c=>c.active);
  const bulk=[];
  ac.forEach(c=>{ const h=historyData[c.name]||{}; Object.keys(h).forEach(iso=>{ if(h[iso]) bulk.push({client:c.name,iso:iso,status:h[iso]}); }); });
  if(!bulk.length){ showToast('Нет статусов в этой зоне'); return; }
  try{
    fetch(url,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({bulk:bulk})});
    showToast('⬆ Отправил '+bulk.length+' статусов зоны '+(typeof _finZoneLabel==='function'?_finZoneLabel():activeMonth));
  }catch(e){ showToast('Ошибка отправки'); }
}
function saveSheetUrl(){
  const v=(document.getElementById('sheet-sync-url')||{}).value||'';
  gsave('dc_sheet_sync_url', v.trim());
  if(typeof _cacheInvalidate==='function') _cacheInvalidate();   // gsave doesn't bump the view cache
  showToast(v.trim()?'✓ URL таблицы сохранён':'URL очищен');
  render();
}
function renderSheetSyncPanel(){
  const url=esc(_sheetUrl());
  const on=!!_sheetUrl();
  return `<div style="border-top:1px solid var(--glass-border2);margin-top:14px;padding-top:14px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
      <h3 style="margin:0">Google-таблица (статусы)</h3>
      <span style="font-size:11px;color:${on?'var(--green)':'var(--text3)'};font-family:var(--mono)">${on?'● подключено':'○ выкл'}</span>
    </div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:10px;line-height:1.6">Когда отмечаешь статус (yes/draft/no), приложение пишет его в твою Google-таблицу: само находит вкладку месяца и приблизительно — клиента. Нужен URL Apps Script Web App (см. инструкцию).</div>
    <div style="display:flex;flex-direction:column;gap:8px;max-width:560px">
      <input id="sheet-sync-url" placeholder="https://script.google.com/macros/s/…/exec" value="${url}" style="background:rgba(255,255,255,.07);border:1px solid var(--glass-border2);color:var(--text);font-family:var(--mono);font-size:11px;padding:9px 12px;border-radius:13px;outline:none">
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;align-items:center">
      <button class="btn-add" onclick="saveSheetUrl()">Сохранить</button>
      ${on?`<button class="toggle-btn" onclick="sheetMirrorZone()">⬆ Отправить статусы этой зоны</button>`:''}
      ${on?`<button class="toggle-btn" onclick="sheetPushAll()">⬆ Отправить все статусы</button>`:''}
    </div>
    ${on?`<div style="font-size:11px;color:var(--text3);margin-top:8px;line-height:1.5">Отправляет твои отметки (yes/draft/no) в таблицу. Ничего не стирает — ячейки, которых нет в приложении, в таблице остаются как есть.</div>`:''}
  </div>`;
}

// Startup: if configured, subscribe + pull-if-remote-is-newer + poll
async function _syncInit(){
  if(!SYNC.enabled()) return;
  _syncSubscribe(); _syncStartPolling();
  try{
    const sb=await _sb(); if(!sb) return;
    const {data}=await sb.from('dispatch_sync').select('updated_at,device').eq('id',SYNC.code()).maybeSingle();
    if(data && data.updated_at && data.updated_at!==gload('dc_sync_ts','') && data.device!==SYNC.device()){
      syncPullNow(true);
    }
  }catch(e){}
}

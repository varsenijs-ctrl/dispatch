// Fetch ClickUp tasks assigned to the API-token's owner (Arsenijs), keep the
// open ones due within the next SYNC_DAYS_AHEAD days (plus anything overdue),
// and rewrite the RAW list + INJECT_VERSION inside js/pending-inject.js.
//
// Client matching is intentionally NOT done here — it happens in the browser
// (pending-inject.js) where the real Dispatch client list lives. We only pass
// the task name, its list name and the due timestamp.
//
// Requires env CLICKUP_TOKEN. Optional: CLICKUP_TEAM_ID, SYNC_DAYS_AHEAD.

import { readFileSync, writeFileSync } from 'node:fs';

const TOKEN = process.env.CLICKUP_TOKEN;
const DAYS  = parseInt(process.env.SYNC_DAYS_AHEAD || '12', 10);
if (!TOKEN) { console.error('❌ CLICKUP_TOKEN is not set (add it as a repo secret).'); process.exit(1); }

const API = 'https://api.clickup.com/api/v2';
const headers = { Authorization: TOKEN };

async function get(path) {
  const res = await fetch(API + path, { headers });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status} ${await res.text()}`);
  return res.json();
}

const DONE_STATUSES = new Set(['done', 'complete', 'completed', 'closed', 'cancelled', 'canceled']);

// ClickUp priority → level: urgent 4 · high 3 · normal 2 · low 1 · none 0
function prioLevel(p) {
  const s = p && (typeof p === 'object' ? p.priority : p);
  return ({ urgent: 4, high: 3, normal: 2, low: 1 })[String(s || '').toLowerCase()] || 0;
}

try {
  // 1) who owns the token
  const me = await get('/user');
  const uid = String(me.user.id);
  console.log(`User: ${me.user.username} (${uid})`);

  // 2) which workspace/team
  let teamId = process.env.CLICKUP_TEAM_ID;
  if (!teamId) {
    const teams = await get('/team');
    teamId = (teams.teams && teams.teams[0] && teams.teams[0].id) || '90121718809';
  }
  console.log(`Team: ${teamId}`);

  // 3) all open tasks assigned to me, sorted by due date (paginated)
  const horizon = Date.now() + DAYS * 24 * 3600 * 1000;
  let collected = [], page = 0;
  while (true) {
    const q = new URLSearchParams({
      page: String(page),
      include_closed: 'false',
      subtasks: 'true',
      order_by: 'due_date',
    });
    q.append('assignees[]', uid);
    const data = await get(`/team/${teamId}/task?` + q.toString());
    const arr = data.tasks || [];
    collected = collected.concat(arr);
    if (arr.length < 100) break;
    if (++page > 20) break;
  }
  console.log(`Fetched ${collected.length} assigned tasks.`);

  // 4) keep open tasks that have a due date within the horizon (overdue included)
  const raw = collected
    .filter(t => {
      const st = (t.status && (t.status.status || '')).toLowerCase();
      const type = (t.status && (t.status.type || '')).toLowerCase();
      if (DONE_STATUSES.has(st) || type === 'closed' || type === 'done') return false;
      if (!t.due_date) return false;
      return Number(t.due_date) <= horizon;
    })
    .sort((a, b) => Number(a.due_date) - Number(b.due_date))
    .map(t => ({
      id: t.id,
      name: t.name,
      list: (t.list && t.list.name) || '',
      due: String(t.due_date),
      prio: prioLevel(t.priority),
    }));

  console.log(`Keeping ${raw.length} open tasks due within ${DAYS} days.`);

  // 5) rewrite js/pending-inject.js
  const path = 'js/pending-inject.js';
  let src = readFileSync(path, 'utf8');

  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const version = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}T001`;

  src = src.replace(/var INJECT_VERSION\s*=\s*'[^']*';/, `var INJECT_VERSION = '${version}';`);

  const block = JSON.stringify(raw, null, 2)
    .split('\n').map((l, i) => (i === 0 ? l : '  ' + l)).join('\n'); // indent to match file
  src = src.replace(/\/\*RAW_START\*\/[\s\S]*?\/\*RAW_END\*\//, `/*RAW_START*/${block}/*RAW_END*/`);

  writeFileSync(path, src);

  // Bump the cache-bust for pending-inject.js in index.html so browsers/PWA fetch
  // the fresh list (otherwise the fixed ?v= would serve a cached, stale file).
  try {
    let html = readFileSync('index.html', 'utf8');
    const bust = version.replace(/[^0-9A-Za-z]/g, '');   // e.g. 20260703T001 → 20260703001
    const next = html.replace(/js\/pending-inject\.js\?v=[^"']*/, `js/pending-inject.js?v=${bust}`);
    if (next !== html) { writeFileSync('index.html', next); console.log(`↻ index.html pending-inject ?v=${bust}`); }
  } catch (e) { console.error('index.html version bump skipped:', e.message); }

  console.log(`✅ Wrote ${raw.length} tasks · version ${version}`);
} catch (err) {
  console.error('❌ Sync failed:', err.message);
  process.exit(1);
}

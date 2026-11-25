// Arcade leaderboard: weekly top 10 for each game, kept in Netlify Blobs.
// GET  /api/scores            -> { week, boards: { game: [{ n, s }] } }
// POST /api/scores {game,name,score} -> { ok, rank, board }
// Honor system, with sanity limits: known games only, a score ceiling per game,
// clean short names, and one submission per visitor every few seconds.
import { getStore } from '@netlify/blobs';

export const GAMES = {
  'city-beat': 3_000_000,
  'donut-patrol': 2_000_000,
  'best-in-the-game': 10_000_000,
  'road-rage-fighter': 1_000,
  'fare-game': 250_000,
};
const TOP = 10;
const GAP_MS = 8000;
const recent = new Map();

// lowercase fragments a name may not contain (checked with spaces, dots and digits-for-letters removed)
const BLOCK = ['fuck','shit','cunt','nigg','fag','dick','cock','pussy','bitch','whore','slut','rape','nazi','hitler','kike','chink','retard','tranny','penis','vagina','porn','tits','twat','wank','kkk'];
const unleet = (s) => s.toLowerCase().replace(/[\s._-]/g, '').replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's').replace(/7/g, 't').replace(/\$/g, 's');

export const cleanName = (raw) => {
  const n = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!/^[A-Za-z0-9 _.\-]{2,16}$/.test(n)) return null;
  const u = unleet(n);
  if (BLOCK.some((w) => u.includes(w))) return null;
  return n;
};

// ISO-ish week key in New York time, so the board resets Monday 12 a.m. ET
export const weekKey = (now = Date.now()) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: 'numeric', day: 'numeric' })
    .formatToParts(new Date(now)).map((x) => [x.type, x.value]));
  const d = new Date(Date.UTC(+p.year, +p.month - 1, +p.day));
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
};

const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra },
  });

export async function readAll(store, week) {
  const boards = {};
  for (const g of Object.keys(GAMES)) boards[g] = (await store.get(`${week}/${g}`, { type: 'json' })) || [];
  return boards;
}

export async function submit(store, week, { game, name, score }) {
  if (!(game in GAMES)) return { error: 'unknown_game' };
  const n = cleanName(name);
  if (!n) return { error: 'bad_name' };
  const s = Math.floor(Number(score));
  if (!Number.isFinite(s) || s <= 0 || s > GAMES[game]) return { error: 'bad_score' };
  const key = `${week}/${game}`;
  const board = (await store.get(key, { type: 'json' })) || [];
  const at = new Date().toISOString();
  const mine = board.find((r) => r.n.toLowerCase() === n.toLowerCase());
  if (mine) { if (s > mine.s) { mine.s = s; mine.at = at; } } else board.push({ n, s, at });
  board.sort((a, b) => b.s - a.s || a.at.localeCompare(b.at));
  const top = board.slice(0, TOP);
  await store.setJSON(key, top);
  const rank = top.findIndex((r) => r.n.toLowerCase() === n.toLowerCase()) + 1;
  return { ok: true, rank: rank || null, board: top.map(({ n, s }) => ({ n, s })) };
}

export default async (req, context) => {
  const store = getStore('arcade');
  const week = weekKey();
  if (req.method === 'GET') {
    const boards = await readAll(store, week);
    const out = {};
    for (const [g, b] of Object.entries(boards)) out[g] = b.map(({ n, s }) => ({ n, s }));
    return json({ week, boards: out }, 200, { 'Netlify-CDN-Cache-Control': 'public, durable, s-maxage=15, stale-while-revalidate=30' });
  }
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const ip = (context && context.ip) || req.headers.get('x-nf-client-connection-ip') || 'x';
  const last = recent.get(ip) || 0;
  if (Date.now() - last < GAP_MS) return json({ error: 'slow_down' }, 429);
  recent.set(ip, Date.now());
  if (recent.size > 5000) recent.clear();
  let body;
  try { body = await req.json(); } catch { return json({ error: 'bad_request' }, 400); }
  const r = await submit(store, week, body || {});
  return json(r, r.error ? 400 : 200);
};

export const config = { path: '/api/scores' };

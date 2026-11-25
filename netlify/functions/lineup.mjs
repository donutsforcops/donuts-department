// "Lineup preview": which products are lined up for each upcoming donutsforcops show.
// Needs WHATNOT_SHOP_TOKEN with "Read inventory", "Read merchandising" and "Read shows".
// Whatnot has no "list a show's products" call, so this walks recent products and asks which
// shows each one is in. Answers are saved (Netlify Blobs) and refreshed a few at a time.
import { getStore } from '@netlify/blobs';

const API = 'https://api.whatnot.com/seller-api/rest/v2';
const PRODUCT_PAGES = 4;          // newest 200 products
const PER_CALL = 30;              // product lookups per request
const PARALLEL = 3;               // stays well under Whatnot's 10 requests/second
const FRESH_MS = 3 * 3600e3;      // re-check a product's shows every 3 hours
const PER_SHOW = 24;

const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=0, must-revalidate', ...extra },
  });

export async function compute({ token, store, now = Date.now(), fetchImpl = fetch }) {
  const get = async (path) => {
    const r = await fetchImpl(API + path, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
    if (r.status === 401 || r.status === 403) { const e = new Error('forbidden'); e.code = 'forbidden'; throw e; }
    if (!r.ok) throw new Error(`whatnot_${r.status}`);
    return r.json();
  };

  // upcoming public shows
  const shows = new Set();
  for (const st of ['live', 'scheduled']) {
    const p = await get(`/shows?status=${st}&limit=50&reverse=false`);
    for (const s of p.data || []) if (s.visibility !== 'private') shows.add(s.id);
  }

  // newest products
  const products = [];
  let cursor = null;
  for (let i = 0; i < PRODUCT_PAGES; i++) {
    const q = new URLSearchParams({ limit: '50', reverse: 'true' });
    if (cursor) q.set('cursor', cursor);
    const p = await get('/products?' + q);
    products.push(...(p.data || []).filter((x) => x.id));
    cursor = p.next_cursor;
    if (!cursor) break;
  }

  // which shows each product is in (saved, refreshed a few per request, oldest first)
  const known = new Map();
  const stale = [];
  for (const pr of products) {
    const v = await store.get(pr.id, { type: 'json' });
    if (v) known.set(pr.id, v);
    if (!v || now - v.checked > FRESH_MS) stale.push({ pr, age: v ? v.checked : 0 });
  }
  stale.sort((a, b) => a.age - b.age);
  const batch = stale.slice(0, PER_CALL);
  for (let i = 0; i < batch.length; i += PARALLEL) {
    await Promise.all(batch.slice(i, i + PARALLEL).map(async ({ pr }) => {
      try {
        const p = await get(`/merchandising/products/${encodeURIComponent(pr.id)}/shows?limit=50`);
        const img = (pr.media || []).find((m) => /^https:\/\//.test(m.url || ''));
        const v = { checked: now, shows: (p.data || []).map((s) => s.id), t: String(pr.title || '').slice(0, 80), img: img ? img.url : '' };
        await store.setJSON(pr.id, v);
        known.set(pr.id, v);
      } catch (e) { if (e.code === 'forbidden') throw e; }
    }));
  }

  const lineups = {};
  for (const v of known.values()) {
    for (const id of v.shows || []) {
      if (!shows.has(id)) continue;
      (lineups[id] ||= []);
      if (lineups[id].length < PER_SHOW && v.t) lineups[id].push({ t: v.t, img: v.img });
    }
  }
  return { updated: new Date(now).toISOString(), complete: stale.length <= PER_CALL, lineups };
}

export default async () => {
  const token = Netlify.env.get('WHATNOT_SHOP_TOKEN');
  if (!token) return json({ error: 'not_configured' }, 503, { 'Cache-Control': 'no-store' });
  try {
    const out = await compute({ token, store: getStore('product-shows') });
    const cdn = out.complete ? 'public, durable, s-maxage=300, stale-while-revalidate=600' : 'public, durable, s-maxage=20';
    return json(out, 200, { 'Netlify-CDN-Cache-Control': cdn });
  } catch (e) {
    if (e.code === 'forbidden') return json({ error: 'needs_permissions' }, 503, { 'Cache-Control': 'no-store' });
    return json({ error: 'upstream' }, 502, { 'Cache-Control': 'no-store' });
  }
};

export const config = { path: '/api/lineup' };

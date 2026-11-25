// "Department records": adds up Whatnot show analytics across every finished donutsforcops show.
// Needs WHATNOT_STATS_TOKEN: a Whatnot personal access token with "Read shows" + "Read reports".
// Finished shows never change, so each one's numbers are saved once (Netlify Blobs) and reused.
import { getStore } from '@netlify/blobs';

const API = 'https://api.whatnot.com/seller-api/rest/v2';
const PER_CALL = 24;      // new shows to look up per request (keeps each request quick)
const PARALLEL = 6;

const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=0, must-revalidate', ...extra },
  });

export async function compute({ token, store, fetchImpl = fetch }) {
  const get = async (path) => {
    const r = await fetchImpl(API + path, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
    if (r.status === 401 || r.status === 403) { const e = new Error('forbidden'); e.code = 'forbidden'; throw e; }
    if (!r.ok) throw new Error(`whatnot_${r.status}`);
    return r.json();
  };

  // every finished show
  const ended = [];
  let cursor = null;
  for (let i = 0; i < 40; i++) {
    const q = new URLSearchParams({ status: 'ended', limit: '50', reverse: 'true' });
    if (cursor) q.set('cursor', cursor);
    const p = await get('/shows?' + q);
    ended.push(...p.data.filter((s) => s.visibility !== 'private'));
    cursor = p.next_cursor;
    if (!cursor) break;
  }

  // saved numbers, plus a few new lookups per request
  const saved = new Map();
  const missing = [];
  for (const s of ended) {
    const v = await store.get(s.id, { type: 'json' });
    if (v) saved.set(s.id, v); else missing.push(s.id);
  }
  const batch = missing.slice(0, PER_CALL);
  for (let i = 0; i < batch.length; i += PARALLEL) {
    await Promise.all(batch.slice(i, i + PARALLEL).map(async (id) => {
      try {
        const a = await get(`/analytics/shows/${id}`);
        if (a.calculation_status === 'GENERATED' || a.calculation_status === 'WILL_NOT_BE_CALCULATED') {
          const keep = {
            status: a.calculation_status, minutes: a.stream_minutes || 0, orders: a.orders_count || 0,
            giveaways: a.giveaway_orders_count || 0, newBuyers: a.first_time_buyers_count || 0,
            peak: a.max_concurrent_viewers || 0, rating: a.average_rating ?? null, start: a.start_time || null,
          };
          await store.setJSON(id, keep);
          saved.set(id, keep);
        }
      } catch (e) { if (e.code === 'forbidden') throw e; }
    }));
  }

  const rows = [...saved.values()].filter((r) => r.status === 'GENERATED');
  const sum = (k) => rows.reduce((n, r) => n + (r[k] || 0), 0);
  const rated = rows.filter((r) => typeof r.rating === 'number' && r.rating > 0);
  const first = rows.map((r) => r.start).filter(Boolean).sort()[0] || null;
  return {
    updated: new Date().toISOString(),
    complete: missing.length <= batch.length,
    shows: ended.length,
    hours: Math.round(sum('minutes') / 60),
    items: sum('orders'),
    giveaways: sum('giveaways'),
    newBuyers: sum('newBuyers'),
    peakViewers: rows.reduce((m, r) => Math.max(m, r.peak || 0), 0),
    rating: rated.length ? Math.round((rated.reduce((n, r) => n + r.rating, 0) / rated.length) * 10) / 10 : null,
    since: first,
  };
}

export default async () => {
  const token = Netlify.env.get('WHATNOT_STATS_TOKEN');
  if (!token) return json({ error: 'not_configured' }, 503, { 'Cache-Control': 'no-store' });
  try {
    const out = await compute({ token, store: getStore('show-analytics') });
    return json(out, 200, {
      'Netlify-CDN-Cache-Control': out.complete
        ? 'public, durable, s-maxage=1800, stale-while-revalidate=86400'
        : 'public, durable, s-maxage=20',
    });
  } catch (e) {
    console.error('stats failed', e.message);
    return json({ error: e.code === 'forbidden' ? 'needs_read_reports' : 'upstream' }, 502, { 'Cache-Control': 'no-store' });
  }
};

export const config = { path: '/api/stats' };

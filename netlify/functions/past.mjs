// "The evidence room": the most recent finished donutsforcops shows, with their thumbnails.
// Uses the same WHATNOT_TOKEN (Read shows) as /api/shows. No buyer or sales data.
const API = 'https://api.whatnot.com/seller-api/rest/v2';
const MAX = 12;

const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=0, must-revalidate', ...extra },
  });

export async function compute({ token, fetchImpl = fetch }) {
  const out = [];
  let cursor = null;
  for (let i = 0; i < 4 && out.length < MAX; i++) {
    const q = new URLSearchParams({ status: 'ended', limit: '50', reverse: 'true' });
    if (cursor) q.set('cursor', cursor);
    const r = await fetchImpl(`${API}/shows?${q}`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
    if (!r.ok) throw new Error(`whatnot_${r.status}`);
    const p = await r.json();
    for (const s of p.data || []) {
      const thumb = s.thumbnail && /^https:\/\//.test(s.thumbnail.url || '') ? s.thumbnail.url : '';
      if (s.visibility === 'private' || !thumb) continue;
      out.push({ title: s.title, at: s.ended_at || s.scheduled_start_at || null, thumb });
      if (out.length >= MAX) break;
    }
    cursor = p.next_cursor;
    if (!cursor) break;
  }
  return { updated: new Date().toISOString(), shows: out };
}

export default async () => {
  const token = Netlify.env.get('WHATNOT_TOKEN');
  if (!token) return json({ error: 'not_configured' }, 503, { 'Cache-Control': 'no-store' });
  try {
    return json(await compute({ token }), 200, { 'Netlify-CDN-Cache-Control': 'public, durable, s-maxage=900, stale-while-revalidate=3600' });
  } catch (e) {
    return json({ error: 'upstream' }, 502, { 'Cache-Control': 'no-store' });
  }
};

export const config = { path: '/api/past' };

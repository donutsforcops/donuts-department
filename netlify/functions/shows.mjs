// Reads donutsforcops' upcoming and live shows from the Whatnot Seller API.
// The token lives only in Netlify's environment variable WHATNOT_TOKEN (Read shows permission).
const BASE = 'https://api.whatnot.com/seller-api/rest/v2/shows';
const HANDLE = 'donutsforcops';

const publicUrl = (id) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    ? `https://www.whatnot.com/live/${id}`
    : `https://www.whatnot.com/user/${HANDLE}`;

const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=0, must-revalidate', ...extra },
  });

export default async () => {
  const token = Netlify.env.get('WHATNOT_TOKEN');
  if (!token) return json({ error: 'not_configured' }, 503, { 'Cache-Control': 'no-store' });

  const page = async (status, cursor) => {
    const u = new URL(BASE);
    u.searchParams.set('status', status);
    u.searchParams.set('limit', '50');
    u.searchParams.set('reverse', 'false');
    if (cursor) u.searchParams.set('cursor', cursor);
    const r = await fetch(u, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
    if (!r.ok) throw new Error(`whatnot_${r.status}`);
    return r.json();
  };

  try {
    const all = [];
    all.push(...(await page('live')).data);
    let cursor = null;
    for (let i = 0; i < 3; i++) {
      const p = await page('scheduled', cursor);
      all.push(...p.data);
      cursor = p.next_cursor;
      if (!cursor) break;
    }
    const shows = all
      .filter((s) => s.visibility !== 'private')
      .map((s) => ({
        id: s.id,
        title: s.title,
        at: s.scheduled_start_at || new Date().toISOString(),
        live: s.status === 'live',
        u: publicUrl(s.id),
      }));
    return json({ updated: new Date().toISOString(), shows }, 200, {
      // One shared copy for every visitor, refreshed from Whatnot at most about once a minute.
      'Netlify-CDN-Cache-Control': 'public, durable, s-maxage=45, stale-while-revalidate=30',
    });
  } catch (e) {
    console.error('shows feed failed', e.message);
    return json({ error: 'upstream' }, 502, { 'Cache-Control': 'no-store' });
  }
};

export const config = { path: '/api/shows' };

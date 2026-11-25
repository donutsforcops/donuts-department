// "Just sold": the latest donutsforcops sales, item title and price only.
// Needs WHATNOT_SHOP_TOKEN with "Read orders". Give it NO "Read customers" permission:
// buyer details are never requested, stored or shown.
import { getStore } from '@netlify/blobs';

const API = 'https://api.whatnot.com/seller-api/rest/v2';
const SHOW = 10;
const OK = new Set(['completed', 'pending_fulfillment', 'pending']);

const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=0, must-revalidate', ...extra },
  });

// keep handles and anything that looks like contact info out of public titles
export const clean = (t) =>
  String(t || '')
    .replace(/\S+@\S+\.\S+/g, '')
    .replace(/@\S+/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 80);

export async function compute({ token, store, fetchImpl = fetch }) {
  const get = async (path) => {
    const r = await fetchImpl(API + path, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
    if (r.status === 401 || r.status === 403) { const e = new Error('forbidden'); e.code = 'forbidden'; throw e; }
    if (!r.ok) throw new Error(`whatnot_${r.status}`);
    return r.json();
  };
  const page = await get('/orders?limit=25&reverse=true');
  const orders = (page.data || []).filter((o) => OK.has(o.status)).slice(0, SHOW);
  const sold = [];
  for (const o of orders) {
    // order items never change, so each order is looked up once
    let items = store ? await store.get(o.id, { type: 'json' }) : null;
    if (!items) {
      const p = await get(`/orders/${encodeURIComponent(o.id)}/items?limit=5`);
      items = (p.data || []).map((it) => ({
        t: clean(it.purchased_item && it.purchased_item.title),
        p: it.unit_price ? Number(it.unit_price.amount) : null,
        c: it.unit_price ? it.unit_price.currency : 'USD',
      })).filter((x) => x.t);
      if (store) await store.setJSON(o.id, items);
    }
    for (const it of items) {
      const give = o.transaction_type === 'giveaway';
      sold.push({ t: it.t, p: give ? null : it.p, c: it.c, give, at: o.created_at });
    }
  }
  return { updated: new Date().toISOString(), sold: sold.slice(0, SHOW) };
}

export default async () => {
  const token = Netlify.env.get('WHATNOT_SHOP_TOKEN');
  if (!token) return json({ error: 'not_configured' }, 503, { 'Cache-Control': 'no-store' });
  try {
    const store = getStore('order-items');
    return json(await compute({ token, store }), 200, { 'Netlify-CDN-Cache-Control': 'public, durable, s-maxage=60, stale-while-revalidate=120' });
  } catch (e) {
    if (e.code === 'forbidden') return json({ error: 'needs_read_orders' }, 503, { 'Cache-Control': 'no-store' });
    return json({ error: 'upstream' }, 502, { 'Cache-Control': 'no-store' });
  }
};

export const config = { path: '/api/sold' };

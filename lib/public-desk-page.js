// Public Desk page — webdesks.app/u/<username> (Cloudflare Pages Function,
// functions/u/[username].js).
//
// Rendered on the server so link previews (iMessage, Slack, X, WhatsApp)
// show the member's town and streak. Data comes from the Supabase RPC
// get_public_desk(), which only answers for Desks whose owner switched
// sharing on, and only returns the published summary — never Desk data.
//
// If the server can't reach the database, the page still works: it ships a
// tiny loader and the visitor's browser calls the same public RPC.
import renderLib from '../public-desk-render.js';

const { STYLES, render, notFound, esc } = renderLib;
const SITE = 'https://webdesks.app';
const USERNAME = /^[a-z0-9_]{3,24}$/;
let cfgCache = null;

// Public Supabase URL + anon key: Pages environment variables if set,
// otherwise this deployment's own supabase-config.js (read through the
// ASSETS binding — no extra network hop).
async function config(request, env = {}) {
    if (cfgCache) return cfgCache;
    const key = env.SUPABASE_ANON_KEY || env.SUPABASE_PUBLISHABLE_KEY;
    if (env.SUPABASE_URL && /^https:/.test(env.SUPABASE_URL) && key) return (cfgCache = { url: env.SUPABASE_URL, key });
    const configUrl = new URL('/supabase-config.js', request.url);
    const res = env.ASSETS ? await env.ASSETS.fetch(configUrl) : await fetch(configUrl);
    const js = await res.text();
    const url = (js.match(/url:\s*['"]([^'"]+)['"]/) || [])[1];
    const anon = (js.match(/anonKey:\s*['"]([^'"]+)['"]/) || [])[1];
    if (!url || !anon) throw new Error('no supabase config');
    return (cfgCache = { url, key: anon });
}

// → desk object, null (no such public Desk), or throws (couldn't ask).
async function fetchDesk(username, request, env) {
    const { url, key } = await config(request, env);
    const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/get_public_desk`, {
        method: 'POST',
        // apikey alone selects the anon role (legacy anon JWTs and publishable keys).
        headers: { 'Content-Type': 'application/json', apikey: key },
        body: JSON.stringify({ p_username: username }),
        signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) throw new Error(`rpc ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    return data && typeof data === 'object' && data.username ? data : null;
}

function page({ title, desc, url, body, status = 200, noindex = false, cache = true }) {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${esc(url)}">`}
<meta property="og:type" content="profile">
<meta property="og:site_name" content="WebDesks">
<meta property="og:url" content="${esc(url)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${SITE}/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${SITE}/og-image.png">
<link rel="icon" href="/favicon-32.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<style>${STYLES}</style>
</head>
<body>
<main>
  <div class="top"><a href="/">🗂️ WebDesks</a><a href="/login?mode=signup&amp;ref=public-desk">Get yours free</a></div>
  ${body}
</main>
</body>
</html>`;
    return new Response(html, {
        status,
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': cache && status === 200 ? 'public, max-age=60, s-maxage=120, stale-while-revalidate=300' : 'no-store',
            'X-Content-Type-Options': 'nosniff',
            'Referrer-Policy': 'strict-origin-when-cross-origin'
        }
    });
}

export function cleanUsername(raw) {
    let v = '';
    try { v = decodeURIComponent(String(raw || '')).trim().toLowerCase().replace(/^@/, '').replace(/\/+$/, ''); } catch (e) { return ''; }
    return USERNAME.test(v) ? v : '';
}

export async function publicDeskResponse({ request, env, username: raw }) {
    const username = cleanUsername(raw);
    const url = `${SITE}/u/${username}`;
    if (!username) return page({ ...notFound(), url, status: 404, noindex: true });

    let desk;
    try {
        desk = await fetchDesk(username, request, env);
    } catch (e) {
        console.error('[u] server fetch failed, falling back to the browser:', e && e.message);
        return page({
            title: `${username}'s WebDesk`, desc: 'A Public Desk on WebDesks: Focus Town, streaks and favourite focus sounds.', url, cache: false,
            body: `<div id="pd-root" class="loading">Loading ${esc(username)}'s Desk…</div>
  <script src="/supabase-config.js"></script>
  <script src="/desk-badges.js"></script>
  <script src="/public-desk-render.js"></script>
  <script>WD_PUBLIC_DESK.loadInBrowser(${JSON.stringify(username)}, document.getElementById('pd-root'));</script>`
        });
    }
    if (!desk) return page({ ...notFound(), url, status: 404, noindex: true });
    return page({ ...render(desk), url });
}

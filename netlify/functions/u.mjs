// Public Desk page: webdesks.app/u/<username> (rewritten here by netlify.toml).
//
// Rendered on the server so link previews (Slack, X, iMessage, WhatsApp)
// show the member's town and streak. Data comes from the Supabase RPC
// get_public_desk(), which only answers for Desks whose owner switched
// sharing on, and only returns the published summary — never Desk data.
//
// If the server can't reach the database (config or network trouble), the
// page still works: it ships a tiny loader and the browser fetches the same
// public RPC itself.
import renderLib from '../../public-desk-render.js';

const { STYLES, render, notFound, esc } = renderLib;
const SITE = 'https://webdesks.app';
const USERNAME = /^[a-z0-9_]{3,24}$/;
let cfgCache = null;

// Public Supabase URL + anon key: env vars if set (the same ones the build
// uses), otherwise read from the site's own supabase-config.js.
async function config(host) {
    if (cfgCache) return cfgCache;
    if (process.env.SUPABASE_URL && /^https:/.test(process.env.SUPABASE_URL) && (process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY)) {
        return (cfgCache = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY });
    }
    const origins = [...new Set([host ? `https://${host}` : null, process.env.URL, process.env.DEPLOY_PRIME_URL, SITE].filter(Boolean))];
    for (const origin of origins) {
        try {
            const js = await (await fetch(`${origin}/supabase-config.js`, { signal: AbortSignal.timeout(4000) })).text();
            const url = (js.match(/url:\s*['"]([^'"]+)['"]/) || [])[1];
            const key = (js.match(/anonKey:\s*['"]([^'"]+)['"]/) || [])[1];
            if (url && key) return (cfgCache = { url, key });
        } catch (e) { /* try the next origin */ }
    }
    throw new Error('no supabase config');
}

// → desk object, null (no such public Desk), or throws (couldn't ask).
async function fetchDesk(username, host) {
    const { url, key } = await config(host);
    const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/get_public_desk`, {
        method: 'POST',
        // apikey alone selects the anon role; works with legacy anon JWTs and new publishable keys.
        headers: { 'Content-Type': 'application/json', apikey: key },
        body: JSON.stringify({ p_username: username }),
        signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) throw new Error(`rpc ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    return data && typeof data === 'object' && data.username ? data : null;
}

function page({ title, desc, url, body, status = 200, noindex = false, cache = true }) {
    return {
        statusCode: status,
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': cache && status === 200 ? 'public, max-age=60, s-maxage=120, stale-while-revalidate=300' : 'no-store',
            'X-Content-Type-Options': 'nosniff',
            'Referrer-Policy': 'strict-origin-when-cross-origin'
        },
        body: `<!DOCTYPE html>
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
</html>`
    };
}

// The member's username: from the path (/u/alex), else the rewrite's query.
function usernameFrom(event) {
    const fromPath = ((event.rawUrl ? new URL(event.rawUrl).pathname : event.path) || '').match(/\/u\/([^/?#]+)/);
    const candidates = [fromPath && fromPath[1], event.queryStringParameters && event.queryStringParameters.username];
    for (const c of candidates) {
        let v = '';
        try { v = decodeURIComponent(String(c || '')).trim().toLowerCase().replace(/^@/, ''); } catch (e) { continue; }
        if (USERNAME.test(v)) return v;
    }
    return '';
}

export const handler = async (event) => {
    const username = usernameFrom(event);
    const url = `${SITE}/u/${username}`;
    if (!username) { const nf = notFound(); return page({ ...nf, url, status: 404, noindex: true }); }

    let desk;
    try {
        desk = await fetchDesk(username, event.headers && (event.headers['x-forwarded-host'] || event.headers.host));
    } catch (e) {
        console.error('[u] server fetch failed, falling back to the browser:', e && e.message);
        // Let the visitor's browser load it instead (same public RPC).
        return page({
            title: `${username}'s WebDesk`, desc: 'A Public Desk on WebDesks: Focus Town, streaks and favourite focus sounds.', url, cache: false,
            body: `<div id="pd-root" class="loading">Loading ${esc(username)}'s Desk…</div>
  <script src="/supabase-config.js"></script>
  <script src="/desk-badges.js"></script>
  <script src="/public-desk-render.js"></script>
  <script>WD_PUBLIC_DESK.loadInBrowser(${JSON.stringify(username)}, document.getElementById('pd-root'));</script>`
        });
    }
    if (!desk) { const nf = notFound(); return page({ ...nf, url, status: 404, noindex: true }); }
    return page({ ...render(desk), url });
};

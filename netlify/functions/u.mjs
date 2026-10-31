// Public Desk page: webdesks.app/u/<username> (rewritten here by netlify.toml).
//
// Rendered on the server so link previews (Slack, X, iMessage, WhatsApp)
// show the member's town and streak. Data comes from the Supabase RPC
// get_public_desk(), which only answers for Desks whose owner switched
// sharing on, and only returns the published summary — never Desk data.
import badgesLib from '../../desk-badges.js';

const { badges, skyline } = badgesLib;
const SITE = 'https://webdesks.app';
let cfgCache = null;

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Public Supabase URL + anon key: env vars if set (same ones the build uses),
// otherwise read them from the site's own supabase-config.js.
async function config(host) {
    if (cfgCache) return cfgCache;
    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
        return (cfgCache = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_ANON_KEY });
    }
    const origin = process.env.URL || (host ? `https://${host}` : SITE);
    const js = await (await fetch(`${origin}/supabase-config.js`)).text();
    const url = (js.match(/url:\s*'([^']+)'/) || [])[1];
    const key = (js.match(/anonKey:\s*'([^']+)'/) || [])[1];
    if (!url || !key) throw new Error('no supabase config');
    return (cfgCache = { url, key });
}

async function fetchDesk(username, host) {
    const { url, key } = await config(host);
    const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/get_public_desk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
        body: JSON.stringify({ p_username: username })
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data && typeof data === 'object' && data.username ? data : null;
}

const DESK_NAMES = { dev: '💻 Developer Desk', student: '🎓 Student Desk', remote: '🏠 Remote Work Desk' };

function page({ title, desc, url, body, status = 200, noindex = false }) {
    return {
        statusCode: status,
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': status === 200 ? 'public, max-age=60, s-maxage=300, stale-while-revalidate=600' : 'public, max-age=60',
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
<style>
  :root { --accent: #4f46e5; --text: #0f172a; --muted: #64748b; --border: #e5e7eb; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Inter, system-ui, -apple-system, Segoe UI, sans-serif; color: var(--text); background: #f7f7f5; }
  a { color: var(--accent); }
  main { max-width: 40rem; margin: 0 auto; padding: 1.5rem 1.1rem 3rem; }
  .top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; font-weight: 800; }
  .top a { text-decoration: none; }
  .hero { color: #fff; border-radius: 1.75rem; padding: 2rem 1.5rem; text-align: center;
    background: radial-gradient(600px 300px at 100% 0%, rgba(244,114,182,.5), transparent 60%), linear-gradient(135deg, #4338ca, #6d28d9 55%, #9333ea); }
  .avatar { width: 4.5rem; height: 4.5rem; border-radius: 1.4rem; margin: 0 auto .75rem; display: grid; place-items: center; font-size: 2.2rem; background: rgba(255,255,255,.18); font-weight: 900; }
  h1 { margin: 0; font-size: 1.8rem; letter-spacing: -.02em; }
  .sub { opacity: .85; margin-top: .3rem; font-size: .95rem; }
  .card { background: #fff; border: 1px solid var(--border); border-radius: 1.4rem; padding: 1.25rem 1.3rem; margin-top: 1rem; }
  .k { font-size: .7rem; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); margin-bottom: .5rem; }
  .sky { font-size: 2.6rem; letter-spacing: .15em; text-align: center; margin: .25rem 0 .5rem; }
  .town { text-align: center; font-weight: 800; font-size: 1.15rem; }
  .meter { height: .55rem; border-radius: 999px; background: #eef2ff; overflow: hidden; margin: .75rem 0 .3rem; }
  .meter > span { display: block; height: 100%; background: linear-gradient(90deg, #6366f1, #a855f7); }
  .row { display: grid; grid-template-columns: repeat(3, 1fr); gap: .5rem; text-align: center; }
  .row b { display: block; font-size: 1.35rem; font-weight: 900; } .row span { font-size: .72rem; color: var(--muted); font-weight: 700; }
  .badges { display: flex; flex-wrap: wrap; gap: .45rem; }
  .badge { padding: .45rem .75rem; border-radius: 999px; background: #f8fafc; border: 1px solid var(--border); font-weight: 700; font-size: .85rem; }
  .badge.next { opacity: .55; border-style: dashed; }
  .mix { display: flex; align-items: center; gap: .8rem; font-weight: 800; }
  .mix .e { font-size: 2rem; }
  .cta { display: block; text-align: center; margin-top: 1.25rem; padding: 1rem; border-radius: 1.1rem; background: var(--accent); color: #fff; font-weight: 800; text-decoration: none; font-size: 1.05rem; }
  .fine { text-align: center; font-size: .78rem; color: var(--muted); margin-top: .75rem; }
  @media (prefers-color-scheme: dark) {
    body { background: #0b1020; color: #e2e8f0; } .card { background: #111827; border-color: #1f2937; }
    .badge { background: #0b1020; border-color: #1f2937; } .meter { background: #1e1b4b; }
  }
</style>
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

function notFound(username) {
    return page({
        status: 404, noindex: true,
        title: 'This Desk is private | WebDesks',
        desc: 'This WebDesk isn\'t public. Build your own free Desk with a Focus Town, Pomodoro timer and ambient sounds.',
        url: `${SITE}/u/${username || ''}`,
        body: `<div class="hero"><div class="avatar">🔒</div><h1>This Desk is private</h1><div class="sub">or the link is mistyped.</div></div>
  <a class="cta" href="/login?mode=signup&amp;ref=public-desk">Build your own WebDesk — free</a>
  <p class="fine">A free planner, Pomodoro timer, Focus Town and ambient sound mixer in one tab.</p>`
    });
}

export const handler = async (event) => {
    const raw = (event.queryStringParameters && event.queryStringParameters.username) || (event.path || '').split('/').filter(Boolean).pop() || '';
    const username = raw.toLowerCase();
    if (!/^[a-z0-9_]{3,24}$/.test(username)) return notFound('');

    let desk = null;
    try { desk = await fetchDesk(username, event.headers && event.headers.host); } catch (e) { desk = null; }
    if (!desk) return notFound(username);

    const s = desk.stats || {};
    const town = s.town || null;
    const name = desk.display_name || desk.username;
    const first = String(name).split(/\s+/)[0];
    const b = badges(s);
    const hours = Math.floor((s.focusMin || 0) / 60);
    const url = `${SITE}/u/${desk.username}`;
    const headline = [town ? `${town.levelName} (level ${town.level})` : null, s.focusStreak ? `${s.focusStreak}-day streak` : null, hours ? `${hours}h focused` : null].filter(Boolean).join(' · ');
    const avatar = desk.avatar_emoji ? esc(desk.avatar_emoji) : esc(String(name)[0] || '?').toUpperCase();
    const since = desk.member_since ? new Date(desk.member_since).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '';

    const body = `
  <div class="hero">
    <div class="avatar">${avatar}</div>
    <h1>${esc(first)}'s WebDesk</h1>
    <div class="sub">${esc(headline || 'Just getting started')}${s.desk && DESK_NAMES[s.desk] ? ` · ${DESK_NAMES[s.desk]}` : ''}</div>
  </div>

  <section class="card">
    <div class="k">Focus Town</div>
    ${town ? `
    <div class="sky" aria-hidden="true">${skyline(town.level)}</div>
    <div class="town">${esc(town.name)} — ${esc(town.levelName)}</div>
    <div class="meter" role="img" aria-label="Level ${town.level} of ${town.maxLevel}"><span style="width:${Math.round(100 * town.level / (town.maxLevel || 6))}%"></span></div>
    <div class="fine" style="margin-top:0">Level ${town.level} of ${town.maxLevel || 6} · ${town.pop} villagers · ${town.buildings} buildings</div>` : '<p class="fine">No town yet — it grows with every focused minute.</p>'}
  </section>

  <section class="card">
    <div class="row">
      <div><b>${s.focusStreak || 0}🔥</b><span>day streak</span></div>
      <div><b>${s.pomodoros || 0}</b><span>Pomodoros</span></div>
      <div><b>${hours}h</b><span>focused</span></div>
    </div>
  </section>

  <section class="card">
    <div class="k">Badges</div>
    <div class="badges">
      ${b.earned.map(x => `<span class="badge">${x.icon} ${esc(x.label)}</span>`).join('') || '<span class="fine">First badge coming soon.</span>'}
      ${b.next.slice(0, 3).map(x => `<span class="badge next" title="Next up">${x.icon} ${esc(x.label)}</span>`).join('')}
    </div>
  </section>

  ${s.favoriteMix ? `<section class="card">
    <div class="k">Favourite focus sounds</div>
    <div class="mix"><span class="e" aria-hidden="true">${esc(s.favoriteMix.emoji || '🎧')}</span><span>${esc(s.favoriteMix.name)}<br><a href="/tools/ambient-sounds" style="font-size:.85rem">Play it on WebDesks →</a></span></div>
  </section>` : ''}

  <a class="cta" href="/login?mode=signup&amp;ref=u-${esc(desk.username)}">Build your own WebDesk — free</a>
  <p class="fine">${since ? `Member since ${esc(since)} · ` : ''}Planner, Pomodoro timer, Focus Town and ambient sounds in one free tab.</p>`;

    return page({
        title: `${first}'s WebDesk${town ? ` — ${town.levelName}` : ''}${s.focusStreak ? `, ${s.focusStreak}-day streak` : ''}`,
        desc: `${first} has focused ${hours} hours${s.pomodoros ? ` across ${s.pomodoros} Pomodoros` : ''}${town ? ` and grown ${town.name} into a ${town.levelName}` : ''} on WebDesks. Build your own free Desk.`,
        url, body
    });
};

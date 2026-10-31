// Renders a Public Desk page (webdesks.app/u/<username>).
//
// Shared by the server (lib/public-desk-page.js renders it for link
// previews) and the browser (the same page loads the Desk itself if the
// server couldn't reach the database). Needs desk-badges.js.
(function (root) {
    const B = typeof module !== 'undefined' && module.exports ? require('./desk-badges.js') : root.WD_BADGES;
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const DESK_NAMES = { dev: '💻 Developer Desk', student: '🎓 Student Desk', remote: '🏠 Remote Work Desk' };

    const STYLES = `
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
  .loading { text-align: center; padding: 3rem 1rem; color: var(--muted); }
  @media (prefers-color-scheme: dark) {
    body { background: #0b1020; color: #e2e8f0; } .card { background: #111827; border-color: #1f2937; }
    .badge { background: #0b1020; border-color: #1f2937; } .meter { background: #1e1b4b; }
  }`;

    function notFound() {
        return {
            title: 'This Desk is private | WebDesks',
            desc: 'This WebDesk isn\'t public. Build your own free Desk with a Focus Town, Pomodoro timer and ambient sounds.',
            body: `<div class="hero"><div class="avatar">🔒</div><h1>This Desk is private</h1><div class="sub">or the link is mistyped.</div></div>
  <a class="cta" href="/login?mode=signup&amp;ref=public-desk">Build your own WebDesk — free</a>
  <p class="fine">A free planner, Pomodoro timer, Focus Town and ambient sound mixer in one tab.</p>`
        };
    }

    function render(desk) {
        const s = desk.stats || {};
        const town = s.town || null;
        const name = desk.display_name || desk.username;
        const first = String(name).split(/\s+/)[0];
        const b = B.badges(s);
        const hours = Math.floor((s.focusMin || 0) / 60);
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
    <div class="sky" aria-hidden="true">${B.skyline(town.level)}</div>
    <div class="town">${esc(town.name)} — ${esc(town.levelName)}</div>
    <div class="meter" role="img" aria-label="Level ${+town.level || 1} of ${+town.maxLevel || 6}"><span style="width:${Math.round(100 * (+town.level || 1) / (+town.maxLevel || 6))}%"></span></div>
    <div class="fine" style="margin-top:0">Level ${+town.level || 1} of ${+town.maxLevel || 6} · ${+town.pop || 0} villagers · ${+town.buildings || 0} buildings</div>` : '<p class="fine">No town yet — it grows with every focused minute.</p>'}
  </section>

  <section class="card">
    <div class="row">
      <div><b>${+s.focusStreak || 0}🔥</b><span>day streak</span></div>
      <div><b>${+s.pomodoros || 0}</b><span>Pomodoros</span></div>
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
        return {
            title: `${first}'s WebDesk${town ? ` — ${town.levelName}` : ''}${s.focusStreak ? `, ${s.focusStreak}-day streak` : ''}`,
            desc: `${first} has focused ${hours} hours${s.pomodoros ? ` across ${s.pomodoros} Pomodoros` : ''}${town ? ` and grown ${town.name} into a ${town.levelName}` : ''} on WebDesks. Build your own free Desk.`,
            body
        };
    }

    // Browser: fetch the Desk straight from Supabase (anon key, public RPC).
    async function loadInBrowser(username, mount) {
        const cfg = root.WEBDESKS_SUPABASE || {};
        let desk = null;
        try {
            const res = await fetch(cfg.url.replace(/\/$/, '') + '/rest/v1/rpc/get_public_desk', {
                method: 'POST', headers: { 'Content-Type': 'application/json', apikey: cfg.anonKey }, body: JSON.stringify({ p_username: username })
            });
            const data = res.ok ? await res.json() : null;
            if (data && data.username) desk = data;
        } catch (e) { /* show the private page */ }
        const out = desk ? render(desk) : notFound();
        document.title = out.title;
        mount.className = '';
        mount.innerHTML = out.body;
    }

    const api = { STYLES, render, notFound, esc, loadInBrowser };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.WD_PUBLIC_DESK = api;
})(typeof window !== 'undefined' ? window : this);

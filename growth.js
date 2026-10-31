// ═══════════════════════════════════════════════════════════════
// GROWTH — sharing and sponsorship, layered on top of `app`.
//
//  1. Desk Sponsor — one curated sponsor / affiliate card on the dashboard
//                    (sponsors.json), in place of programmatic banners.
//                    Hidden for signed-in members, like all ads.
//  2. Public Desk  — members pick a username and share a read-only page,
//                    webdesks.app/u/<username>: Focus Town level, streak
//                    badges and favourite Sounds preset
//                    (functions/u/[username].js renders it).
//  3. Blog handoff — "Save to My WebDesk" on the blog's mini tools lands
//                    here with ?saved=<tool>; we say thanks and open it.
// ═══════════════════════════════════════════════════════════════
(() => {
    const $ = id => document.getElementById(id);
    const esc = s => app.escapeHtml(String(s ?? ''));
    const readLocal = (k, fb) => { try { return JSON.parse(localStorage.getItem(k)) ?? fb; } catch (e) { return fb; } };
    const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    const PUBLISH_EVERY = 3 * 60 * 60 * 1000;
    const USERNAME = /^[a-z0-9_]{3,24}$/;
    const RESERVED = new Set(['admin', 'administrator', 'root', 'support', 'help', 'api', 'app', 'www', 'mail', 'webdesks', 'login', 'signup', 'settings', 'account', 'tools', 'blog', 'games', 'about', 'privacy', 'terms', 'contact', 'u', 'me', 'null', 'undefined', 'anonymous', 'official', 'staff', 'moderator', 'ads']);

    const orig = { init: app.init, renderAccountButton: app.renderAccountButton, paletteItems: app._paletteItems, applyDeskPreset: app.applyDeskPreset };

    Object.assign(app, {
        // ─────────────────────────────────────────────────────────
        // 1. DESK SPONSOR
        // ─────────────────────────────────────────────────────────
        _sponsorCfg: null,
        async loadSponsors() {
            try {
                const r = await fetch('/sponsors.json', { cache: 'no-cache' });
                this._sponsorCfg = r.ok ? await r.json() : { sponsors: [] };
            } catch (e) { this._sponsorCfg = { sponsors: [] }; }
            this.renderSponsor();
        },
        // Live sponsors for the active Desk preset, picked by weight, stable for the day.
        _pickSponsor() {
            const cfg = this._sponsorCfg || {};
            const t = today();
            const desk = this.deskPreset || 'all';
            const live = (Array.isArray(cfg.sponsors) ? cfg.sponsors : []).filter(s =>
                s && /^[a-z0-9-]{2,40}$/.test(s.id || '') && /^https:\/\//.test(s.url || '') && s.name &&
                (!s.start || s.start <= t) && (!s.end || s.end >= t) &&
                (!Array.isArray(s.desks) || !s.desks.length || s.desks.includes('all') || s.desks.includes(desk)));
            if (!live.length) return null;
            const total = live.reduce((a, s) => a + Math.max(0, +s.weight || 1), 0);
            // Same pick all day for this browser (no flicker between tabs).
            let seed = parseInt(localStorage.getItem('wdl_sponsor_seed') || '0', 10);
            if (!seed) { seed = 1 + Math.floor(Math.random() * 1e6); try { localStorage.setItem('wdl_sponsor_seed', String(seed)); } catch (e) {} }
            let roll = ((seed + parseInt(t.replace(/-/g, ''), 10)) % 1000) / 1000 * total;
            for (const s of live) { roll -= Math.max(0, +s.weight || 1); if (roll < 0) return s; }
            return live[0];
        },
        renderSponsor() {
            const el = $('desk-sponsor');
            if (!el || !this._sponsorCfg) return;
            if (window.WD_ADFREE) { el.innerHTML = ''; return; }
            const s = this._pickSponsor();
            const contact = (this._sponsorCfg && this._sponsorCfg.contact) || '/contact?topic=advertising#sponsor';
            if (!s) {
                el.innerHTML = `
                    <div class="sponsor-card sponsor-house">
                        <span class="sponsor-logo" aria-hidden="true">📣</span>
                        <span class="min-w-0 flex-1">
                            <span class="sponsor-label">Desk Sponsor · open</span>
                            <span class="sponsor-name">Put your product on every WebDesk</span>
                            <span class="sponsor-tag">One curated sponsor at a time, seen by people planning their workday. Developer tools, desk gear and productivity apps welcome.</span>
                        </span>
                        <a class="sponsor-cta" href="${esc(contact)}">Become the sponsor</a>
                    </div>
                    <p class="sponsor-foot">Signed-in members never see sponsors. <a href="/login?mode=signup">Create a free profile</a></p>`;
                return;
            }
            const logo = /^\/[\w\-./]+\.(png|jpe?g|svg|webp)$/i.test(s.logo || '')
                ? `<img src="${esc(s.logo)}" alt="" class="sponsor-img" width="48" height="48" loading="lazy">`
                : `<span class="sponsor-logo" aria-hidden="true">${esc(s.logo || '⭐')}</span>`;
            const href = s.url + (s.url.includes('utm_') ? '' : (s.url.includes('?') ? '&' : '?') + 'utm_source=webdesks&utm_medium=desk_sponsor&utm_campaign=' + encodeURIComponent(s.id));
            el.innerHTML = `
                <a class="sponsor-card" href="${esc(href)}" target="_blank" rel="sponsored noopener" data-sponsor="${esc(s.id)}">
                    ${logo}
                    <span class="min-w-0 flex-1">
                        <span class="sponsor-label">${esc(s.label === 'Affiliate' ? 'Affiliate' : 'Sponsor')}${s.category ? ' · ' + esc(s.category) : ''}</span>
                        <span class="sponsor-name">${esc(s.name)}</span>
                        <span class="sponsor-tag">${esc(s.tagline || '')}</span>
                    </span>
                    <span class="sponsor-cta">${esc(s.cta || 'Learn more')}</span>
                </a>
                <p class="sponsor-foot">${s.label === 'Affiliate' ? 'We may earn a commission at no cost to you. ' : ''}Curated by WebDesks · <a href="${esc(contact)}">Sponsor the Desk</a> · <a href="/login?mode=signup">Go ad-free</a></p>`;
            el.querySelector('[data-sponsor]').addEventListener('click', () => this._sponsorEvent(s.id, 'click'));
            // One view per sponsor per browser session.
            const seenKey = 'wd_sponsor_seen_' + s.id;
            if (!sessionStorage.getItem(seenKey)) { sessionStorage.setItem(seenKey, '1'); this._sponsorEvent(s.id, 'view'); }
        },
        _sponsorEvent(id, kind) {
            const cfg = window.WEBDESKS_SUPABASE || {};
            if (!cfg.url || !cfg.anonKey) return;
            try {
                fetch(cfg.url.replace(/\/$/, '') + '/rest/v1/rpc/log_sponsor_event', {
                    method: 'POST', keepalive: true,
                    headers: { 'Content-Type': 'application/json', apikey: cfg.anonKey },
                    body: JSON.stringify({ p_sponsor: id, p_kind: kind })
                }).catch(() => {});
            } catch (e) {}
        },
        applyDeskPreset() {
            orig.applyDeskPreset.call(this);
            if (this._sponsorCfg) this.renderSponsor();
        },

        // ─────────────────────────────────────────────────────────
        // 2. PUBLIC DESK
        // ─────────────────────────────────────────────────────────
        _public: null, // { username, is_public, public_updated_at } once loaded

        // The only Desk data a public page ever shows.
        publicStats() {
            const town = this._townSummary ? this._townSummary() : null;
            const usage = readLocal('wd_mix_usage', {});
            const fav = Object.entries(usage).sort((a, b) => b[1] - a[1])[0];
            let favorite = null;
            if (fav && this.mixerList) {
                const m = this.mixerList().find(x => x.id === fav[0]);
                if (m) favorite = { id: m.id, name: m.name.replace(/^\S+\s/, ''), emoji: (m.name.match(/^\S+/) || ['🎧'])[0], plays: fav[1] };
            }
            const focusMin = Math.max(this.timerTotalMinutes || 0, town ? town.focusMin : 0);
            return {
                v: 1,
                town: town ? { name: String(town.name || 'My Town').slice(0, 40), level: town.level, levelName: town.levelName, maxLevel: town.maxLevel, pop: town.pop, buildings: town.buildings, giftStreak: town.giftStreak } : null,
                focusMin,
                pomodoros: this.timerSessions || 0,
                focusStreak: parseInt(localStorage.getItem('wd_ft_streak') || '0', 10) || 0,
                favoriteMix: favorite,
                desk: this.deskPreset && this.deskPreset !== 'all' ? this.deskPreset : null
            };
        },

        async _loadPublic() {
            if (!this.account || this._public) return this._public;
            try {
                const sb = await this._supabase();
                const { data, error } = await sb.from('profiles').select('username, is_public, public_updated_at').eq('id', this.account.id).maybeSingle();
                if (error) throw error;
                this._public = data || { username: null, is_public: false };
            } catch (e) {
                this._public = { username: null, is_public: false, unavailable: true };
            }
            return this._public;
        },

        // Upsert, not update: accounts created before the profiles trigger have
        // no row, and an update would "succeed" while saving nothing.
        async publishPublicDesk(fields = {}) {
            const sb = await this._supabase();
            const row = { id: this.account.id, ...fields, public_stats: this.publicStats(), public_updated_at: new Date().toISOString() };
            const { data, error } = await sb.from('profiles').upsert(row, { onConflict: 'id' }).select('username, is_public').maybeSingle();
            if (error) throw error;
            if (!data) throw Object.assign(new Error('Profile not saved'), { code: 'NOROW' });
            this._public = { ...(this._public || {}), ...fields, username: data.username, is_public: data.is_public, public_updated_at: row.public_updated_at };
        },

        // Ask the public endpoint exactly what a visitor would get.
        async _checkPublicLink(username) {
            try {
                const sb = await this._supabase();
                const { data, error } = await sb.rpc('get_public_desk', { p_username: username });
                if (error) return { ok: false, reason: error.message || 'rpc' };
                return { ok: !!(data && data.username) };
            } catch (e) { return { ok: false, reason: 'offline' }; }
        },

        // Keep a shared page fresh without the member thinking about it.
        async _maybeRepublish() {
            const p = await this._loadPublic();
            if (!p || !p.is_public || !p.username) return;
            if (p.public_updated_at && Date.now() - new Date(p.public_updated_at).getTime() < PUBLISH_EVERY) return;
            try { await this.publishPublicDesk(); } catch (e) { /* try again next time */ }
        },

        _suggestUsername() {
            const base = ((this.profile && this.profile.display_name) || (this.account && this.account.email.split('@')[0]) || 'desk')
                .toLowerCase().normalize('NFKD').replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 20);
            return (base.length >= 3 ? base : base + '_desk').slice(0, 24);
        },

        async openPublicDesk() {
            if (!this.account) {
                this.lifeModal('🌐 Share your Desk', `
                    <p class="text-sm mb-4">Create a free profile to get your own page at <b>webdesks.app/u/you</b> — show off your Focus Town, streak badges and favourite focus sounds.</p>
                    <a href="/login?mode=signup&next=${encodeURIComponent(location.pathname)}" class="${this._btnCls} block text-center">Create free profile</a>`);
                return;
            }
            this.lifeModal('🌐 Public Desk', '<p class="text-sm text-slate-400">Loading…</p>');
            const p = await this._loadPublic();
            if (p.unavailable) {
                this.lifeModal('🌐 Public Desk', '<p class="text-sm">Public Desks are being switched on — please try again in a little while.</p>');
                return;
            }
            const stats = this.publicStats();
            const B = window.WD_BADGES;
            const b = B ? B.badges(stats) : { earned: [], next: [] };
            const username = p.username || this._suggestUsername();
            const link = u => `${location.origin}/u/${u}`;
            this.lifeModal('🌐 Public Desk', `
                <p class="text-sm text-slate-500 mb-4">A read-only page anyone can open. It shows only what's below — never your tasks, notes or calendar.</p>
                <div class="pd-preview">
                    <div class="pd-sky">${B ? B.skyline(stats.town && stats.town.level) : '🏡'}</div>
                    <div class="font-black">${esc(stats.town ? `${stats.town.name} · ${stats.town.levelName}` : 'Focus Town not started yet')}</div>
                    <div class="text-xs text-slate-500">${stats.town ? `Level ${stats.town.level} of ${stats.town.maxLevel} · ${stats.town.pop} villagers · ` : ''}${Math.floor(stats.focusMin / 60)}h focused · ${stats.pomodoros} Pomodoros</div>
                    <div class="pd-badges">${b.earned.length ? b.earned.map(x => `<span class="pd-badge">${x.icon} ${esc(x.label)}</span>`).join('') : '<span class="text-xs text-slate-400">Finish a Pomodoro to earn your first badge.</span>'}</div>
                    ${stats.favoriteMix ? `<div class="text-xs mt-2">Favourite sounds: <b>${esc(stats.favoriteMix.emoji)} ${esc(stats.favoriteMix.name)}</b></div>` : ''}
                </div>
                ${this._field('Your link', `<div class="flex items-center gap-1 text-sm"><span class="text-slate-400 shrink-0">webdesks.app/u/</span><input id="pd-user" maxlength="24" value="${esc(username)}" class="${this._inputCls}" autocapitalize="off" spellcheck="false"></div>`)}
                <div id="pd-msg" class="text-xs mb-3 text-slate-400">3–24 characters: lowercase letters, numbers and _</div>
                <label class="flex items-center gap-2 text-sm font-semibold mb-4"><input id="pd-on" type="checkbox" class="w-4 h-4 accent-indigo-600" ${p.is_public || !p.username ? 'checked' : ''}> Make my Desk public</label>
                <div class="flex flex-wrap gap-2">
                    <button id="pd-save" class="${this._btnCls}">Save</button>
                    <button id="pd-copy" class="${this._ghostBtnCls}" ${p.is_public && p.username ? '' : 'hidden'}>Copy link</button>
                    <a id="pd-open" class="${this._ghostBtnCls}" target="_blank" rel="noopener" href="${p.username ? link(p.username) : '#'}" ${p.is_public && p.username ? '' : 'hidden'}>Open</a>
                </div>`, wrap => {
                const input = wrap.querySelector('#pd-user'), msg = wrap.querySelector('#pd-msg');
                const on = wrap.querySelector('#pd-on');
                const copy = wrap.querySelector('#pd-copy'), openBtn = wrap.querySelector('#pd-open');
                input.addEventListener('input', () => { input.value = input.value.toLowerCase().replace(/[^a-z0-9_]/g, ''); });
                const share = async u => {
                    const url = link(u);
                    if (navigator.share && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
                        try { await navigator.share({ title: 'My WebDesk', text: 'Here\'s my Focus Town and streaks on WebDesks', url }); return; } catch (e) {}
                    }
                    this.copyText(url, 'Link copied — share it anywhere');
                };
                copy.onclick = () => share(this._public.username);
                wrap.querySelector('#pd-save').onclick = async () => {
                    const u = input.value.trim();
                    if (!USERNAME.test(u)) { msg.textContent = 'Use 3–24 lowercase letters, numbers or _.'; msg.className = 'text-xs mb-3 text-rose-500'; return; }
                    if (RESERVED.has(u)) { msg.textContent = 'That name is reserved — try another.'; msg.className = 'text-xs mb-3 text-rose-500'; return; }
                    msg.textContent = 'Saving…'; msg.className = 'text-xs mb-3 text-slate-400';
                    try {
                        await this.publishPublicDesk({ username: u, is_public: on.checked });
                        if (on.checked) {
                            const check = await this._checkPublicLink(u);
                            if (!check.ok) {
                                msg.textContent = 'Saved, but the public page isn\'t answering yet. Try again in a minute — if it persists, contact support.';
                                msg.className = 'text-xs mb-3 text-amber-600 font-bold';
                                copy.hidden = openBtn.hidden = false;
                                openBtn.href = link(u);
                                return;
                            }
                        }
                        msg.textContent = on.checked ? `Live at webdesks.app/u/${u}` : 'Saved. Your Desk is private.';
                        msg.className = 'text-xs mb-3 text-emerald-600 font-bold';
                        copy.hidden = openBtn.hidden = !on.checked;
                        openBtn.href = link(u);
                        if (on.checked) share(u);
                    } catch (e) {
                        const code = e && e.code;
                        msg.textContent = code === '23505' ? 'That username is taken — try another.'
                            : code === '23514' ? 'That username isn\'t allowed — try another.'
                            : 'Couldn\'t save right now. Check your connection and try again.';
                        msg.className = 'text-xs mb-3 text-rose-500';
                    }
                };
            });
        },

        renderAccountButton() {
            orig.renderAccountButton.call(this);
            if (this.account && !this._publicChecked) {
                this._publicChecked = true;
                setTimeout(() => this._maybeRepublish(), 4000);
            }
        },

        // ─────────────────────────────────────────────────────────
        // 3. BLOG "SAVE TO MY WEBDESK" HANDOFF
        // ─────────────────────────────────────────────────────────
        _blogHandoff() {
            const params = new URLSearchParams(location.search);
            const saved = params.get('saved');
            if (!saved) return;
            params.delete('saved');
            const qs = params.toString();
            history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
            const what = { tasks: 'Your to-do list', notes: 'Your note', zones: 'Your world clock', timer: 'Your focus session', sounds: 'Your sound mix', breathing: 'Your breathing practice', color: 'Your colours', status: 'Your status sign' }[saved] || 'Your work';
            setTimeout(() => this.showToast(`💾 ${what} is saved on your WebDesk${this.account ? ' and syncing ☁️' : ''}`), 700);
        },

        _paletteItems() {
            return orig.paletteItems.call(this).concat([
                { id: 'act-public-desk', label: 'Share my Desk (public link)', icon: 'share-2', keywords: 'public desk profile share link username focus town badges', sub: 'Action', run: () => this.openPublicDesk() }
            ]);
        },

        init() {
            orig.init.call(this);
            this.loadSponsors();
            this._blogHandoff();
        }
    });

    const css = document.createElement('style');
    css.id = 'wd-growth';
    css.textContent = `
        .sponsor-card { display: flex; align-items: center; gap: 1rem; padding: 1rem 1.15rem; border-radius: 1.25rem; background: var(--surface); border: 1px solid var(--border);
            box-shadow: var(--shadow-card); text-decoration: none; color: inherit; transition: border-color .15s, transform .15s; }
        a.sponsor-card:hover { border-color: var(--accent); transform: translateY(-1px); }
        .sponsor-house { background: linear-gradient(135deg, var(--surface), var(--accent-soft, #eef2ff)); }
        .sponsor-logo { font-size: 2rem; line-height: 1; width: 3rem; height: 3rem; display: grid; place-items: center; border-radius: .9rem; background: var(--bg); flex-shrink: 0; }
        .sponsor-img { width: 3rem; height: 3rem; border-radius: .9rem; object-fit: cover; flex-shrink: 0; }
        .sponsor-label { display: block; font-size: .65rem; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: #94a3b8; }
        .sponsor-name { display: block; font-weight: 800; font-size: 1rem; }
        .sponsor-tag { display: block; font-size: .82rem; color: var(--muted, #64748b); }
        .sponsor-cta { flex-shrink: 0; padding: .6rem 1rem; border-radius: .9rem; background: var(--accent); color: #fff; font-weight: 800; font-size: .82rem; white-space: nowrap; }
        .sponsor-foot { text-align: center; font-size: .7rem; color: #94a3b8; margin-top: .5rem; }
        .sponsor-foot a { color: var(--accent); font-weight: 700; }
        @media (max-width: 639px) { .sponsor-card { flex-wrap: wrap; } .sponsor-cta { width: 100%; text-align: center; } }
        .pd-preview { text-align: center; padding: 1rem; border-radius: 1.25rem; background: rgba(99,102,241,.07); margin-bottom: 1rem; }
        .pd-sky { font-size: 2rem; letter-spacing: .1em; margin-bottom: .3rem; }
        .pd-badges { display: flex; flex-wrap: wrap; justify-content: center; gap: .35rem; margin-top: .6rem; }
        .pd-badge { font-size: .72rem; font-weight: 700; padding: .25rem .55rem; border-radius: 999px; background: var(--surface, #fff); border: 1px solid var(--border, #e5e7eb); }
    `;
    document.head.appendChild(css);
})();

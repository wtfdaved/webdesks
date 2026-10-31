// ═══════════════════════════════════════════════════════════════
// POLISH — five everyday improvements (v0.31).
//
//  1. "New version" bar   — when a deploy lands while WebDesks is open,
//                           offer a one-tap reload instead of a stale tab.
//  2. Offline indicator   — a small pill when the connection drops
//                           ("your work is saved on this device").
//  3. Daily focus goal    — pick a target (default 60 min); a progress ring
//                           on the Focus tab, a goal line on the weekly chart
//                           and a celebration when you hit it.
//  4. Jump back in        — the last tools you used, one tap away on the
//                           dashboard's Today tab.
//  5. Share               — "Copy link" on every tool's About card, and a QR
//                           code for your Public Desk.
// ═══════════════════════════════════════════════════════════════
(() => {
    const $ = id => document.getElementById(id);
    const esc = s => app.escapeHtml(String(s ?? ''));
    const readLocal = (k, fb) => { try { return JSON.parse(localStorage.getItem(k)) ?? fb; } catch (e) { return fb; } };
    const pad = n => String(n).padStart(2, '0');
    const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
    const QR_LIB = 'https://cdn.jsdelivr.net/npm/qrcode@1.4.4/build/qrcode.min.js';

    const orig = {
        init: app.init, switchTab: app.switchTab, renderWeekFocus: app.renderWeekFocus,
        renderToolAbout: app.renderToolAbout, openPublicDesk: app.openPublicDesk, paletteItems: app._paletteItems
    };

    function bar(id, html, cls) {
        let el = $(id);
        if (!el) { el = document.createElement('div'); el.id = id; document.body.appendChild(el); }
        el.className = 'wd-bar ' + (cls || '');
        el.innerHTML = html;
        el.hidden = false;
        return el;
    }

    Object.assign(app, {
        // ── 1. New version available ─────────────────────────────
        _watchUpdates() {
            if (!('serviceWorker' in navigator)) return;
            // A new worker taking over means a fresh deploy is cached.
            let hadController = !!navigator.serviceWorker.controller;
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (!hadController) { hadController = true; return; } // first install, not an update
                this._offerReload();
            });
            // Check for a new deploy when the tab comes back and every 30 minutes.
            const check = () => navigator.serviceWorker.getRegistration().then(r => r && r.update()).catch(() => {});
            document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
            setInterval(check, 30 * 60 * 1000);
        },
        _offerReload() {
            const el = bar('wd-update-bar', `<span>✨ A new version of WebDesks is ready.</span><button type="button" data-a="reload">Reload</button><button type="button" data-a="x" aria-label="Later">✕</button>`, 'update');
            el.querySelector('[data-a=reload]').onclick = () => { if (this.flushSync) this.flushSync().finally(() => location.reload()); else location.reload(); };
            el.querySelector('[data-a=x]').onclick = () => { el.hidden = true; };
        },

        // ── 2. Offline indicator ─────────────────────────────────
        _watchOnline() {
            const show = () => {
                if (navigator.onLine) {
                    const el = $('wd-offline-bar');
                    if (el && !el.hidden) { el.innerHTML = '<span>✅ Back online</span>'; el.classList.add('ok'); setTimeout(() => { el.hidden = true; el.classList.remove('ok'); }, 2500); }
                } else {
                    bar('wd-offline-bar', `<span>📴 You're offline — everything you do is saved on this device${this.account ? ' and syncs when you reconnect' : ''}.</span>`, 'offline');
                }
            };
            window.addEventListener('online', show);
            window.addEventListener('offline', show);
            if (!navigator.onLine) show();
        },

        // ── 3. Daily focus goal ──────────────────────────────────
        focusGoal() { const g = parseInt(localStorage.getItem('wd_focus_goal') || '60', 10); return g > 0 ? g : 60; },
        setFocusGoal(min) {
            const g = Math.max(5, Math.min(600, Math.round(+min || 60)));
            localStorage.setItem('wd_focus_goal', String(g));
            this.renderWeekFocus();
            this.showToast(`🎯 Daily focus goal: ${g} min`);
        },
        renderWeekFocus() {
            orig.renderWeekFocus.call(this);
            const el = $('w-week');
            if (!el || !el.querySelector('.wk-bars')) return;
            const goal = this.focusGoal();
            const hist = this._focusHistory ? this._focusHistory() : {};
            const done = hist[today()] || 0;
            const pct = Math.min(1, done / goal);
            const vals = [...el.querySelectorAll('.wk-col')].map((c, i) => { const d = new Date(); d.setDate(d.getDate() - 6 + i); const k = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; return hist[k] || 0; });
            const max = Math.max(25, goal, ...vals);
            // Re-scale bars so the goal line fits, and mark days that met it.
            el.querySelectorAll('.wk-col').forEach((c, i) => {
                const b = c.querySelector('.wk-bar');
                // Bars and goal line share one scale: the column minus its day label.
                if (b) b.style.height = `max(4px, calc((100% - 1.25rem) * ${(vals[i] / max).toFixed(3)}))`;
                c.classList.toggle('met', vals[i] >= goal);
            });
            const bars = el.querySelector('.wk-bars');
            bars.style.position = 'relative';
            bars.insertAdjacentHTML('beforeend', `<div class="wk-goal" style="bottom:calc(1.25rem + (100% - 1.25rem - 1rem) * ${(goal / max).toFixed(3)})"><span>goal ${goal}m</span></div>`);
            const r = 26, c = 2 * Math.PI * r;
            el.querySelector('.widget-head').insertAdjacentHTML('afterend', `
                <div class="goal-row">
                    <svg viewBox="0 0 64 64" class="goal-ring" role="img" aria-label="${done} of ${goal} minutes today">
                        <circle cx="32" cy="32" r="${r}" class="track"/>
                        <circle cx="32" cy="32" r="${r}" class="fill" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct)}"/>
                        <text x="32" y="36" text-anchor="middle">${Math.round(pct * 100)}%</text>
                    </svg>
                    <div class="min-w-0"><b>${done} / ${goal} min today</b>
                        <span>${pct >= 1 ? 'Goal reached — nice work! 🎉' : `${goal - done} min to go`}</span>
                        <button type="button" class="goal-edit">Change goal</button></div>
                </div>`);
            el.querySelector('.goal-edit').onclick = () => {
                const v = prompt('Daily focus goal (minutes):', String(goal));
                if (v !== null) this.setFocusGoal(v);
            };
            // Celebrate once per day.
            if (pct >= 1 && localStorage.getItem('wd_goal_hit') !== today()) {
                try { localStorage.setItem('wd_goal_hit', today()); } catch (e) {}
                if (this._celebrate) this._celebrate(`🎯 Daily focus goal reached: ${goal} min!`);
            }
        },

        // ── 4. Jump back in (recent tools) ───────────────────────
        switchTab(tabId, ...rest) {
            const r = orig.switchTab.call(this, tabId, ...rest);
            const id = this.currentTab;
            if (id && id !== 'dashboard' && document.getElementById(id)) {
                const recent = [id].concat(readLocal('wd_recent_tools', []).filter(x => x !== id)).slice(0, 6);
                try { localStorage.setItem('wd_recent_tools', JSON.stringify(recent)); } catch (e) {}
                this._recentDirty = true;
            } else if (id === 'dashboard' && this._recentDirty) { this._recentDirty = false; this.renderRecentTools(); }
            return r;
        },
        renderRecentTools() {
            const pane = $('home-pane-today');
            if (!pane) return;
            let el = $('home-recent');
            const recent = readLocal('wd_recent_tools', []).map(id => this.searchItems.find(i => i.id === id)).filter(t => t && !t.link).slice(0, 5);
            if (!recent.length) { if (el) el.remove(); return; }
            if (!el) { el = document.createElement('div'); el.id = 'home-recent'; el.className = 'home-recent'; pane.prepend(el); }
            const R = window.WD_ROUTES;
            el.innerHTML = `<span class="home-recent-label">Jump back in</span>` + recent.map(t => {
                const href = R ? R.pathFor(t.id) : '/#' + t.id;
                return `<a href="${href}" class="recent-chip" onclick="return app.navLink(event, '${t.id}')"><i data-lucide="${t.icon}" class="w-4 h-4"></i>${esc(t.label.replace(/ —.*$/, '').replace(/ \(.*\)$/, ''))}</a>`;
            }).join('');
            this._rebuildIcons();
        },

        // ── 5. Share: tool links + Public Desk QR ────────────────
        renderToolAbout(tabId) {
            orig.renderToolAbout.call(this, tabId);
            const card = document.querySelector(`#${CSS.escape(tabId)} .tool-about`);
            if (!card || card.querySelector('.tool-share')) return;
            const links = card.querySelector('.tool-about-links');
            if (!links) return;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'tool-share';
            btn.textContent = '🔗 Copy link';
            btn.onclick = () => this.shareTool();
            links.prepend(btn);
        },
        async shareTool() {
            const url = location.origin + location.pathname;
            const title = document.title;
            if (navigator.share && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
                try { await navigator.share({ title, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
            }
            this.copyText(url, 'Link copied — send it to anyone, no sign-up needed');
        },
        async openPublicDesk() {
            await orig.openPublicDesk.call(this);
            const open = document.querySelector('#life-modal #pd-open');
            const wrap = document.getElementById('life-modal');
            if (!open || !wrap || wrap.querySelector('#pd-qr-btn')) return;
            const btn = document.createElement('button');
            btn.id = 'pd-qr-btn';
            btn.type = 'button';
            btn.className = this._ghostBtnCls;
            btn.textContent = 'QR code';
            btn.hidden = open.hidden;
            open.after(btn);
            // Show the QR button whenever the Open link is visible.
            new MutationObserver(() => { btn.hidden = open.hidden; }).observe(open, { attributes: true, attributeFilter: ['hidden'] });
            btn.onclick = async () => {
                const url = open.href;
                let box = wrap.querySelector('#pd-qr');
                if (!box) { box = document.createElement('div'); box.id = 'pd-qr'; box.className = 'pd-qr'; btn.parentElement.after(box); }
                box.innerHTML = '<p class="text-xs text-slate-400">Making your QR code…</p>';
                try {
                    await this._loadScript(QR_LIB);
                    const canvas = document.createElement('canvas');
                    await window.QRCode.toCanvas(canvas, url, { width: 220, margin: 1, color: { dark: '#312e81', light: '#ffffff' } });
                    box.innerHTML = '';
                    box.appendChild(canvas);
                    const a = document.createElement('a');
                    a.textContent = 'Download PNG';
                    a.download = 'my-webdesk-qr.png';
                    a.href = canvas.toDataURL('image/png');
                    a.className = 'text-xs font-bold text-indigo-500';
                    box.appendChild(a);
                } catch (e) { box.innerHTML = '<p class="text-xs text-rose-500">Couldn\'t load the QR maker — check your connection.</p>'; }
            };
        },

        _paletteItems() {
            return orig.paletteItems.call(this).concat([
                { id: 'act-share-tool', label: 'Copy a link to this tool', icon: 'link', keywords: 'share link url copy send tool', sub: 'Action', run: () => this.shareTool() },
                { id: 'act-focus-goal', label: 'Set my daily focus goal', icon: 'target', keywords: 'goal focus minutes daily target pomodoro', sub: 'Action', run: () => { const v = prompt('Daily focus goal (minutes):', String(this.focusGoal())); if (v !== null) this.setFocusGoal(v); } }
            ]);
        },

        init() {
            orig.init.call(this);
            this._watchUpdates();
            this._watchOnline();
            this.renderRecentTools();
            if (this.homePane === 'focus') this.renderWeekFocus();
        }
    });

    const css = document.createElement('style');
    css.id = 'wd-polish';
    css.textContent = `
        .wd-bar { position: fixed; left: 50%; transform: translateX(-50%); z-index: 400; display: flex; align-items: center; gap: .6rem; max-width: calc(100vw - 1.5rem);
            padding: .6rem .7rem .6rem 1rem; border-radius: 1rem; font-size: .85rem; font-weight: 600; color: #fff; box-shadow: 0 14px 34px -12px rgba(15,23,42,.55); }
        .wd-bar[hidden] { display: none; }
        .wd-bar.update { top: calc(4.5rem + env(safe-area-inset-top, 0px)); background: linear-gradient(135deg, #4f46e5, #7c3aed); }
        .wd-bar.offline { bottom: calc(6.4rem + env(safe-area-inset-bottom, 0px)); background: #334155; }
        .wd-bar.offline.ok { background: #059669; }
        @media (min-width: 768px) { .wd-bar.offline { bottom: 1.25rem; } }
        .wd-bar button { padding: .35rem .7rem; border-radius: .7rem; font-weight: 800; background: rgba(255,255,255,.18); color: #fff; }
        .wd-bar button[data-a=reload] { background: #fff; color: #4338ca; }
        .goal-row { display: flex; align-items: center; gap: .85rem; margin-bottom: .6rem; }
        .goal-ring { width: 3.6rem; height: 3.6rem; flex-shrink: 0; transform: rotate(-90deg); }
        .goal-ring circle { fill: none; stroke-width: 7; }
        .goal-ring .track { stroke: rgba(124,58,237,.14); }
        .goal-ring .fill { stroke: #7c3aed; stroke-linecap: round; transition: stroke-dashoffset .6s ease; }
        .goal-ring text { transform: rotate(90deg); transform-origin: 32px 32px; font-size: 13px; font-weight: 800; fill: currentColor; }
        .goal-row b { display: block; font-size: .95rem; } .goal-row span { display: block; font-size: .75rem; color: var(--muted); }
        .goal-edit { font-size: .72rem; font-weight: 700; color: var(--accent); padding: 0; margin-top: .1rem; }
        .wk-goal { position: absolute; left: 0; right: 0; border-top: 2px dashed rgba(124,58,237,.45); pointer-events: none; }
        .wk-goal span { position: absolute; right: 0; top: -1.1rem; font-size: .62rem; font-weight: 800; color: #7c3aed; }
        .wk-col.met .wk-bar { background: linear-gradient(180deg, #34d399, #059669); opacity: .85; }
        .home-recent { display: flex; align-items: center; gap: .45rem; flex-wrap: wrap; margin-bottom: 1rem; }
        .home-recent-label { font-size: .7rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); margin-right: .2rem; }
        .recent-chip { display: inline-flex; align-items: center; gap: .4rem; padding: .45rem .8rem; border-radius: 999px; background: var(--surface); border: 1px solid var(--border);
            font-size: .82rem; font-weight: 700; color: inherit; text-decoration: none; box-shadow: var(--shadow-card); }
        .recent-chip:hover { border-color: var(--accent); color: var(--accent); }
        @media (max-width: 639px) { .home-recent { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; padding-bottom: .2rem; } .home-recent::-webkit-scrollbar { display: none; } .recent-chip { flex-shrink: 0; } }
        .tool-share { padding: .3rem .7rem; border-radius: 999px; background: var(--accent, #4f46e5); color: #fff; font-weight: 800; font-size: .78rem; }
        .pd-qr { display: flex; flex-direction: column; align-items: center; gap: .5rem; margin-top: 1rem; }
        .pd-qr canvas { border-radius: 1rem; border: 1px solid var(--border, #e5e7eb); }
    `;
    document.head.appendChild(css);
})();

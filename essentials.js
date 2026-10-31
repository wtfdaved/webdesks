// ═══════════════════════════════════════════════════════════════
// ESSENTIALS — five everyday improvements (v0.32).
//
//  1. Next up        — the next event or timed task today, with a live
//                      countdown, as a chip in the dashboard hero.
//  2. App badge      — installed WebDesks shows how many tasks are due
//                      today on its icon (Badging API).
//  3. What's new     — a short panel once after each release (and in ⌘K).
//  4. Desk backup    — guests' Desks live only in this browser: a gentle
//                      reminder every two weeks to download a backup (or
//                      create a free account), plus one-file restore.
//  (5. Security & caching headers live in _headers.)
// ═══════════════════════════════════════════════════════════════
(() => {
    const VERSION = '0.32';
    const $ = id => document.getElementById(id);
    const esc = s => app.escapeHtml(String(s ?? ''));
    const pad = n => String(n).padStart(2, '0');
    const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const readLocal = (k, fb) => { try { return JSON.parse(localStorage.getItem(k)) ?? fb; } catch (e) { return fb; } };

    // Newest first. Keep each item short and in plain words.
    const CHANGELOG = [
        { v: '0.32', title: 'Smarter home screen', items: [
            '⏰ <b>Next up</b> — your next event or timed task, with a countdown, right in the greeting.',
            '🔴 <b>App badge</b> — the installed app shows how many tasks are due today.',
            '💾 <b>Desk backup</b> — download your whole Desk as one file and restore it anywhere (⌘K → "Back up").',
            '🛡️ Faster repeat visits and stronger security headers.'
        ] },
        { v: '0.31', title: 'Fixes and polish', items: [
            '🔗 Tool links and Public Desks now open correctly when you refresh or share them.',
            '🎯 <b>Daily focus goal</b> with a progress ring and goal line on your weekly chart.',
            '↩️ <b>Jump back in</b> to the tools you used last, plus "Copy link" on every tool.'
        ] },
        { v: '0.30', title: 'A calmer dashboard', items: [
            '🗂️ Today, Focus, Life and Tools tabs instead of one long page — hide widgets with <b>Customize</b>.',
            '➕ <b>Quick capture</b>: press N anywhere to add a task, note or snippet.'
        ] }
    ];

    const orig = { init: app.init, renderLifeDashCard: app.renderLifeDashCard, renderTasks: app.renderTasks, paletteItems: app._paletteItems };

    Object.assign(app, {
        // ── 1. Next up ───────────────────────────────────────────
        _nextUp() {
            const now = new Date();
            const end = new Date(now); end.setHours(23, 59, 59, 999);
            const t = ymd(now);
            const items = [];
            (this.calEvents || []).forEach(e => {
                if (!e || e.allDay || !e.start || e.start.slice(0, 10) !== t) return;
                const s = new Date(e.start);
                if (!isNaN(s)) items.push({ at: s, title: e.title || 'Event', kind: 'event' });
            });
            (this.tasks || []).forEach(x => {
                if (x.done || x.date !== t || !x.time) return;
                items.push({ at: new Date(`${x.date}T${x.time}`), title: x.text, kind: 'task' });
            });
            (this._agendaCache || []).forEach(e => { if (!e.allDay && e.start >= now && e.start <= end) items.push({ at: e.start, title: e.title, kind: 'event' }); });
            return items.filter(i => i.at > now && i.at <= end).sort((a, b) => a.at - b.at)[0] || null;
        },
        renderNextUp() {
            const chips = document.querySelector('#life-dash-card .hero-chips');
            if (!chips) return;
            let el = $('hero-next');
            const n = this._nextUp();
            if (!n) { if (el) el.remove(); return; }
            if (!el) { el = document.createElement('button'); el.id = 'hero-next'; el.type = 'button'; el.className = 'hero-chip hero-next'; chips.prepend(el); }
            const mins = Math.max(0, Math.round((n.at - new Date()) / 60000));
            const when = mins < 1 ? 'now' : mins < 60 ? `in ${mins} min` : `at ${n.at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
            el.classList.toggle('soon', mins <= 15);
            el.innerHTML = `⏰ Next: <b>${esc(n.title.length > 34 ? n.title.slice(0, 33) + '…' : n.title)}</b> · ${esc(when)}`;
            el.title = n.at.toLocaleString();
            el.onclick = () => this.switchTab(n.kind === 'task' ? 'tasks' : 'calendar');
        },
        renderLifeDashCard() {
            orig.renderLifeDashCard.call(this);
            this.renderNextUp();
        },

        // ── 2. App badge (tasks due today or overdue) ────────────
        updateAppBadge() {
            if (!('setAppBadge' in navigator)) return;
            const t = ymd(new Date());
            const n = (this.tasks || []).filter(x => !x.done && x.date && x.date <= t).length;
            (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {});
        },
        renderTasks(...args) {
            const r = orig.renderTasks.apply(this, args);
            this.updateAppBadge();
            return r;
        },

        // ── 3. What's new ────────────────────────────────────────
        openWhatsNew() {
            this.lifeModal('✨ What\'s new in WebDesks', `
                <div class="wn">${CHANGELOG.map((c, i) => `
                    <section class="wn-rel${i ? ' old' : ''}">
                        <div class="wn-v">v${esc(c.v)} · ${esc(c.title)}</div>
                        <ul>${c.items.map(it => `<li>${it}</li>`).join('')}</ul>
                    </section>`).join('')}
                </div>
                <button class="${this._btnCls} w-full mt-2" onclick="app.closeLifeModal()">Got it</button>`);
            try { localStorage.setItem('wdl_seen_version', VERSION); } catch (e) {}
        },
        _maybeWhatsNew() {
            const seen = localStorage.getItem('wdl_seen_version');
            // Brand-new visitors have nothing to compare against.
            const returning = (this.tasks && this.tasks.length) || localStorage.getItem('wd_onboard') || localStorage.getItem('wd_total_min');
            if (!seen && !returning) { try { localStorage.setItem('wdl_seen_version', VERSION); } catch (e) {} return; }
            if (seen === VERSION) return;
            // Don't stack on top of another dialog or the morning check-in.
            setTimeout(() => {
                if (document.querySelector('#life-modal.flex') || this._cmdkOpen || this.currentTab !== 'dashboard') {
                    try { localStorage.setItem('wdl_seen_version', VERSION); } catch (e) {}
                    this.showToast(`✨ WebDesks v${VERSION} — see what's new in ⌘K`);
                    return;
                }
                this.openWhatsNew();
            }, 2500);
        },

        // ── 4. Desk backup & restore ─────────────────────────────
        _deskKeys() {
            const out = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && (k.startsWith('wd_') || k.startsWith('webdesks_')) && !['wd_sync_meta', 'wd_sync_state'].includes(k)) out.push(k);
            }
            return out.sort();
        },
        downloadBackup() {
            const data = {};
            this._deskKeys().forEach(k => { data[k] = localStorage.getItem(k); });
            const blob = new Blob([JSON.stringify({ app: 'webdesks-desk', version: VERSION, exported: new Date().toISOString(), data }, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `webdesks-backup-${ymd(new Date())}.json`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 1000);
            try { localStorage.setItem('wdl_backup_at', String(Date.now())); } catch (e) {}
            const bar = $('wd-backup-bar'); if (bar) bar.remove();
            this.showToast('💾 Backup downloaded — keep it somewhere safe');
        },
        restoreBackup() {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'application/json,.json';
            input.onchange = async () => {
                const f = input.files && input.files[0];
                if (!f) return;
                let parsed;
                try { parsed = JSON.parse(await f.text()); } catch (e) { this.showToast('That file isn\'t a WebDesks backup'); return; }
                const data = parsed && (parsed.data || null);
                const keys = data ? Object.keys(data).filter(k => (k.startsWith('wd_') || k.startsWith('webdesks_')) && typeof data[k] === 'string' && !['wd_sync_meta', 'wd_sync_state'].includes(k)) : [];
                if (!keys.length || (parsed.app && parsed.app !== 'webdesks-desk')) { this.showToast('That file isn\'t a WebDesks backup'); return; }
                const when = parsed.exported ? new Date(parsed.exported).toLocaleDateString() : 'an earlier date';
                if (!confirm(`Restore ${keys.length} tools from the backup made ${when}?\n\nThis replaces what's in this browser for those tools${this.account ? ' and syncs it to your account' : ''}.`)) return;
                keys.forEach(k => { try { localStorage.setItem(k, data[k]); } catch (e) {} });
                this.showToast('✅ Desk restored — reloading…');
                const go = () => location.reload();
                if (this.account && this.sync) this.sync().finally(() => setTimeout(go, 300)); else setTimeout(go, 700);
            };
            input.click();
        },
        // Guests with real data, every 14 days: back it up or make an account.
        _maybeBackupNudge() {
            if (this.account || $('wd-backup-bar')) return;
            const meaningful = (this.tasks || []).length >= 3 || (readLocal('wd_pages', []) || []).length > 1 || this._deskKeys().length >= 12;
            if (!meaningful) return;
            const last = Math.max(+localStorage.getItem('wdl_backup_at') || 0, +localStorage.getItem('wdl_backup_snooze') || 0);
            if (Date.now() - last < 14 * 86400000) return;
            if (!localStorage.getItem('wdl_backup_snooze') && !localStorage.getItem('wdl_backup_at')) {
                // First time we'd ask: wait a couple of weeks after they started.
                try { localStorage.setItem('wdl_backup_snooze', String(Date.now())); } catch (e) {}
                return;
            }
            const bar = document.createElement('div');
            bar.id = 'wd-backup-bar';
            bar.className = 'wd-backup';
            bar.setAttribute('role', 'region');
            bar.setAttribute('aria-label', 'Back up your Desk');
            bar.innerHTML = `<span class="wd-backup-txt"><b>💾 Your Desk lives only in this browser.</b> Clearing site data would erase it.</span>
                <button type="button" data-a="dl">Download backup</button>
                <a href="/login?mode=signup" data-a="acct">Sync free</a>
                <button type="button" data-a="later" aria-label="Remind me later">Later</button>`;
            bar.querySelector('[data-a=dl]').onclick = () => this.downloadBackup();
            bar.querySelector('[data-a=later]').onclick = () => { try { localStorage.setItem('wdl_backup_snooze', String(Date.now())); } catch (e) {} bar.remove(); };
            document.body.appendChild(bar);
        },

        _paletteItems() {
            return orig.paletteItems.call(this).concat([
                { id: 'act-whats-new', label: 'What\'s new in WebDesks', icon: 'sparkles', keywords: 'changelog release notes new features update version', sub: 'Action', run: () => this.openWhatsNew() },
                { id: 'act-backup', label: 'Back up my Desk (download)', icon: 'download', keywords: 'backup export download save desk data json', sub: 'Action', run: () => this.downloadBackup() },
                { id: 'act-restore', label: 'Restore a Desk backup', icon: 'upload', keywords: 'restore import backup upload desk data json', sub: 'Action', run: () => this.restoreBackup() }
            ]);
        },

        init() {
            orig.init.call(this);
            this.renderNextUp();
            this.updateAppBadge();
            setInterval(() => { if (!document.hidden) { this.renderNextUp(); this.updateAppBadge(); } }, 30 * 1000);
            this._maybeWhatsNew();
            setTimeout(() => this._maybeBackupNudge(), 8000);
        }
    });

    const css = document.createElement('style');
    css.id = 'wd-essentials';
    css.textContent = `
        .hero-next { cursor: pointer; background: rgba(255,255,255,.24) !important; border: 1px solid rgba(255,255,255,.35); }
        .hero-next:hover { background: rgba(255,255,255,.32) !important; }
        .hero-next.soon { background: #fde68a !important; color: #78350f; border-color: #fcd34d; }
        .wn { display: grid; gap: .9rem; max-height: 60vh; overflow: auto; }
        .wn-rel.old { opacity: .7; }
        .wn-v { font-size: .72rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #6366f1; margin-bottom: .35rem; }
        .wn ul { list-style: none; padding: 0; margin: 0; display: grid; gap: .45rem; font-size: .9rem; line-height: 1.45; }
        .wd-backup { position: fixed; left: 50%; transform: translateX(-50%); bottom: 1.25rem; z-index: 380; display: flex; flex-wrap: wrap; align-items: center; gap: .5rem;
            width: min(44rem, calc(100vw - 1.5rem)); padding: .75rem .8rem .75rem 1rem; border-radius: 1.1rem; background: #0f172a; color: #e2e8f0; font-size: .85rem;
            box-shadow: 0 18px 40px -14px rgba(15,23,42,.6); }
        .wd-backup-txt { flex: 1 1 16rem; }
        .wd-backup button, .wd-backup a { padding: .45rem .8rem; border-radius: .75rem; font-weight: 800; font-size: .8rem; text-decoration: none; }
        .wd-backup [data-a=dl] { background: #fff; color: #0f172a; }
        .wd-backup [data-a=acct] { background: #4f46e5; color: #fff; }
        .wd-backup [data-a=later] { color: #94a3b8; }
        @media (max-width: 767px) { .wd-backup { bottom: calc(6.4rem + env(safe-area-inset-bottom, 0px)); } }
    `;
    document.head.appendChild(css);
})();

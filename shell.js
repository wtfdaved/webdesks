/* ═══════════════════════════════════════════════════════════════
   WebDesks app shell — the parts that make it feel like an app on a phone:
     • the More sheet: every tool, grouped, with search only on demand
       (it used to focus the search box on open, which threw up the
       keyboard and zoomed Safari)
     • "Add to Home Screen": the browser install prompt where there is
       one, step-by-step instructions on iPhone/iPad where there isn't
     • the current tool's name in the phone header
     • service-worker registration (offline support)
   ═══════════════════════════════════════════════════════════════ */
(() => {
    const GROUP_COLORS = {
        'Life Planner': ['#f59e0b', '#f97316'],
        'Workspace': ['#3b82f6', '#6366f1'],
        'Focus': ['#10b981', '#0ea5e9'],
        'Tools': ['#8b5cf6', '#d946ef'],
        'Group Games': ['#ec4899', '#f43f5e'],
    };
    const LINKS = {
        feud: { label: 'Survey Says', icon: 'trophy', href: '/family-feud' },
        games: { label: 'All games', icon: 'party-popper', href: '/games/' },
    };
    const $ = id => document.getElementById(id);
    const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const icons = () => { try { app._rebuildIcons(); } catch (e) {} };
    const phone = () => window.matchMedia('(max-width: 767px)').matches;

    // ── Install detection ────────────────────────────────────────
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isIOSSafari = isIOS && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
    const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    let deferredPrompt = null;
    const canInstall = () => !standalone() && (!!deferredPrompt || isIOS || /Android/.test(ua));

    // ── More sheet ───────────────────────────────────────────────
    function sheetGroups() {
        const groups = [];
        document.querySelectorAll('aside nav .nav-group').forEach(g => {
            const items = [...g.querySelectorAll('.nav-btn')].map(itemFor).filter(Boolean);
            if (items.length) groups.push({ name: g.dataset.group, items });
        });
        const seen = new Set(groups.flatMap(g => g.items.map(i => i.id)));
        const rest = app.tabOrder.filter(id => !seen.has(id)).map(id => itemFor({ dataset: { tab: id } }));
        if (!groups.length) groups.push({ name: 'Tools', items: rest });
        else if (rest.length) groups[0].items.unshift(...rest);
        return groups;
    }
    function itemFor(btn) {
        const d = btn.dataset || {};
        if (d.tab) {
            const reg = app.searchItems.find(i => i.id === d.tab) || {};
            return { id: d.tab, label: (app.tabLabels && app.tabLabels[d.tab]) || reg.label || d.tab, full: reg.label || '', icon: (app.tabIcons && app.tabIcons[d.tab]) || reg.icon || 'square', keywords: reg.keywords || '' };
        }
        if (d.link && LINKS[d.link]) {
            const reg = app.searchItems.find(i => i.id === d.link) || {};
            return { id: d.link, ...LINKS[d.link], full: reg.label || '', keywords: reg.keywords || '' };
        }
        return null;
    }
    function tile(it, colors, row) {
        const style = `--c1:${colors[0]};--c2:${colors[1]}`;
        const inner = `<span class="ic"><i data-lucide="${esc(it.icon)}"></i></span><span>${esc(it.label)}${row && it.full && it.full !== it.label ? `<small>${esc(it.full)}</small>` : ''}</span>`;
        const cur = it.id === app.currentTab ? ' current' : '';
        return it.href
            ? `<a class="ms-tile${cur}" href="${esc(it.href)}" style="${style}">${inner}</a>`
            : `<button type="button" class="ms-tile${cur}" data-tab="${esc(it.id)}" style="${style}">${inner}</button>`;
    }

    function renderSheet() {
        const d = $('more-drawer');
        if (!d) return;
        const installed = standalone();
        d.innerHTML = `
            <div class="drawer-handle" aria-hidden="true"></div>
            <div class="ms-head">
                <h2>All tools</h2>
                <button type="button" class="ms-iconbtn" data-ms="search" aria-label="Search tools"><i data-lucide="search" class="w-4 h-4"></i> Search</button>
                <button type="button" class="ms-iconbtn round" data-ms="close" aria-label="Close"><i data-lucide="x" class="w-4 h-4"></i></button>
            </div>
            <div class="ms-search" hidden>
                <input id="drawer-search" type="search" placeholder="Search tools…" autocomplete="off" enterkeyhint="go" aria-label="Search tools">
                <button type="button" data-ms="cancel">Cancel</button>
            </div>
            <div class="ms-body" id="drawer-tool-grid">
                <div class="ms-quick">
                    ${installed
                        ? `<button type="button" data-ms="share"><i data-lucide="share"></i>Share WebDesks</button>`
                        : `<button type="button" class="install" data-ms="install"><i data-lucide="smartphone"></i>Add to Home Screen</button>`}
                    <button type="button" data-ms="theme"><i data-lucide="moon"></i>Dark mode</button>
                    <button type="button" data-ms="privacy"><i data-lucide="eye-off"></i>Privacy screen</button>
                </div>
                <div id="ms-groups">${sheetGroups().map(g => `
                    <div class="ms-group">${esc(g.name)}</div>
                    <div class="ms-grid">${g.items.map(it => tile(it, GROUP_COLORS[g.name] || ['#6366f1', '#8b5cf6'])).join('')}</div>`).join('')}
                </div>
                <div id="ms-results" class="ms-results" hidden></div>
            </div>`;
        bindSheet(d);
        icons();
    }

    function bindSheet(d) {
        d.addEventListener('click', e => {
            const t = e.target.closest('[data-tab],[data-ms],a.ms-tile');
            if (!t) return;
            if (t.dataset.tab) { app.switchTab(t.dataset.tab); app.closeMoreDrawer(); app.vibrate && app.vibrate([20]); return; }
            if (t.tagName === 'A') { app.closeMoreDrawer(); return; }
            const a = t.dataset.ms;
            if (a === 'close') app.closeMoreDrawer();
            else if (a === 'search') startSearch();
            else if (a === 'cancel') endSearch();
            else if (a === 'install') { app.closeMoreDrawer(); app.installApp(); }
            else if (a === 'share') { app.closeMoreDrawer(); shareApp(); }
            else if (a === 'theme') app.toggleTheme();
            else if (a === 'privacy') { app.closeMoreDrawer(); app.togglePrivacy(); }
        });
        const input = d.querySelector('#drawer-search');
        input.addEventListener('input', () => app.filterDrawer(input.value));
        input.addEventListener('keydown', e => {
            if (e.key === 'Enter') { const first = d.querySelector('#ms-results .ms-tile'); if (first) first.click(); }
        });
        // Swipe down to close — from the handle/header, or from the list when it's scrolled to the top.
        let y0 = null;
        const body = d.querySelector('.ms-body');
        d.addEventListener('touchstart', e => {
            const fromList = body.contains(e.target);
            y0 = (!fromList || body.scrollTop <= 0) && !d.classList.contains('searching') ? e.touches[0].clientY : null;
        }, { passive: true });
        d.addEventListener('touchend', e => {
            if (y0 != null && e.changedTouches[0].clientY - y0 > 90) app.closeMoreDrawer();
            y0 = null;
        }, { passive: true });
    }

    function startSearch() {
        const d = $('more-drawer');
        d.classList.add('searching');
        d.querySelector('.ms-search').hidden = false;
        d.querySelector('.ms-head').hidden = true;
        const input = $('drawer-search');
        input.value = '';
        app.filterDrawer('');
        input.focus(); // the person asked to type, so the keyboard is expected now
    }
    function endSearch() {
        const d = $('more-drawer');
        if (!d) return;
        d.classList.remove('searching');
        const s = d.querySelector('.ms-search'); if (s) s.hidden = true;
        const h = d.querySelector('.ms-head'); if (h) h.hidden = false;
        const input = $('drawer-search');
        if (input) { input.value = ''; input.blur(); }
        app.filterDrawer('');
    }

    let lastFocus = null;
    function onKey(e) { if (e.key === 'Escape') app.closeMoreDrawer(); }

    // ── Install banner + sheets ──────────────────────────────────
    const SHARE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>';
    const PLUS_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>';

    function sheet(html) {
        closeSheet();
        const back = document.createElement('div');
        back.className = 'wd-sheet-back';
        back.id = 'wd-sheet';
        back.innerHTML = `<div class="wd-sheet" role="dialog" aria-modal="true" aria-labelledby="wd-sheet-title">${html}</div>`;
        back.addEventListener('click', e => { if (e.target === back || e.target.closest('[data-close]')) closeSheet(); });
        document.body.appendChild(back);
        icons();
        const btn = back.querySelector('button');
        if (btn) btn.focus({ preventScroll: true });
        return back;
    }
    function closeSheet() { const s = $('wd-sheet'); if (s) s.remove(); }

    const PERKS = `<div class="wd-perks"><div><span>📱</span>Opens full-screen</div><div><span>⚡</span>One-tap launch</div><div><span>✈️</span>Works offline</div></div>`;
    function iosSheet() {
        const where = isIOSSafari ? 'in Safari’s toolbar (on newer iPhones, tap <span class="k">•••</span> first)' : 'in your browser’s menu';
        sheet(`
            <h3 id="wd-sheet-title">Add WebDesks to your Home Screen</h3>
            <p>Get an app icon that opens WebDesks full-screen — no App Store needed.</p>
            ${PERKS}
            <ol class="wd-steps">
                <li><span class="n">1</span><span>Tap <span class="k">${SHARE_SVG} Share</span> ${where}</span></li>
                <li><span class="n">2</span><span>Scroll down and tap <span class="k">${PLUS_SVG} Add to Home Screen</span></span></li>
                <li><span class="n">3</span><span>Tap <b>Add</b> — WebDesks appears with your apps</span></li>
            </ol>
            <button class="wd-btn" data-close>Got it</button>`);
    }
    function genericSheet() {
        sheet(`
            <h3 id="wd-sheet-title">Install WebDesks</h3>
            <p>Add WebDesks to your home screen or dock so it opens like an app.</p>
            ${PERKS}
            <ol class="wd-steps">
                <li><span class="n">1</span><span>Open your browser menu <span class="k">⋮</span></span></li>
                <li><span class="n">2</span><span>Choose <b>Install app</b> or <b>Add to Home screen</b></span></li>
                <li><span class="n">3</span><span>Confirm — WebDesks gets its own icon</span></li>
            </ol>
            <button class="wd-btn" data-close>Got it</button>`);
    }

    async function shareApp() {
        const data = { title: 'WebDesks', text: 'Free planner, focus timer, chores and 25+ tools in one tab.', url: 'https://webdesks.app/' };
        try {
            if (navigator.share) await navigator.share(data);
            else { await navigator.clipboard.writeText(data.url); app.showToast('Link copied'); }
        } catch (e) {}
    }

    const DISMISS_KEY = 'wd_pwa_dismissed'; // per-device (not synced)
    function bannerDismissed() {
        const v = localStorage.getItem(DISMISS_KEY);
        if (!v) return false;
        const t = Number(v);
        return !t || Date.now() - t < 30 * 864e5; // ask again after a month ('1' from older versions = for good)
    }
    function showBanner() {
        if ($('wd-install-banner') || standalone() || bannerDismissed() || !canInstall()) return;
        if (!phone() && !deferredPrompt) return;
        const b = document.createElement('div');
        b.id = 'wd-install-banner';
        b.setAttribute('role', 'complementary');
        b.setAttribute('aria-label', 'Install WebDesks');
        b.innerHTML = `<img src="/icon-192.png" alt="" width="42" height="42"><div><b>Get the WebDesks app</b><small>Add it to your Home Screen — free</small></div>
            <button class="go" type="button">${isIOS ? 'How?' : 'Install'}</button><button class="x" type="button" aria-label="Not now">✕</button>`;
        b.querySelector('.go').onclick = () => { b.remove(); app.installApp(); };
        b.querySelector('.x').onclick = () => { b.remove(); try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch (e) {} };
        document.body.appendChild(b);
    }

    // ── Public API ───────────────────────────────────────────────
    Object.assign(app, {
        initMoreDrawer() { /* rendered lazily on first open */ },
        openMoreDrawer() {
            const back = $('more-drawer-backdrop'), d = $('more-drawer');
            if (!back || !d) return;
            renderSheet();
            lastFocus = document.activeElement;
            back.classList.add('open');
            d.classList.add('open');
            d.setAttribute('tabindex', '-1');
            d.focus({ preventScroll: true }); // focus the sheet, not the search box
            document.addEventListener('keydown', onKey);
            $('mob-more-btn') && $('mob-more-btn').classList.add('active');
            this.vibrate && this.vibrate([15]);
        },
        closeMoreDrawer() {
            endSearch();
            $('more-drawer-backdrop') && $('more-drawer-backdrop').classList.remove('open');
            $('more-drawer') && $('more-drawer').classList.remove('open');
            $('mob-more-btn') && $('mob-more-btn').classList.remove('active');
            document.removeEventListener('keydown', onKey);
            if (lastFocus && lastFocus.focus && document.activeElement && $('more-drawer').contains(document.activeElement)) lastFocus.focus({ preventScroll: true });
        },
        filterDrawer(query) {
            const q = String(query || '').toLowerCase().trim();
            const groups = $('ms-groups'), res = $('ms-results');
            if (!groups || !res) return;
            groups.hidden = !!q;
            res.hidden = !q;
            if (!q) { res.innerHTML = ''; return; }
            const hits = [];
            sheetGroups().forEach(g => g.items.forEach(it => {
                const hay = `${it.label} ${it.full} ${it.keywords} ${g.name}`.toLowerCase();
                const score = it.label.toLowerCase().startsWith(q) ? 0 : it.full.toLowerCase().includes(q) || it.label.toLowerCase().includes(q) ? 1 : q.split(/\s+/).every(w => hay.includes(w)) ? 2 : -1;
                if (score >= 0) hits.push({ it, colors: GROUP_COLORS[g.name] || ['#6366f1', '#8b5cf6'], score });
            }));
            hits.sort((a, b) => a.score - b.score);
            res.innerHTML = hits.length ? hits.map(h => tile(h.it, h.colors, true)).join('') : `<div class="ms-empty">No tools match “${esc(query)}”.</div>`;
            icons();
        },

        initPWAInstall() {
            window.addEventListener('beforeinstallprompt', e => {
                e.preventDefault();
                deferredPrompt = e;
                setTimeout(showBanner, 20000);
            });
            window.addEventListener('appinstalled', () => {
                deferredPrompt = null;
                const b = $('wd-install-banner'); if (b) b.remove();
                this.showToast('WebDesks is on your Home Screen 🎉');
            });
            // iPhone/iPad have no install prompt; offer the steps on a return visit.
            let visits = 0;
            try {
                visits = Number(localStorage.getItem('wd-visits') || 0);
                if (!sessionStorage.getItem('wd-visit-counted')) { visits++; localStorage.setItem('wd-visits', String(visits)); sessionStorage.setItem('wd-visit-counted', '1'); }
            } catch (e) {}
            if (isIOS && visits >= 2) setTimeout(showBanner, 15000);
        },
        async installApp() {
            if (standalone()) { this.showToast('WebDesks is already installed on this device.'); return; }
            if (deferredPrompt) {
                const p = deferredPrompt;
                deferredPrompt = null;
                p.prompt();
                try {
                    const { outcome } = await p.userChoice;
                    if (outcome === 'accepted') this.showToast('Installing WebDesks…');
                } catch (e) {}
                return;
            }
            if (isIOS) iosSheet(); else genericSheet();
        },
        shareApp,
    });

    app.paletteActions.push({ id: 'act-install', label: 'Install WebDesks (Add to Home Screen)', icon: 'smartphone', keywords: 'install app pwa home screen add icon download offline', run() { app.installApp(); } });

    // ── Phone header: large-title pattern ────────────────────────
    // "WebDesks" at the top of a tool; the tool's name once its own title
    // has scrolled out of view.
    const baseSwitch = app.switchTab;
    function headerTitle() {
        const el = $('brand-name');
        if (!el) return;
        const id = app.currentTab;
        const reg = app.searchItems.find(i => i.id === id);
        const tab = document.querySelector('.tab-content.active');
        const scrolled = tab && tab.scrollTop > 70;
        const name = phone() && id && id !== 'dashboard' && reg && scrolled ? reg.label.split(' — ')[0] : 'WebDesks';
        if (el.textContent !== name) el.textContent = name;
    }
    app.switchTab = function (...args) {
        const r = baseSwitch.apply(this, args);
        headerTitle();
        return r;
    };
    let titleRaf = 0;
    document.addEventListener('scroll', e => {
        if (!e.target.classList || !e.target.classList.contains('tab-content') || titleRaf) return;
        titleRaf = requestAnimationFrame(() => { titleRaf = 0; headerTitle(); });
    }, { capture: true, passive: true });
    window.addEventListener('resize', headerTitle);

    // ── Status bar / browser chrome follows light & dark mode ────
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    const syncThemeColor = () => {
        if (!themeMeta) return;
        themeMeta.setAttribute('content', document.documentElement.classList.contains('dark') ? '#0f1218' : '#f6f5f1');
    };
    syncThemeColor();
    new MutationObserver(syncThemeColor).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    // ── Offline support ──────────────────────────────────────────
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
        window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
    }
})();

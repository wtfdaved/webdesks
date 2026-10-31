// ═══════════════════════════════════════════════════════════════
// HOME — the dashboard, reorganised (v0.30).
//
// The dashboard used to be one long scroll: hero, search, toolkit and
// fifteen widgets. Now it's a compact hero and four tabs, each a balanced
// two-column grid:
//
//   Today  — tasks / get-started checklist, calendar agenda, launchers, alarm
//   Focus  — focus timer, this week's focus report, latest note, quote
//   Life   — snippet vault, money, mood, hydration
//   Tools  — Desk presets and the toolkit
//
// The last tab is remembered, widgets can be hidden from "Customize", and
// the guest sign-up card is a dismissible strip.
//
// Also here:
//   • Weekly focus report — minutes per day for the last 7 days.
//   • Quick capture — press N anywhere (or the + button on phones) to add a
//     task, note or snippet without leaving what you're doing.
// ═══════════════════════════════════════════════════════════════
(() => {
    const $ = id => document.getElementById(id);
    const esc = s => app.escapeHtml(String(s ?? ''));
    const readLocal = (k, fb) => { try { return JSON.parse(localStorage.getItem(k)) ?? fb; } catch (e) { return fb; } };
    const pad = n => String(n).padStart(2, '0');
    const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    const PANES = [
        { id: 'today', label: 'Today', icon: 'sun', widgets: ['w-spotlight', 'w-tasks', 'w-agenda', 'w-quick', 'w-alarm'] },
        { id: 'focus', label: 'Focus', icon: 'hourglass', widgets: ['w-timer', 'w-week', 'w-note', 'w-quote'] },
        { id: 'life', label: 'Life', icon: 'heart', widgets: ['w-snippets', 'w-money', 'w-mood', 'w-water'] },
        { id: 'tools', label: 'Tools', icon: 'layout-grid', widgets: [] }
    ];
    const NAMES = {
        'w-tasks': 'Tasks & get started', 'w-agenda': 'Calendar agenda', 'w-quick': 'Launchers & quick actions', 'w-alarm': 'Next alarm',
        'w-timer': 'Focus timer', 'w-week': 'This week\'s focus', 'w-note': 'Latest note', 'w-quote': 'Daily quote',
        'w-snippets': 'Snippet vault', 'w-money': 'Money', 'w-mood': 'Mood', 'w-water': 'Hydration'
    };
    // Full-width widgets in the two-column grid.
    const FULL = new Set(['w-spotlight']);

    const orig = { init: app.init, renderOnboarding: app.renderOnboarding, switchTab: app.switchTab };

    Object.assign(app, {
        homePane: 'today',

        _buildHome() {
            const home = document.querySelector('#dashboard .home');
            if (!home || $('home-tabs')) return;
            const search = home.querySelector('.home-search');
            const toolkit = $('home-toolkit') && $('home-toolkit').closest('section');
            const oldBento = $('home-bento');

            // The new weekly focus widget joins the others.
            const week = document.createElement('div');
            week.className = 'widget';
            week.id = 'w-week';
            if (oldBento) oldBento.appendChild(week);

            const tabs = document.createElement('nav');
            tabs.id = 'home-tabs';
            tabs.className = 'home-tabs';
            tabs.setAttribute('role', 'tablist');
            tabs.setAttribute('aria-label', 'Dashboard sections');
            tabs.innerHTML = PANES.map(p => `<button role="tab" id="home-tab-${p.id}" aria-controls="home-pane-${p.id}" data-pane="${p.id}" class="home-tab"><i data-lucide="${p.icon}" class="w-4 h-4"></i>${p.label}</button>`).join('')
                + `<button class="home-customize" type="button" title="Show or hide widgets"><i data-lucide="sliders-horizontal" class="w-4 h-4"></i><span>Customize</span></button>`;

            const panes = document.createElement('div');
            panes.id = 'home-panes';
            PANES.forEach(p => {
                const pane = document.createElement('section');
                pane.className = 'home-pane';
                pane.id = 'home-pane-' + p.id;
                pane.dataset.pane = p.id;
                pane.setAttribute('role', 'tabpanel');
                pane.setAttribute('aria-labelledby', 'home-tab-' + p.id);
                if (p.id === 'tools') {
                    if (toolkit) pane.appendChild(toolkit);
                } else {
                    const grid = document.createElement('div');
                    grid.className = 'bento home-grid';
                    p.widgets.forEach(id => { const w = $(id); if (w) { if (FULL.has(id)) w.classList.add('home-full'); grid.appendChild(w); } });
                    pane.appendChild(grid);
                }
                panes.appendChild(pane);
            });
            // Desk presets re-order the widgets of the Today grid.
            if (oldBento) oldBento.removeAttribute('id');
            panes.querySelector('#home-pane-today .bento').id = 'home-bento';

            (search || home.firstElementChild).after(tabs);
            tabs.after(panes);

            // Retire the now-empty old sections ("At a glance", "Daily life").
            home.querySelectorAll(':scope > section').forEach(sec => {
                if (sec === toolkit || sec.id === 'home-guest' || sec.id === 'desk-sponsor' || sec.classList.contains('home-hero')) return;
                if (!sec.querySelector('.widget')) sec.remove();
            });

            // Guest card → compact strip that can be dismissed.
            const guest = $('home-guest');
            if (guest) {
                guest.classList.add('home-guest-strip');
                if (!guest.querySelector('.guest-x')) {
                    const x = document.createElement('button');
                    x.className = 'guest-x'; x.type = 'button'; x.setAttribute('aria-label', 'Dismiss'); x.textContent = '✕';
                    x.onclick = () => { try { localStorage.setItem('wdl_guest_dismissed', '1'); } catch (e) {} guest.hidden = true; guest.dataset.dismissed = '1'; };
                    guest.appendChild(x);
                }
                if (localStorage.getItem('wdl_guest_dismissed')) guest.dataset.dismissed = '1';
            }

            tabs.addEventListener('click', e => {
                const b = e.target.closest('[data-pane]');
                if (b) this.showHomePane(b.dataset.pane, true);
                if (e.target.closest('.home-customize')) this.openHomeCustomize();
            });
            tabs.addEventListener('keydown', e => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
                const ids = PANES.map(p => p.id);
                let i = ids.indexOf(this.homePane);
                i = e.key === 'Home' ? 0 : e.key === 'End' ? ids.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + ids.length) % ids.length;
                e.preventDefault();
                this.showHomePane(ids[i], true);
                $('home-tab-' + ids[i]).focus();
            });

            const saved = localStorage.getItem('wd_home_tab');
            this.showHomePane(PANES.some(p => p.id === saved) ? saved : 'today');
            this.applyHomeHidden();
            this._rebuildIcons();
        },

        showHomePane(id, user) {
            this.homePane = id;
            document.querySelectorAll('.home-pane').forEach(p => { p.hidden = p.dataset.pane !== id; });
            document.querySelectorAll('.home-tab').forEach(b => {
                const on = b.dataset.pane === id;
                b.classList.toggle('active', on);
                b.setAttribute('aria-selected', String(on));
                b.tabIndex = on ? 0 : -1;
            });
            if (user) try { localStorage.setItem('wd_home_tab', id); } catch (e) {}
            if (id === 'focus') this.renderWeekFocus();
            this._balanceHome();
        },

        // Hidden widgets (wd_home_hidden) and grid balance.
        applyHomeHidden() {
            const hidden = new Set(readLocal('wd_home_hidden', []));
            Object.keys(NAMES).forEach(id => { const w = $(id); if (w) w.classList.toggle('home-hidden', hidden.has(id)); });
            this._balanceHome();
        },
        // In a 2-column grid an odd number of visible widgets leaves a hole:
        // the last one stretches across instead.
        _balanceHome() {
            document.querySelectorAll('.home-grid').forEach(grid => {
                const vis = [...grid.children].filter(w => !w.hidden && !w.classList.contains('home-hidden') && !w.classList.contains('home-full'));
                vis.forEach(w => w.classList.remove('home-stretch'));
                const ordered = vis.sort((a, b) => (+a.style.order || 0) - (+b.style.order || 0));
                if (ordered.length % 2) ordered[ordered.length - 1].classList.add('home-stretch');
            });
        },

        openHomeCustomize() {
            const hidden = new Set(readLocal('wd_home_hidden', []));
            this.lifeModal('Customize your dashboard', `
                <p class="text-sm text-slate-500 mb-4">Choose what shows on each tab. Your choice syncs with your Desk.</p>
                ${PANES.filter(p => p.widgets.length).map(p => `
                    <div class="mb-4"><div class="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">${esc(p.label)}</div>
                    <div class="grid grid-cols-2 gap-2">${p.widgets.filter(id => NAMES[id]).map(id => `
                        <label class="hc-opt"><input type="checkbox" data-w="${id}" ${hidden.has(id) ? '' : 'checked'} class="w-4 h-4 accent-indigo-600"> ${esc(NAMES[id])}</label>`).join('')}
                    </div></div>`).join('')}
                <div class="flex gap-2 mt-2">
                    <button id="hc-done" class="${this._btnCls} flex-1">Done</button>
                    <button id="hc-reset" class="${this._ghostBtnCls}">Show all</button>
                </div>`, wrap => {
                const save = () => {
                    const off = [...wrap.querySelectorAll('[data-w]')].filter(c => !c.checked).map(c => c.dataset.w);
                    try { localStorage.setItem('wd_home_hidden', JSON.stringify(off)); } catch (e) {}
                    this.applyHomeHidden();
                };
                wrap.querySelectorAll('[data-w]').forEach(c => c.onchange = save);
                wrap.querySelector('#hc-done').onclick = () => this.closeLifeModal();
                wrap.querySelector('#hc-reset').onclick = () => { wrap.querySelectorAll('[data-w]').forEach(c => { c.checked = true; }); save(); };
            });
        },

        // The dashboard has its own quick-add, so the floating + hides there.
        switchTab(...args) {
            const r = orig.switchTab.apply(this, args);
            document.body.classList.toggle('on-dashboard', this.currentTab === 'dashboard');
            return r;
        },

        renderOnboarding() {
            orig.renderOnboarding.call(this);
            this._balanceHome();
        },

        // ─────────────────────────────────────────────────────────
        // Weekly focus report
        // ─────────────────────────────────────────────────────────
        _focusHistory() {
            const hist = readLocal('wd_focus_history', {});
            // Days closed with "Shut down day" fill in anything we missed.
            const log = readLocal('wd_daily_log', {});
            Object.entries(log).forEach(([d, e]) => { if (e && typeof e.focusMinutes === 'number' && !(d in hist)) hist[d] = e.focusMinutes; });
            if (this._trackFocus) hist[ymd(new Date())] = Math.max(hist[ymd(new Date())] || 0, this._trackFocus().minutes);
            return hist;
        },
        _saveFocusHistory() {
            if (!this._trackFocus) return;
            const hist = readLocal('wd_focus_history', {});
            const t = ymd(new Date()), m = this._trackFocus().minutes;
            if ((hist[t] || 0) === m) return;
            hist[t] = Math.max(hist[t] || 0, m);
            const keys = Object.keys(hist).sort();
            keys.slice(0, -60).forEach(k => delete hist[k]);
            try { localStorage.setItem('wd_focus_history', JSON.stringify(hist)); } catch (e) {}
        },
        renderWeekFocus() {
            const el = $('w-week');
            if (!el) return;
            const hist = this._focusHistory();
            const days = [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - 6 + i); return d; });
            const vals = days.map(d => hist[ymd(d)] || 0);
            const total = vals.reduce((a, b) => a + b, 0);
            const max = Math.max(25, ...vals);
            const best = vals.indexOf(Math.max(...vals));
            const streak = parseInt(localStorage.getItem('wd_ft_streak') || '0', 10) || 0;
            const fmt = m => m >= 60 ? `${Math.floor(m / 60)}h ${m % 60 ? (m % 60) + 'm' : ''}`.trim() : `${m}m`;
            el.innerHTML = `
                <div class="widget-head"><span class="widget-label text-violet-600 dark:text-violet-400">This week's focus</span>
                    <span class="text-xs font-bold text-slate-400">${streak ? `🔥 ${streak}-day streak` : ''}</span></div>
                <div class="wk-total"><b>${fmt(total)}</b><span>focused in the last 7 days${total && vals[best] ? ` · best: ${days[best].toLocaleDateString(undefined, { weekday: 'long' })}` : ''}</span></div>
                <div class="wk-bars" role="img" aria-label="Focus minutes for the last 7 days: ${vals.join(', ')}">
                    ${vals.map((v, i) => `<div class="wk-col${i === 6 ? ' today' : ''}" title="${esc(days[i].toLocaleDateString(undefined, { weekday: 'long' }))}: ${v} min">
                        <span class="wk-bar" style="height:${Math.max(4, Math.round(v / max * 100))}%"></span>
                        <span class="wk-day">${esc(days[i].toLocaleDateString(undefined, { weekday: 'narrow' }))}</span></div>`).join('')}
                </div>
                ${total ? '' : '<p class="text-xs text-slate-400 mt-2">Start a Pomodoro and your week fills in here.</p>'}`;
        },

        // ─────────────────────────────────────────────────────────
        // Quick capture (N anywhere, + on phones)
        // ─────────────────────────────────────────────────────────
        openQuickCapture(kind = 'task') {
            const kinds = [['task', '✅ Task'], ['note', '📝 Note'], ['snippet', '📋 Snippet']];
            this.lifeModal('Quick capture', `
                <div class="seg-big mb-3" role="radiogroup" aria-label="What to capture">${kinds.map(([k, l]) => `<button role="radio" data-k="${k}" aria-checked="${k === kind}" class="${k === kind ? 'on' : ''}">${l}</button>`).join('')}</div>
                <textarea id="qc-text" rows="3" maxlength="2000" class="${this._inputCls}" placeholder=""></textarea>
                <div id="qc-hint" class="text-xs text-slate-400 mt-2 min-h-[1rem]"></div>
                <div class="flex gap-2 mt-3"><button id="qc-save" class="${this._btnCls} flex-1">Save</button></div>
                <p class="text-[11px] text-slate-400 mt-3">Tip: press <kbd class="px-1 border rounded">N</kbd> anywhere to open this. <kbd class="px-1 border rounded">⌘/Ctrl</kbd>+<kbd class="px-1 border rounded">Enter</kbd> saves.</p>`, wrap => {
                let k = kind;
                const ta = wrap.querySelector('#qc-text'), hint = wrap.querySelector('#qc-hint');
                const ph = { task: 'Pay rent next friday 5pm', note: 'Jot down anything — it goes to your Scratchpad', snippet: 'Text or a link you paste often' };
                const setKind = nk => {
                    k = nk; ta.placeholder = ph[k]; hint.textContent = '';
                    wrap.querySelectorAll('[data-k]').forEach(b => { const on = b.dataset.k === k; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
                    ta.focus();
                };
                setKind(k);
                wrap.querySelectorAll('[data-k]').forEach(b => b.onclick = () => setKind(b.dataset.k));
                let parseT;
                ta.oninput = () => {
                    if (k !== 'task' || !this.smartParse) return;
                    clearTimeout(parseT);
                    parseT = setTimeout(async () => {
                        let p = null;
                        try { p = await this.smartParse(ta.value); } catch (e) { return; }
                        hint.textContent = p && p.date ? `📅 ${p.title} — ${new Date(p.date + 'T' + (p.time || '12:00')).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}${p.time ? ' ' + p.time : ''}` : '';
                    }, 200);
                };
                const save = async () => {
                    const v = ta.value.trim();
                    if (!v) { ta.focus(); return; }
                    if (k === 'task') {
                        let p = { title: v };
                        try { if (this.smartParse) p = (await this.smartParse(v)) || p; } catch (e) { /* date parser unavailable: save as typed */ }
                        this.tasks.push({ text: p.title || v, time: p.time || '', date: p.date || '', done: false, id: this._taskId ? this._taskId() : Date.now() });
                        this.renderTasks();
                        this.showToast('✅ Task added');
                    } else if (k === 'note') {
                        const area = $('note-area');
                        const cur = localStorage.getItem('wd_scratch') || '';
                        const stamp = new Date().toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
                        const next = (cur ? cur.replace(/\s+$/, '') + '\n\n' : '') + `— ${stamp}\n${v}`;
                        localStorage.setItem('wd_scratch', next);
                        if (area) area.value = next;
                        if (this.updateNotePreview) this.updateNotePreview();
                        this.showToast('📝 Added to your Scratchpad');
                    } else {
                        const all = readLocal('wd_snippets', []);
                        all.unshift({ id: 's-' + Date.now().toString(36), label: v.split('\n')[0].slice(0, 40), text: v, uses: 0, at: Date.now() });
                        localStorage.setItem('wd_snippets', JSON.stringify(all.slice(0, 200)));
                        if (this.renderSnippets) this.renderSnippets();
                        this.showToast('📋 Snippet saved');
                    }
                    this.closeLifeModal();
                };
                wrap.querySelector('#qc-save').onclick = save;
                ta.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey || (k === 'task' && !e.shiftKey))) { e.preventDefault(); save(); } });
            });
        },

        _paletteItems: (base => function () {
            return base.call(this).concat([
                { id: 'act-capture', label: 'Quick capture (task, note or snippet)', icon: 'plus-circle', keywords: 'quick add capture new task note snippet inbox', sub: 'Action · N', run: () => this.openQuickCapture() },
                { id: 'act-home-customize', label: 'Customize the dashboard', icon: 'sliders-horizontal', keywords: 'dashboard widgets hide show layout customize home', sub: 'Action', run: () => { this.switchTab('dashboard'); this.openHomeCustomize(); } }
            ]);
        })(app._paletteItems),

        init() {
            orig.init.call(this);
            this._buildHome();
            this.renderWeekFocus();
            document.body.classList.toggle('on-dashboard', this.currentTab === 'dashboard');
            setInterval(() => {
                if (document.hidden) return;
                this._saveFocusHistory();
                if (this.currentTab === 'dashboard' && this.homePane === 'focus') this.renderWeekFocus();
            }, 60 * 1000);
            window.addEventListener('pagehide', () => this._saveFocusHistory());

            // N = quick capture (not while typing, not with modifiers, not over another dialog).
            document.addEventListener('keydown', e => {
                if ((e.key !== 'n' && e.key !== 'N') || e.metaKey || e.ctrlKey || e.altKey) return;
                const a = document.activeElement;
                if (a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) return;
                if (this._cmdkOpen || document.querySelector('#life-modal.flex')) return;
                e.preventDefault();
                this.openQuickCapture();
            });
            // Phones: a floating + button above the bottom bar.
            if (!$('quick-capture-fab')) {
                const fab = document.createElement('button');
                fab.id = 'quick-capture-fab';
                fab.type = 'button';
                fab.setAttribute('aria-label', 'Quick capture: add a task, note or snippet');
                fab.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
                fab.onclick = () => this.openQuickCapture();
                document.body.appendChild(fab);
            }
        }
    });

    const css = document.createElement('style');
    css.id = 'wd-home-tabs';
    css.textContent = `
        /* Compact hero: the tabs below carry the rest. */
        .home-hero { padding: 2rem 2.25rem 1.75rem; }
        .home-hero .hero-title { font-size: clamp(1.9rem, 4.2vw, 3rem); }
        .home-hero .hero-focus { margin-top: 1.25rem; }
        @media (max-width: 767px) { .home-hero { padding: 1.35rem 1.15rem 1.25rem; } }
        .home > .home-search { margin-top: 1.25rem; }

        .home-tabs { position: sticky; top: -1.5rem; z-index: 25; display: flex; align-items: center; gap: .35rem; margin-top: 1.25rem !important;
            padding: .35rem; border-radius: 1.1rem; background: var(--surface); border: 1px solid var(--border); box-shadow: var(--shadow-card);
            overflow-x: auto; scrollbar-width: none; }
        .home-tabs::-webkit-scrollbar { display: none; }
        @media (max-width: 767px) { .home-tabs { top: -1rem; } }
        .home-tab { display: inline-flex; align-items: center; gap: .45rem; padding: .6rem 1rem; border-radius: .8rem; font-weight: 700; font-size: .9rem; color: var(--muted); white-space: nowrap; flex-shrink: 0; transition: background .15s, color .15s; }
        .home-tab:hover { color: var(--text); background: var(--bg); }
        .home-tab.active { background: var(--accent); color: #fff; box-shadow: 0 6px 16px -8px var(--accent); }
        .home-customize { margin-left: auto; display: inline-flex; align-items: center; gap: .35rem; padding: .55rem .8rem; border-radius: .8rem; font-weight: 700; font-size: .8rem; color: var(--muted); flex-shrink: 0; }
        .home-customize:hover { color: var(--accent); background: var(--bg); }
        @media (max-width: 480px) { .home-customize span { display: none; } }
        /* Phones: four equal tabs that always fit, plus the customize icon. */
        @media (max-width: 639px) {
            .home-tabs { gap: .2rem; padding: .3rem; }
            .home-tab { flex: 1 1 0; justify-content: center; padding: .6rem .3rem; font-size: .84rem; gap: .3rem; min-width: 0; }
            .home-customize { margin-left: 0; padding: .55rem .5rem; }
        }
        @media (max-width: 400px) { .home-tab svg, .home-tab i { display: none; } }
        #home-panes { margin-top: 1.1rem !important; }
        .home-pane[hidden] { display: none !important; }
        .home-pane { animation: home-in .22s ease both; }
        @keyframes home-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) { .home-pane { animation: none; } }

        /* Two even columns per tab; widgets stretch to equal heights per row. */
        .home-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 1rem; grid-auto-flow: row dense; align-items: stretch; }
        .home-grid > * { grid-column: auto !important; }
        .home-grid > .home-full, .home-grid > .home-stretch { grid-column: 1 / -1 !important; }
        .home-grid > .home-hidden, .home-grid > [hidden] { display: none !important; }
        @media (max-width: 767px) { .home-grid { grid-template-columns: minmax(0, 1fr) !important; gap: .85rem; } }
        .home-grid .widget { display: flex; flex-direction: column; }
        #home-pane-tools > section { margin: 0; }
        #w-agenda .agenda { grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr)); }

        /* Guest card → slim strip. */
        .home-guest-strip { position: relative; padding: 1.25rem 3rem 1.25rem 1.5rem !important; border-radius: 1.4rem !important; }
        .home-guest-strip h2 { font-size: 1.25rem !important; margin-bottom: .25rem !important; }
        .home-guest-strip p { margin-bottom: .75rem !important; font-size: .9rem; }
        .home-guest-strip ul { display: none !important; }
        .home-guest-strip > .grid { display: block !important; }
        .home-guest-strip[data-dismissed] { display: none !important; }
        .guest-x { position: absolute; top: .8rem; right: .9rem; width: 2rem; height: 2rem; border-radius: .7rem; color: var(--muted); }
        .guest-x:hover { background: var(--bg); color: var(--text); }

        .hc-opt { display: flex; align-items: center; gap: .5rem; padding: .55rem .7rem; border-radius: .8rem; border: 1px solid var(--border, #e5e7eb); font-size: .85rem; font-weight: 600; cursor: pointer; }

        /* Weekly focus report */
        .wk-total b { display: block; font-size: 2rem; font-weight: 900; letter-spacing: -.02em; color: #7c3aed; line-height: 1.1; }
        .dark .wk-total b { color: #a78bfa; }
        .wk-total span { font-size: .78rem; color: var(--muted); }
        .wk-bars { display: grid; grid-template-columns: repeat(7, 1fr); gap: .45rem; align-items: end; height: 7.5rem; margin-top: auto; padding-top: 1rem; }
        .wk-col { display: flex; flex-direction: column; align-items: center; gap: .3rem; height: 100%; justify-content: flex-end; }
        .wk-bar { width: 100%; max-width: 2.2rem; border-radius: .5rem .5rem .25rem .25rem; background: linear-gradient(180deg, #a78bfa, #7c3aed); opacity: .55; }
        .wk-col.today .wk-bar { opacity: 1; box-shadow: 0 6px 14px -6px #7c3aed; }
        .wk-day { font-size: .68rem; font-weight: 700; color: var(--muted); }

        /* Quick capture */
        .seg-big { display: grid; grid-template-columns: repeat(3, 1fr); gap: .35rem; padding: .25rem; border-radius: .9rem; background: rgba(148,163,184,.12); }
        .seg-big button { padding: .5rem; border-radius: .7rem; font-weight: 700; font-size: .85rem; }
        .seg-big button.on { background: var(--surface, #fff); box-shadow: 0 1px 3px rgba(0,0,0,.1); }
        #quick-capture-fab { display: none; }
        @media (max-width: 767px) {
            #quick-capture-fab { display: grid; place-items: center; position: fixed; right: 1rem; bottom: calc(6.1rem + env(safe-area-inset-bottom, 0px)); z-index: 55;
                width: 3.4rem; height: 3.4rem; border-radius: 1.2rem; color: #fff; background: linear-gradient(135deg, #4f46e5, #7c3aed); box-shadow: 0 14px 30px -10px rgba(79,70,229,.8); }
            #quick-capture-fab:active { transform: scale(.94); }
            .zen-mode #quick-capture-fab, body.focus-lock #quick-capture-fab, body.on-dashboard #quick-capture-fab { display: none; }
        }
    `;
    document.head.appendChild(css);
})();

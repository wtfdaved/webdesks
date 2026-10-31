// ═══════════════════════════════════════════════════════════════
// DESKS — dashboard upgrades layered on top of `app`.
//
//  1. Onboarding        — new visitors get three interactive "get started"
//                         steps instead of empty 0 / 0 and --:-- widgets.
//  2. Desk presets      — Developer / Student / Remote Work: one click
//                         trims the sidebar and re-orders the dashboard.
//  3. Brief & shutdown  — morning brief, then "Shut down day": roll
//                         unfinished tasks to tomorrow, log focus minutes
//                         (Supabase `daily_logs` when signed in) and copy
//                         a standup summary.
//  4. Launchers         — Quick Actions folders that open a set of URLs,
//                         start a Sounds mix and open a tool in one click.
//  5. Daily life        — Snippet vault, subscriptions & quick expenses,
//                         read-only calendar agenda from an .ics link.
// ═══════════════════════════════════════════════════════════════

(() => {
    const pad = n => String(n).padStart(2, '0');
    const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const today = () => ymd(new Date());
    const addDays = (s, n) => { const d = new Date(s + 'T12:00'); d.setDate(d.getDate() + n); return ymd(d); };
    const esc = s => app.escapeHtml(String(s ?? ''));
    const readLocal = (k, fb) => { try { return JSON.parse(localStorage.getItem(k)) ?? fb; } catch (e) { return fb; } };
    const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { app.showToast('Storage is full — couldn\'t save'); } };
    const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const $ = id => document.getElementById(id);
    const dayLabel = s => s === today() ? 'Today' : s === addDays(today(), 1) ? 'Tomorrow'
        : new Date(s + 'T12:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    const timeLabel = d => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

    const orig = {
        init: app.init,
        switchTab: app.switchTab,
        openPalette: app.openPalette,
        toggleTimer: app.toggleTimer,
        toggleTask: app.toggleTask,
        updateTaskProgress: app.updateTaskProgress,
        updateAlarmUI: app.updateAlarmUI,
        renderLifeDashCard: app.renderLifeDashCard,
        renderAccountButton: app.renderAccountButton,
        paletteItems: app._paletteItems,
        renderWater: app.renderWater,
        lifeMorningRedirect: app.lifeMorningRedirect
    };

    // ── Desk presets ──────────────────────────────────────────────
    // Core tools stay in the sidebar whatever the preset.
    const CORE = ['dashboard', 'today', 'calendar', 'tasks'];
    const PRESETS = {
        all: { name: 'All tools', emoji: '🧰', tools: null, order: null },
        dev: {
            name: 'Developer', emoji: '💻', blurb: 'Dev Toolkit, code Scratchpad, Pomodoro',
            tools: ['devtools', 'scratchpad', 'timer', 'board', 'colorpicker', 'ocr', 'audio'],
            order: ['w-spotlight', 'w-timer', 'w-note', 'w-tasks', 'w-quick', 'w-alarm', 'w-mood', 'w-water', 'w-quote']
        },
        student: {
            name: 'Student', emoji: '🎓', blurb: 'Focus Town, Audio Mixer, Hydration',
            tools: ['focustown', 'audio', 'timer', 'pages', 'whiteboard', 'calculator', 'breathing', 'converter'],
            order: ['w-spotlight', 'w-water', 'w-timer', 'w-tasks', 'w-mood', 'w-note', 'w-quick', 'w-alarm', 'w-quote']
        },
        remote: {
            name: 'Remote Work', emoji: '🏠', blurb: 'World Clock, On Air sign, Kanban',
            tools: ['zones', 'onair', 'board', 'clock', 'recorder', 'audio', 'timer', 'scratchpad'],
            order: ['w-spotlight', 'w-tasks', 'w-alarm', 'w-quick', 'w-timer', 'w-note', 'w-mood', 'w-water', 'w-quote']
        }
    };

    // ── Onboarding steps ──────────────────────────────────────────
    const STEPS = [
        { id: 'palette', icon: '⌘', title: 'Try pressing ⌘K', sub: 'Jump to any tool, task or page', cta: 'Open', run: () => app.openPalette() },
        { id: 'pomodoro', icon: '🍅', title: 'Start a 25m Pomodoro', sub: 'Your town earns 4× coins while you focus', cta: 'Start', run: () => app.startPomodoro() },
        { id: 'profile', icon: '☁️', title: 'Save your Desk to your profile', sub: 'Free account · sync everywhere · no ads', cta: 'Save', run: () => { location.href = '/login?mode=signup'; } }
    ];

    // ── Launchers ─────────────────────────────────────────────────
    const DEFAULT_LAUNCHERS = [
        { id: 'l-morning', name: 'Morning Routine', emoji: '🌅', urls: ['https://mail.google.com', 'https://calendar.google.com', 'https://news.google.com'], mix: 'forest', tab: 'today', focus: false },
        { id: 'l-client', name: 'Client Work', emoji: '💼', urls: ['https://docs.google.com', 'https://drive.google.com'], mix: 'rainycafe', tab: 'board', focus: false },
        { id: 'l-deep', name: 'Deep Work', emoji: '🎧', urls: [], mix: 'focus', tab: 'timer', focus: true }
    ];

    // ── Money ─────────────────────────────────────────────────────
    const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'INR', 'JPY', 'NZD', 'CHF', 'SEK', 'BRL', 'MXN', 'ZAR', 'SGD'];
    const CYCLES = { weekly: { label: 'week', perMonth: 52 / 12 }, monthly: { label: 'month', perMonth: 1 }, quarterly: { label: 'quarter', perMonth: 1 / 3 }, yearly: { label: 'year', perMonth: 1 / 12 } };
    const advance = (date, cycle) => {
        const d = new Date(date + 'T12:00');
        if (cycle === 'weekly') d.setDate(d.getDate() + 7);
        else if (cycle === 'quarterly') d.setMonth(d.getMonth() + 3);
        else if (cycle === 'yearly') d.setFullYear(d.getFullYear() + 1);
        else d.setMonth(d.getMonth() + 1);
        return ymd(d);
    };
    // The next renewal on or after today.
    const nextRenewal = sub => {
        let d = sub.next || today();
        for (let i = 0; d < today() && i < 600; i++) d = advance(d, sub.cycle);
        return d;
    };

    // ═════════════════════════════════════════════════════════════
    // .ics parsing — RFC 5545 subset: VEVENT, all-day and timed (UTC,
    // TZID or floating), RRULE (DAILY/WEEKLY/MONTHLY/YEARLY with
    // INTERVAL, COUNT, UNTIL, BYDAY, BYMONTHDAY), EXDATE, RECURRENCE-ID.
    // ═════════════════════════════════════════════════════════════
    const WIN_TZ = {
        'Pacific Standard Time': 'America/Los_Angeles', 'Mountain Standard Time': 'America/Denver', 'Central Standard Time': 'America/Chicago',
        'Eastern Standard Time': 'America/New_York', 'Atlantic Standard Time': 'America/Halifax', 'Alaskan Standard Time': 'America/Anchorage',
        'Hawaiian Standard Time': 'Pacific/Honolulu', 'GMT Standard Time': 'Europe/London', 'Greenwich Standard Time': 'Atlantic/Reykjavik',
        'W. Europe Standard Time': 'Europe/Berlin', 'Romance Standard Time': 'Europe/Paris', 'Central Europe Standard Time': 'Europe/Budapest',
        'Central European Standard Time': 'Europe/Warsaw', 'E. Europe Standard Time': 'Europe/Bucharest', 'FLE Standard Time': 'Europe/Kiev',
        'India Standard Time': 'Asia/Kolkata', 'China Standard Time': 'Asia/Shanghai', 'Tokyo Standard Time': 'Asia/Tokyo',
        'Singapore Standard Time': 'Asia/Singapore', 'AUS Eastern Standard Time': 'Australia/Sydney', 'New Zealand Standard Time': 'Pacific/Auckland',
        'UTC': 'UTC', 'Arabian Standard Time': 'Asia/Dubai', 'Russian Standard Time': 'Europe/Moscow', 'E. South America Standard Time': 'America/Sao_Paulo'
    };
    const dtfCache = {};
    const tzOffset = (tz, ms) => {
        const f = dtfCache[tz] || (dtfCache[tz] = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }));
        const p = {};
        f.formatToParts(new Date(ms)).forEach(x => { p[x.type] = x.value; });
        return Date.UTC(+p.year, p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - ms;
    };
    // Wall-clock time in `tz` → Date. Floating (no tz) = this device's local time.
    const wallToDate = (w, tz) => {
        if (!tz) return new Date(w.y, w.mo, w.d, w.h, w.mi, w.s);
        if (tz === 'UTC') return new Date(Date.UTC(w.y, w.mo, w.d, w.h, w.mi, w.s));
        const zone = WIN_TZ[tz] || tz.replace(/^\/+/, '').replace(/^.*?(?=[A-Z][a-z]+\/)/, '');
        try {
            const guess = Date.UTC(w.y, w.mo, w.d, w.h, w.mi, w.s);
            let t = guess - tzOffset(zone, guess);
            t = guess - tzOffset(zone, t);
            return new Date(t);
        } catch (e) {
            return new Date(w.y, w.mo, w.d, w.h, w.mi, w.s);
        }
    };
    const parseDT = (value, params) => {
        const m = String(value).trim().match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
        if (!m) return null;
        const w = { y: +m[1], mo: m[2] - 1, d: +m[3], h: +(m[4] || 0), mi: +(m[5] || 0), s: +(m[6] || 0) };
        const allDay = !m[4] || params.VALUE === 'DATE';
        const tz = m[7] ? 'UTC' : (params.TZID || '');
        return { w, allDay, tz };
    };
    const unescapeText = v => String(v || '').replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1').trim();

    function parseICS(text) {
        const lines = String(text).replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n');
        const events = [];
        let cur = null, depth = 0;
        for (const line of lines) {
            if (/^BEGIN:VEVENT/i.test(line)) { cur = { props: {}, exdates: [] }; depth = 0; continue; }
            if (!cur) continue;
            if (/^BEGIN:/i.test(line)) { depth++; continue; } // VALARM etc.
            if (/^END:VEVENT/i.test(line)) { events.push(cur); cur = null; continue; }
            if (/^END:/i.test(line)) { depth--; continue; }
            if (depth > 0) continue;
            // NAME;PARAM=a;PARAM="b:c":VALUE — find the first colon outside quotes.
            let q = false, cut = -1;
            for (let i = 0; i < line.length; i++) {
                if (line[i] === '"') q = !q;
                else if (line[i] === ':' && !q) { cut = i; break; }
            }
            if (cut < 0) continue;
            const [rawName, ...rawParams] = line.slice(0, cut).split(';');
            const name = rawName.toUpperCase();
            const params = {};
            rawParams.forEach(p => { const i = p.indexOf('='); if (i > 0) params[p.slice(0, i).toUpperCase()] = p.slice(i + 1).replace(/^"|"$/g, ''); });
            const value = line.slice(cut + 1);
            if (name === 'EXDATE') value.split(',').forEach(v => { const d = parseDT(v, params); if (d) cur.exdates.push(d); });
            else cur.props[name] = { value, params };
        }
        return events.map(e => {
            const P = e.props;
            const start = P.DTSTART && parseDT(P.DTSTART.value, P.DTSTART.params);
            if (!start) return null;
            if (P.STATUS && /CANCELLED/i.test(P.STATUS.value)) return null;
            const end = P.DTEND && parseDT(P.DTEND.value, P.DTEND.params);
            let durMs = 0;
            if (end) durMs = toDate(end) - toDate(start);
            else if (P.DURATION) {
                const m = P.DURATION.value.match(/P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?/);
                if (m) durMs = ((+m[1] || 0) * 7 * 86400 + (+m[2] || 0) * 86400 + (+m[3] || 0) * 3600 + (+m[4] || 0) * 60 + (+m[5] || 0)) * 1000;
            } else if (start.allDay) durMs = 86400000;
            const rid = P['RECURRENCE-ID'] && parseDT(P['RECURRENCE-ID'].value, P['RECURRENCE-ID'].params);
            return {
                uid: P.UID ? P.UID.value : uid(),
                title: unescapeText(P.SUMMARY && P.SUMMARY.value) || '(No title)',
                location: unescapeText(P.LOCATION && P.LOCATION.value),
                start, durMs: Math.max(0, durMs),
                rrule: P.RRULE ? Object.fromEntries(P.RRULE.value.split(';').map(kv => kv.split('=')).map(([k, v]) => [String(k).toUpperCase(), v])) : null,
                exdates: e.exdates,
                rid
            };
        }).filter(Boolean);
    }
    function toDate(dt) { return dt.allDay ? new Date(dt.w.y, dt.w.mo, dt.w.d) : wallToDate(dt.w, dt.tz); }

    const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
    // Occurrences of `ev` overlapping [from, to).
    function occurrences(ev, from, to) {
        const out = [];
        const s0 = ev.start;
        const key = dt => dt.allDay ? `${dt.w.y}-${dt.w.mo}-${dt.w.d}` : String(toDate(dt).getTime());
        const ex = new Set(ev.exdates.map(d => d.allDay || s0.allDay ? `${d.w.y}-${d.w.mo}-${d.w.d}` : String(toDate(d).getTime())));
        const push = w => {
            const dt = { w, allDay: s0.allDay, tz: s0.tz };
            if (ex.has(key(dt)) || (ev._skip && ev._skip.has(key(dt)))) return;
            const st = toDate(dt), en = new Date(st.getTime() + ev.durMs);
            if (en > from && st < to) out.push({ start: st, end: en, allDay: s0.allDay, title: ev.title, location: ev.location });
        };
        if (!ev.rrule) { push(s0.w); return out; }

        const r = ev.rrule;
        const freq = (r.FREQ || '').toUpperCase();
        const interval = Math.max(1, parseInt(r.INTERVAL, 10) || 1);
        const count = parseInt(r.COUNT, 10) || 0;
        const until = r.UNTIL ? toDate(parseDT(r.UNTIL, {}) || s0) : null;
        const byday = r.BYDAY ? r.BYDAY.split(',').map(x => { const m = x.match(/^([+-]?\d+)?([A-Z]{2})$/); return m ? { n: m[1] ? +m[1] : 0, wd: DAYS.indexOf(m[2]) } : null; }).filter(Boolean) : [];
        const bymd = r.BYMONTHDAY ? r.BYMONTHDAY.split(',').map(Number) : [];
        const w0 = s0.w;
        const base = new Date(w0.y, w0.mo, w0.d);
        const withDay = d => ({ ...w0, y: d.getFullYear(), mo: d.getMonth(), d: d.getDate() });
        const unitDays = { DAILY: 1, WEEKLY: 7 }[freq];

        // Without COUNT, skip whole periods that end before the window.
        let n = 0;
        if (!count) {
            const daysToFrom = Math.floor((from - base) / 86400000) - Math.ceil(ev.durMs / 86400000) - 7;
            if (daysToFrom > 0) {
                if (unitDays) n = Math.floor(daysToFrom / (unitDays * interval));
                else if (freq === 'MONTHLY') n = Math.floor(daysToFrom / 31 / interval);
                else if (freq === 'YEARLY') n = Math.floor(daysToFrom / 366 / interval);
            }
        }
        let emitted = 0;
        for (let guard = 0; guard < 3000; guard++, n++) {
            let cands = [];
            if (freq === 'DAILY') {
                const d = new Date(base); d.setDate(d.getDate() + n * interval); cands = [d];
            } else if (freq === 'WEEKLY') {
                const ws = new Date(base); ws.setDate(ws.getDate() - ws.getDay() + n * 7 * interval);
                const wds = byday.length ? byday.map(b => b.wd) : [base.getDay()];
                cands = wds.sort((a, b) => a - b).map(wd => { const d = new Date(ws); d.setDate(d.getDate() + wd); return d; });
            } else if (freq === 'MONTHLY') {
                const y = base.getFullYear(), mo = base.getMonth() + n * interval;
                const first = new Date(y, mo, 1), dim = new Date(y, mo + 1, 0).getDate();
                if (byday.length) {
                    byday.forEach(b => {
                        const all = [];
                        for (let d = 1; d <= dim; d++) { const x = new Date(first.getFullYear(), first.getMonth(), d); if (x.getDay() === b.wd) all.push(x); }
                        if (!b.n) cands.push(...all);
                        else { const x = b.n > 0 ? all[b.n - 1] : all[all.length + b.n]; if (x) cands.push(x); }
                    });
                } else {
                    (bymd.length ? bymd : [base.getDate()]).forEach(md => {
                        const d = md < 0 ? dim + md + 1 : md;
                        if (d >= 1 && d <= dim) cands.push(new Date(first.getFullYear(), first.getMonth(), d));
                    });
                }
                cands.sort((a, b) => a - b);
            } else if (freq === 'YEARLY') {
                const d = new Date(base); d.setFullYear(base.getFullYear() + n * interval);
                if (d.getMonth() === base.getMonth()) cands = [d];
            } else { push(w0); break; }

            let past = false;
            for (const d of cands) {
                if (d < base) continue;
                const w = withDay(d);
                const st = toDate({ w, allDay: s0.allDay, tz: s0.tz });
                if (until && st > until) { past = true; break; }
                if (count && emitted >= count) { past = true; break; }
                emitted++;
                if (st >= to) { past = true; break; }
                push(w);
            }
            if (past) break;
        }
        return out;
    }

    function agendaFrom(text, from, to) {
        const evs = parseICS(text);
        // RECURRENCE-ID entries replace that one instance of their series.
        const overrides = {};
        evs.filter(e => e.rid).forEach(e => {
            (overrides[e.uid] = overrides[e.uid] || new Set()).add(e.rid.allDay ? `${e.rid.w.y}-${e.rid.w.mo}-${e.rid.w.d}` : String(toDate(e.rid).getTime()));
        });
        const out = [];
        evs.forEach(e => {
            if (!e.rid && overrides[e.uid]) e._skip = overrides[e.uid];
            if (e.rid) e.rrule = null;
            try { out.push(...occurrences(e, from, to)); } catch (err) { /* one bad event shouldn't sink the feed */ }
        });
        return out.sort((a, b) => (a.start - b.start) || (b.allDay - a.allDay));
    }

    // ═════════════════════════════════════════════════════════════
    Object.assign(app, {
        _parseICS: parseICS,
        _agendaFrom: agendaFrom,

        // ─────────────────────────────────────────────────────────
        // 1. ONBOARDING
        // ─────────────────────────────────────────────────────────
        _onboard: null,
        _onboardState() {
            if (this._onboard) return this._onboard;
            let st = readLocal('wd_onboard', null);
            if (!st || typeof st !== 'object') {
                // Only brand-new visitors see it; anyone with history skips it.
                const returning = this.tasks.length > 0 || parseInt(localStorage.getItem('wd_total_min') || '0', 10) > 0 || !!localStorage.getItem('wd_scratch');
                st = { done: {}, hidden: returning, fresh: true };
            }
            st.done = st.done || {};
            this._onboard = st;
            return st;
        },
        _onboardActive() {
            const st = this._onboardState();
            return !st.hidden && STEPS.some(s => !st.done[s.id]);
        },
        onboardMark(id) {
            const st = this._onboardState();
            if (st.hidden || st.done[id]) return;
            st.done[id] = Date.now();
            delete st.fresh;
            save('wd_onboard', st);
            const left = STEPS.filter(s => !st.done[s.id]).length;
            if (!left) {
                this.showToast('🎉 You\'re all set — welcome to WebDesks!');
                if (this._celebrate) try { this._celebrate(); } catch (e) {}
            }
            this.renderOnboarding();
        },
        onboardDismiss() {
            const st = this._onboardState();
            st.hidden = true;
            delete st.fresh;
            save('wd_onboard', st);
            this.renderOnboarding();
        },
        // A brand-new visitor lands on the Dashboard checklist, not the Today check-in.
        lifeMorningRedirect() {
            if (!localStorage.getItem('wd_today_opened') && this._onboardActive()) {
                try { localStorage.setItem('wd_today_opened', today()); } catch (e) {}
                return;
            }
            return orig.lifeMorningRedirect && orig.lifeMorningRedirect.call(this);
        },
        startPomodoro() {
            if (this.setTimerMode && !this.timerRunning) this.setTimerMode(25);
            this.switchTab('timer');
            if (!this.timerRunning) this.toggleTimer();
        },
        renderOnboarding() {
            const el = $('onboard-steps');
            if (!el) return;
            const active = this._onboardActive();
            const st = this._onboardState();
            const alarm = $('w-alarm');
            // The empty alarm card makes way for the checklist while it's showing.
            if (alarm) alarm.hidden = active && !this.alarmTime;
            const water = $('w-water');
            if (water) water.classList.toggle('wd-wide', !!(alarm && alarm.hidden));
            const label = $('w-tasks-label');
            if (label) label.textContent = active && !this.tasks.length ? 'Get started' : 'Today\'s tasks';
            if (!active) { el.innerHTML = ''; this.updateTaskProgress(); return; }
            el.innerHTML = `
                <div class="onboard">
                    ${STEPS.map((s, i) => {
                        const done = !!st.done[s.id];
                        return `<div class="onboard-step${done ? ' done' : ''}">
                            <span class="onboard-num">${done ? '✓' : i + 1}</span>
                            <span class="min-w-0 flex-1"><span class="block font-bold text-sm">${esc(s.title)}</span><span class="block text-xs text-slate-400">${esc(s.sub)}</span></span>
                            ${done ? '<span class="text-xs font-bold text-emerald-500">Done</span>' : `<button class="onboard-cta" data-step="${s.id}">${esc(s.cta)}</button>`}
                        </div>`;
                    }).join('')}
                    <button class="onboard-skip" onclick="app.onboardDismiss()">Hide these tips</button>
                </div>`;
            el.querySelectorAll('[data-step]').forEach(b => b.onclick = () => STEPS.find(s => s.id === b.dataset.step).run());
            this.updateTaskProgress();
        },

        updateTaskProgress() {
            orig.updateTaskProgress.call(this);
            const label = $('task-progress-label'), bar = $('task-progress-bar');
            if (!label || this.tasks.length) return;
            if (this._onboard && this._onboardActive()) {
                const n = STEPS.filter(s => this._onboard.done[s.id]).length;
                label.textContent = `${n} / ${STEPS.length} done`;
                if (bar) bar.style.width = Math.round(n / STEPS.length * 100) + '%';
            } else {
                label.textContent = 'All clear';
            }
        },

        updateAlarmUI() {
            orig.updateAlarmUI.call(this);
            const status = $('dash-alarm-status'), hint = $('dash-alarm-hint');
            if (status && !this.alarmTime) status.textContent = 'Not set';
            if (hint) hint.textContent = this.alarmTime ? 'Tap to change' : 'Tap to set an alarm';
            if (this._onboard) this.renderOnboarding();
        },

        openPalette(prefill) {
            orig.openPalette.call(this, prefill);
            this.onboardMark('palette');
        },

        toggleTimer() {
            orig.toggleTimer.call(this);
            if (this.timerRunning) this.onboardMark('pomodoro');
            this._trackFocus();
        },

        // Stamp the day a task was finished so the shutdown summary knows.
        toggleTask(index) {
            orig.toggleTask.call(this, index);
            const t = this.tasks[index];
            if (!t) return;
            if (t.done && !t.doneOn) t.doneOn = today();
            if (!t.done) delete t.doneOn;
            localStorage.setItem('wd_tasks', JSON.stringify(this.tasks));
        },

        renderAccountButton() {
            orig.renderAccountButton.call(this);
            if (this.account) {
                this.onboardMark('profile');
                window.wdAds && wdAds.disable();
            }
        },

        // ─────────────────────────────────────────────────────────
        // 2. DESK PRESETS
        // ─────────────────────────────────────────────────────────
        deskPreset: 'all',
        _toolkitHtml: '',
        setDeskPreset(id, quiet) {
            if (!PRESETS[id]) id = 'all';
            this.deskPreset = id;
            try { localStorage.setItem('wd_desk_preset', id); } catch (e) {}
            this.applyDeskPreset();
            if (!quiet) this.showToast(id === 'all' ? '🧰 Showing all tools' : `${PRESETS[id].emoji} ${PRESETS[id].name} Desk — ${PRESETS[id].blurb}`);
        },
        applyDeskPreset() {
            const id = this.deskPreset;
            const p = PRESETS[id];
            const allowed = p.tools ? new Set(CORE.concat(p.tools)) : null;
            const showAll = !!this._navShowAll;

            // Preset picker
            const bar = $('desk-presets');
            if (bar) {
                bar.innerHTML = Object.entries(PRESETS).map(([k, v]) => `
                    <button role="radio" aria-checked="${k === id}" class="desk-chip${k === id ? ' active' : ''}" data-preset="${k}" title="${esc(v.blurb || 'Every tool in the sidebar')}">
                        <span aria-hidden="true">${v.emoji}</span> ${esc(v.name)}${k === 'all' ? '' : ' Desk'}
                    </button>`).join('');
                bar.querySelectorAll('[data-preset]').forEach(b => b.onclick = () => this.setDeskPreset(b.dataset.preset));
            }

            // Sidebar
            const nav = document.querySelector('aside nav');
            if (nav) {
                nav.classList.toggle('preset-on', !!allowed && !showAll);
                nav.querySelectorAll('.nav-btn').forEach(btn => {
                    const tab = btn.dataset.tab || btn.dataset.link;
                    const hide = !!allowed && !showAll && !allowed.has(tab) && tab !== this.currentTab;
                    btn.classList.toggle('preset-hidden', hide);
                });
                nav.querySelectorAll('.nav-group').forEach(g => {
                    const visible = [...g.querySelectorAll('.nav-btn')].filter(b => !b.classList.contains('preset-hidden'));
                    g.classList.toggle('preset-empty', !visible.length);
                    const c = g.querySelector('.nav-group-head .count');
                    if (c) c.textContent = visible.length;
                });
                let more = $('nav-preset-toggle');
                if (allowed) {
                    if (!more) {
                        more = document.createElement('button');
                        more.id = 'nav-preset-toggle';
                        more.type = 'button';
                        more.className = 'nav-preset-toggle';
                        more.onclick = () => { this._navShowAll = !this._navShowAll; this.applyDeskPreset(); };
                        nav.appendChild(more);
                    }
                    more.hidden = false;
                    more.innerHTML = showAll
                        ? `<span>Only ${esc(p.name)} tools</span>`
                        : `<span>${p.emoji} ${esc(p.name)} Desk · show all</span>`;
                } else if (more) more.hidden = true;
            }

            // Dashboard toolkit tiles
            const grid = $('home-toolkit');
            if (grid) {
                if (!this._toolkitHtml) this._toolkitHtml = grid.innerHTML;
                if (!p.tools) grid.innerHTML = this._toolkitHtml;
                else {
                    grid.innerHTML = p.tools.map(t => {
                        const tool = this.searchItems.find(i => i.id === t);
                        if (!tool) return '';
                        return `<button onclick="app.deskOpen('${t}')" class="app-tile group">
                            <span class="app-icon desk-icon-${id}"><i data-lucide="${tool.icon}" class="w-5 h-5 text-white"></i></span>
                            <span class="min-w-0"><span class="app-title">${esc(tool.label.replace(/ —.*$/, '').replace(/ \(.*\)$/, ''))}</span><span class="app-sub">${esc(this._toolSub(t))}</span></span>
                        </button>`;
                    }).join('');
                }
            }
            const title = $('home-toolkit-title');
            if (title) title.textContent = p.tools ? `Your ${p.name} Desk` : 'Your toolkit';

            // Widget order + spotlight
            const bento = $('home-bento');
            if (bento) {
                [...bento.children].forEach(w => { w.style.order = ''; });
                if (p.order) p.order.forEach((wid, i) => { const w = $(wid); if (w) w.style.order = String(i); });
            }
            this.renderSpotlight();
            this._rebuildIcons();
        },
        _toolSub(id) {
            return ({
                devtools: 'JSON, Base64, JWT, regex', scratchpad: id === 'scratchpad' && this.deskPreset === 'dev' ? 'Code mode, syntax colours' : 'Markdown notes', timer: 'Pomodoro focus',
                board: 'Kanban columns', colorpicker: 'HEX · RGB · HSL', ocr: 'Screenshot to text', audio: 'Lo-fi & ambience mixer',
                focustown: 'Grows while you study', pages: 'Notes & journal', whiteboard: 'Sketch it out', calculator: 'Quick maths',
                breathing: 'Calm before exams', converter: 'Units in a flash', zones: 'World clock', onair: 'Busy / free sign',
                clock: 'Alarm & desk clock', recorder: 'Record a quick demo'
            })[id] || '';
        },
        deskOpen(id) {
            this.switchTab(id);
            if (id === 'scratchpad' && this.deskPreset === 'dev' && this.setNoteMode) this.setNoteMode('code');
        },
        renderSpotlight() {
            const el = $('w-spotlight');
            if (!el) return;
            const id = this.deskPreset;
            if (id === 'all') { el.hidden = true; el.innerHTML = ''; return; }
            el.hidden = false;
            const p = PRESETS[id];
            let cards = '';
            if (id === 'dev') {
                const note = (localStorage.getItem('wd_scratch') || '').trim().split('\n')[0].slice(0, 40);
                cards = [
                    this._spot('terminal', 'Dev Toolkit', 'Format JSON, decode a JWT…', "app.switchTab('devtools')", 'Open'),
                    this._spot('code-2', 'Code Scratchpad', note ? esc(note) : 'Paste a snippet, get colours', "app.deskOpen('scratchpad')", 'Write'),
                    this._spot('hourglass', 'Pomodoro', this.timerRunning ? 'Focusing now…' : '25 minutes of deep work', 'app.startPomodoro()', this.timerRunning ? 'View' : 'Start 25m')
                ].join('');
            } else if (id === 'student') {
                const town = this._townState && this._townState();
                const coins = town && typeof town.coins === 'number' ? `🪙 ${Math.floor(town.coins)} coins` : 'Build while you study';
                cards = [
                    this._spot('building-2', 'Focus Town', coins, "app.switchTab('focustown')", 'Visit'),
                    this._spot('headphones', 'Audio Mixer', 'Deep Focus: brown noise + rain', "app.mixerStart && app.showToast(app.mixerStart('focus') || 'Mixer started')", 'Play'),
                    this._spot('glass-water', 'Hydration', `${this.waterCount || 0} / 8 glasses today`, 'app.addWater(); app.renderSpotlight()', '+ Glass')
                ].join('');
            } else if (id === 'remote') {
                const zones = (this.zonesCities || []).filter(c => c.zone).slice(0, 3)
                    .map(c => { try { return `${c.flag} ${new Date().toLocaleTimeString(undefined, { timeZone: c.zone, hour: 'numeric', minute: '2-digit' })}`; } catch (e) { return ''; } }).filter(Boolean).join(' · ');
                const board = readLocal('wd_board', null);
                let boardSub = 'To do · Doing · Done';
                if (board && typeof board === 'object') {
                    const cols = Array.isArray(board) ? board : Object.values(board);
                    const n = cols.reduce((a, c) => a + (Array.isArray(c) ? c.length : Array.isArray(c?.items) ? c.items.length : 0), 0);
                    if (n) boardSub = `${n} card${n === 1 ? '' : 's'} on your board`;
                }
                cards = [
                    this._spot('globe-2', 'World Clock', zones || 'Your team\'s time zones', "app.switchTab('zones')", 'Open'),
                    this._spot('radio', 'On Air sign', 'Tell the house you\'re on a call', "app.showOnAir ? app.showOnAir('busy') : app.switchTab('onair')", 'Go live'),
                    this._spot('columns', 'Kanban', boardSub, "app.switchTab('board')", 'Open')
                ].join('');
            }
            el.innerHTML = `
                <div class="widget-head"><span class="widget-label text-indigo-600 dark:text-indigo-400">${p.emoji} ${esc(p.name)} Desk</span>
                    <button class="home-link text-xs" onclick="app.setDeskPreset('all')">Show all tools</button></div>
                <div class="spot-grid">${cards}</div>`;
            this._rebuildIcons();
        },
        _spot(icon, title, sub, action, cta) {
            return `<div class="spot-card">
                <span class="app-icon desk-icon-${this.deskPreset}"><i data-lucide="${icon}" class="w-5 h-5 text-white"></i></span>
                <span class="min-w-0 flex-1"><span class="block font-bold">${esc(title)}</span><span class="block text-xs text-slate-400 truncate">${sub}</span></span>
                <button class="spot-cta" onclick="${action}">${esc(cta)}</button>
            </div>`;
        },

        renderWater() {
            orig.renderWater.call(this);
            if (this.deskPreset === 'student') this.renderSpotlight();
        },

        switchTab(tabId) {
            orig.switchTab.call(this, tabId);
            if (this.deskPreset !== 'all') this.applyDeskPreset();
        },

        // ─────────────────────────────────────────────────────────
        // 3. MORNING BRIEF & DAILY SHUTDOWN
        // ─────────────────────────────────────────────────────────
        // Daily focus = growth of Focus Town's focus-minute counter since the
        // day's first look (it only grows while the timer runs).
        _trackFocus() {
            const town = this._townState && this._townState();
            const mins = town && town.stats ? Math.floor(town.stats.focusMin || 0) : 0;
            const sessions = this.timerSessions || 0;
            let fd = readLocal('wd_focus_day', null);
            if (!fd || fd.date !== today()) {
                fd = { date: today(), townBase: mins, sessBase: sessions };
                save('wd_focus_day', fd);
            }
            return { minutes: Math.max(0, mins - fd.townBase), sessions: Math.max(0, sessions - fd.sessBase) };
        },

        _shutdownData() {
            const t = today(), tmr = addDays(t, 1);
            const focus = this._trackFocus();
            const doneToday = this.tasks.filter(x => x.done && (x.doneOn === t || (!x.doneOn && x.date === t)));
            const unfinished = this.tasks.filter(x => !x.done && x.date && x.date <= t);
            const tomorrow = this.tasks.filter(x => !x.done && x.date === tmr);
            const log = readLocal('wd_daily_log', {});
            return { t, tmr, focus, doneToday, unfinished, tomorrow, closed: log[t] };
        },

        _standup(d, opts = {}) {
            const line = x => `• ${x.text}`;
            const date = new Date(d.t + 'T12:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
            const next = d.unfinished.concat(d.tomorrow.filter(x => !d.unfinished.includes(x)));
            const focus = (localStorage.getItem('wd_focus') || '').trim();
            return [
                `Standup — ${date}`,
                '',
                `✅ Done${d.doneToday.length ? '' : ': nothing checked off yet'}`,
                ...d.doneToday.slice(0, 12).map(line),
                '',
                `➡️ ${opts.morning ? 'Today' : 'Next'}${next.length ? '' : ': planning in progress'}`,
                ...next.slice(0, 12).map(line),
                '',
                `🎯 Focus: ${d.focus.minutes} min${d.focus.sessions ? ` · ${d.focus.sessions} Pomodoro${d.focus.sessions === 1 ? '' : 's'}` : ''}${focus ? ` · "${focus}"` : ''}`,
                '🚧 Blockers: none'
            ].join('\n');
        },

        _yesterdayLog() {
            const log = readLocal('wd_daily_log', {});
            return log[addDays(today(), -1)] || null;
        },

        openMorningBrief() {
            const d = this._shutdownData();
            const y = this._yesterdayLog();
            const agenda = this._agendaCache ? this._agendaCache.filter(e => ymd(e.start) === d.t || (e.allDay && e.start <= new Date() && e.end > new Date())) : [];
            const events = this._eventsOn ? this._eventsOn(d.t) : [];
            const standup = y ? y.summary : this._standup(d, { morning: true });
            const items = [
                ...events.map(e => ({ when: e.allDay ? 'All day' : (e.start.slice(11, 16) || ''), text: e.title })),
                ...agenda.map(e => ({ when: e.allDay ? 'All day' : timeLabel(e.start), text: e.title }))
            ];
            this.lifeModal('☀️ Morning brief', `
                <div class="space-y-4 text-sm">
                    ${y ? `<div class="brief-box"><div class="brief-k">Yesterday</div>${y.tasksDone} task${y.tasksDone === 1 ? '' : 's'} done · ${y.focusMinutes} min focused${y.tasksRolled ? ` · ${y.tasksRolled} rolled to today` : ''}</div>` : ''}
                    <div class="brief-box"><div class="brief-k">On your plate today (${d.unfinished.length})</div>
                        ${d.unfinished.length ? `<ul class="brief-list">${d.unfinished.slice(0, 8).map(x => `<li>${esc(x.text)}${x.rolled ? ` <span class="brief-tag">rolled ×${x.rolled}</span>` : ''}</li>`).join('')}</ul>` : '<div class="text-slate-400">Nothing scheduled — add tasks with “today”.</div>'}
                    </div>
                    ${items.length ? `<div class="brief-box"><div class="brief-k">Meetings & events</div><ul class="brief-list">${items.slice(0, 8).map(i => `<li><b>${esc(i.when)}</b> ${esc(i.text)}</li>`).join('')}</ul></div>` : ''}
                    <div><div class="brief-k mb-1">${y ? 'Yesterday\'s standup' : 'Standup draft'}</div><pre class="brief-pre">${esc(standup)}</pre></div>
                    <div class="flex flex-wrap gap-2">
                        <button id="brief-copy" class="${this._btnCls}">Copy standup</button>
                        <button id="brief-focus" class="${this._ghostBtnCls}">Start 25m focus</button>
                        <button id="brief-today" class="${this._ghostBtnCls}">Open Today</button>
                    </div>
                    <button id="brief-shutdown" class="text-xs font-bold text-slate-400 hover:text-indigo-500">Wrapping up early? Shut down the day →</button>
                </div>`, wrap => {
                wrap.querySelector('#brief-copy').onclick = () => this.copyText(standup, 'Standup copied — paste it in Slack or Teams');
                wrap.querySelector('#brief-focus').onclick = () => { this.closeLifeModal(); this.startPomodoro(); };
                wrap.querySelector('#brief-today').onclick = () => { this.closeLifeModal(); this.switchTab('today'); };
                wrap.querySelector('#brief-shutdown').onclick = () => this.openShutdown();
            });
        },

        openShutdown() {
            const d = this._shutdownData();
            const preview = this._standup(d);
            this.lifeModal('🌙 Daily shutdown', `
                <div class="space-y-4 text-sm">
                    <div class="grid grid-cols-3 gap-2 text-center">
                        <div class="brief-stat"><b>${d.doneToday.length}</b><span>done</span></div>
                        <div class="brief-stat"><b>${d.unfinished.length}</b><span>to roll over</span></div>
                        <div class="brief-stat"><b>${d.focus.minutes}m</b><span>focused</span></div>
                    </div>
                    <ul class="brief-steps">
                        <li>➡️ Move <b>${d.unfinished.length}</b> unfinished task${d.unfinished.length === 1 ? '' : 's'} to tomorrow</li>
                        <li>${this.account ? '☁️ Log today\'s focus minutes to your profile' : '💾 Log today\'s focus minutes on this device <a href="/login?mode=signup" class="text-indigo-500 font-bold">(save to a free profile)</a>'}</li>
                        <li>📋 Copy this standup summary to your clipboard</li>
                    </ul>
                    <pre class="brief-pre">${esc(preview)}</pre>
                    ${d.closed ? `<div class="text-xs text-amber-600">You already shut down today at ${new Date(d.closed.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}. Running it again updates the log.</div>` : ''}
                    <button id="shutdown-go" class="${this._btnCls} w-full">Shut down &amp; copy summary</button>
                </div>`, wrap => {
                wrap.querySelector('#shutdown-go').onclick = () => this.runShutdown();
            });
        },

        async runShutdown() {
            const d = this._shutdownData();
            const summary = this._standup(d);
            // Copy first, while we're still inside the click.
            this.copyText(summary, 'Standup summary copied');
            d.unfinished.forEach(x => { x.date = d.tmr; x.rolled = (x.rolled || 0) + 1; });
            this.renderTasks();
            const entry = { at: Date.now(), focusMinutes: d.focus.minutes, sessions: d.focus.sessions, tasksDone: d.doneToday.length, tasksRolled: d.unfinished.length, summary };
            const log = readLocal('wd_daily_log', {});
            log[d.t] = entry;
            // Keep the local log to the last 90 days.
            Object.keys(log).sort().slice(0, -90).forEach(k => delete log[k]);
            save('wd_daily_log', log);
            this.renderBriefButton();

            let where = 'Saved on this device';
            if (this.account && this._supabase) {
                try {
                    const sb = await this._supabase();
                    const { error } = await sb.from('daily_logs').upsert({
                        user_id: this.account.id, day: d.t, focus_minutes: Math.min(1440, entry.focusMinutes), sessions: Math.min(500, entry.sessions),
                        tasks_done: entry.tasksDone, tasks_rolled: entry.tasksRolled, summary: summary.slice(0, 8000)
                    }, { onConflict: 'user_id,day' });
                    if (error) throw error;
                    where = 'Logged to your profile ☁️';
                } catch (e) {
                    where = 'Saved to your Desk (cloud log unavailable)';
                }
            }
            this.lifeModal('✅ Day closed', `
                <div class="space-y-3 text-sm">
                    <p><b>${d.unfinished.length}</b> task${d.unfinished.length === 1 ? '' : 's'} moved to tomorrow · <b>${d.focus.minutes}</b> focus minutes · summary copied.</p>
                    <p class="text-slate-400">${esc(where)}.${this.account ? '' : ' <a href="/login?mode=signup" class="text-indigo-500 font-bold">Create a free profile</a> to keep a history across devices — and browse ad-free.'}</p>
                    <pre class="brief-pre">${esc(summary)}</pre>
                    <button class="${this._ghostBtnCls}" id="shutdown-copy">Copy again</button>
                </div>`, wrap => { wrap.querySelector('#shutdown-copy').onclick = () => this.copyText(summary, 'Copied'); });
        },

        // The hero button: brief in the morning, shutdown from midday.
        renderBriefButton() {
            const ctas = document.querySelector('#life-dash-card .hero-ctas');
            if (!ctas) return;
            let btn = $('hero-brief');
            if (!btn) {
                btn = document.createElement('button');
                btn.id = 'hero-brief';
                btn.className = 'hero-cta ghost';
                ctas.appendChild(btn);
            }
            const h = new Date().getHours();
            const closed = !!readLocal('wd_daily_log', {})[today()];
            const morning = h >= 4 && h < 12;
            btn.innerHTML = morning ? '☀️ Morning brief' : closed ? '🌙 Day closed ✓' : '🌙 Shut down day';
            btn.title = morning ? 'Yesterday, today\'s plan and a standup to copy' : 'Roll unfinished tasks to tomorrow, log focus time, copy a standup summary';
            btn.onclick = () => morning ? this.openMorningBrief() : this.openShutdown();
        },

        renderLifeDashCard() {
            orig.renderLifeDashCard.call(this);
            this.renderBriefButton();
        },

        // ─────────────────────────────────────────────────────────
        // 4. WORKSPACE LAUNCHERS
        // ─────────────────────────────────────────────────────────
        _launchers() {
            const l = readLocal('wd_launchers', null);
            return Array.isArray(l) ? l : DEFAULT_LAUNCHERS.map(x => ({ ...x, urls: [...x.urls] }));
        },
        _saveLaunchers(list) { save('wd_launchers', list); this.renderLaunchers(); },
        _mixName(id) {
            if (!id || !this.mixerList) return '';
            const m = this.mixerList().find(x => x.id === id);
            return m ? m.name : '';
        },
        renderLaunchers() {
            const el = $('launchers-grid');
            if (!el) return;
            const list = this._launchers();
            el.innerHTML = list.map(l => {
                const bits = [];
                if (l.urls.length) bits.push(`${l.urls.length} tab${l.urls.length === 1 ? '' : 's'}`);
                const mix = this._mixName(l.mix);
                if (mix) bits.push(mix.replace(/^\S+\s/, ''));
                if (l.focus) bits.push('25m focus');
                return `<div class="launcher">
                    <button class="launcher-go" data-launch="${esc(l.id)}" title="Launch ${esc(l.name)}">
                        <span class="launcher-emoji" aria-hidden="true">${esc(l.emoji || '📁')}</span>
                        <span class="min-w-0 text-left"><span class="block font-bold text-sm truncate">${esc(l.name)}</span><span class="block text-[11px] text-slate-400 truncate">${esc(bits.join(' · ') || 'Empty — edit to add links')}</span></span>
                        <i data-lucide="play" class="w-4 h-4 ml-auto shrink-0 text-indigo-500"></i>
                    </button>
                    <button class="launcher-edit" data-edit="${esc(l.id)}" aria-label="Edit ${esc(l.name)}" title="Edit"><i data-lucide="pencil" class="w-3.5 h-3.5"></i></button>
                </div>`;
            }).join('');
            el.querySelectorAll('[data-launch]').forEach(b => b.onclick = () => this.runLauncher(b.dataset.launch));
            el.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => this.editLauncher(b.dataset.edit));
            this._rebuildIcons();
        },
        runLauncher(id) {
            const l = this._launchers().find(x => x.id === id);
            if (!l) return;
            const blocked = [];
            l.urls.forEach(url => {
                // Opened blank first so a blocked pop-up is detectable (noopener always returns null).
                const w = window.open('about:blank', '_blank');
                if (w) { try { w.opener = null; } catch (e) {} w.location.href = url; }
                else blocked.push(url);
            });
            const done = [];
            if (l.mix && this.mixerStart) { const n = this.mixerStart(l.mix); if (n) done.push(n); }
            if (l.tab) this.switchTab(l.tab);
            if (l.focus && !this.timerRunning) { this.startPomodoro(); done.push('25m focus'); }
            if (blocked.length) {
                this.lifeModal(`${esc(l.emoji)} ${esc(l.name)}`, `
                    <p class="text-sm mb-3">Your browser blocked ${blocked.length} of ${l.urls.length} tabs. Allow pop-ups for webdesks.app (the icon in the address bar) to open them all in one click next time, or open them here:</p>
                    <div class="space-y-2">${blocked.map(u => `<a href="${esc(u)}" target="_blank" rel="noopener" class="block truncate px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-indigo-600 font-medium text-sm">${esc(u)}</a>`).join('')}</div>`);
            } else {
                this.showToast(`${l.emoji} ${l.name} launched${done.length ? ' · ' + done.join(' · ') : ''}`);
            }
        },
        editLauncher(id) {
            const list = this._launchers();
            const l = list.find(x => x.id === id) || { id: 'l-' + uid(), name: '', emoji: '📁', urls: [], mix: '', tab: '', focus: false };
            const isNew = !list.some(x => x.id === l.id);
            const mixes = this.mixerList ? this.mixerList() : [];
            const tabs = this.searchItems.filter(t => !t.link);
            this.lifeModal(isNew ? 'New launcher' : 'Edit launcher', `
                <div class="flex gap-2">
                    <div class="w-20">${this._field('Icon', `<input id="lx-emoji" maxlength="4" value="${esc(l.emoji)}" class="${this._inputCls} text-center">`)}</div>
                    <div class="flex-1">${this._field('Name', `<input id="lx-name" maxlength="40" value="${esc(l.name)}" placeholder="Morning Routine" class="${this._inputCls}">`)}</div>
                </div>
                ${this._field('Links to open (one per line)', `<textarea id="lx-urls" rows="4" placeholder="https://mail.google.com&#10;https://calendar.google.com" class="${this._inputCls} font-mono text-xs">${esc(l.urls.join('\n'))}</textarea>`)}
                <div class="grid grid-cols-2 gap-2">
                    ${this._field('Start a sound', `<select id="lx-mix" class="${this._inputCls}"><option value="">None</option>${mixes.map(m => `<option value="${esc(m.id)}"${m.id === l.mix ? ' selected' : ''}>${esc(m.name)}</option>`).join('')}</select>`)}
                    ${this._field('Open a tool', `<select id="lx-tab" class="${this._inputCls}"><option value="">Stay here</option>${tabs.map(t => `<option value="${t.id}"${t.id === l.tab ? ' selected' : ''}>${esc(t.label)}</option>`).join('')}</select>`)}
                </div>
                <label class="flex items-center gap-2 text-sm font-medium mb-4"><input id="lx-focus" type="checkbox" ${l.focus ? 'checked' : ''} class="w-4 h-4 accent-indigo-600"> Start a 25-minute focus session</label>
                <div class="flex gap-2">
                    <button id="lx-save" class="${this._btnCls} flex-1">Save launcher</button>
                    ${isNew ? '' : `<button id="lx-del" class="${this._ghostBtnCls} text-rose-500">Delete</button>`}
                </div>
                <p class="text-xs text-slate-400 mt-3">Tip: the first time you launch several links, your browser may ask you to allow pop-ups for webdesks.app.</p>`, wrap => {
                wrap.querySelector('#lx-save').onclick = () => {
                    const urls = wrap.querySelector('#lx-urls').value.split(/[\n\s]+/).map(u => u.trim()).filter(Boolean)
                        .map(u => /^[a-z][\w+.-]*:/i.test(u) ? u : 'https://' + u)
                        .filter(u => /^https?:\/\//i.test(u)).slice(0, 12);
                    const next = {
                        ...l,
                        name: wrap.querySelector('#lx-name').value.trim() || 'Launcher',
                        emoji: wrap.querySelector('#lx-emoji').value.trim() || '📁',
                        urls, mix: wrap.querySelector('#lx-mix').value, tab: wrap.querySelector('#lx-tab').value,
                        focus: wrap.querySelector('#lx-focus').checked
                    };
                    const i = list.findIndex(x => x.id === l.id);
                    if (i >= 0) list[i] = next; else list.push(next);
                    this._saveLaunchers(list);
                    this.closeLifeModal();
                    this.showToast(`${next.emoji} ${next.name} saved`);
                };
                const del = wrap.querySelector('#lx-del');
                if (del) del.onclick = () => {
                    const i = list.findIndex(x => x.id === l.id);
                    const [gone] = list.splice(i, 1);
                    this._saveLaunchers(list);
                    this.closeLifeModal();
                    if (this.offerUndo) this.offerUndo(`Deleted “${gone.name}”`, () => { list.splice(i, 0, gone); this._saveLaunchers(list); });
                };
            });
        },

        // ─────────────────────────────────────────────────────────
        // 5a. SNIPPET / CLIPBOARD VAULT
        // ─────────────────────────────────────────────────────────
        _snipQuery: '',
        _snippets() { const s = readLocal('wd_snippets', []); return Array.isArray(s) ? s : []; },
        renderSnippets() {
            const el = $('w-snippets');
            if (!el) return;
            const all = this._snippets();
            const q = this._snipQuery.toLowerCase();
            const list = all
                .filter(s => !q || (s.label + ' ' + s.text).toLowerCase().includes(q))
                .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.uses || 0) - (a.uses || 0) || b.at - a.at);
            el.innerHTML = `
                <div class="widget-head"><span class="widget-label text-fuchsia-600 dark:text-fuchsia-400">Snippet vault</span>
                    <button class="home-link text-xs" onclick="app.editSnippet()"><i data-lucide="plus-circle" class="w-3.5 h-3.5"></i> Add</button></div>
                ${all.length > 5 ? `<input id="snip-q" class="widget-input w-full mb-3 text-sm" placeholder="Search snippets…" value="${esc(this._snipQuery)}">` : ''}
                ${list.length ? `<div class="snip-list">${list.slice(0, 12).map(s => {
                    const link = /^https?:\/\/\S+$/i.test(s.text.trim());
                    return `<div class="snip">
                        <button class="snip-copy" data-copy="${esc(s.id)}" title="Click to copy">
                            <i data-lucide="${link ? 'link' : 'clipboard'}" class="w-4 h-4 shrink-0 text-fuchsia-500"></i>
                            <span class="min-w-0 text-left"><span class="block font-bold text-sm truncate">${esc(s.label || s.text.slice(0, 40))}</span><span class="block text-[11px] text-slate-400 truncate">${esc(s.text.replace(/\s+/g, ' ').slice(0, 80))}</span></span>
                        </button>
                        <button class="snip-act" data-edit="${esc(s.id)}" aria-label="Edit"><i data-lucide="pencil" class="w-3.5 h-3.5"></i></button>
                    </div>`;
                }).join('')}</div>` : all.length ? '<p class="text-sm text-slate-400">No snippets match.</p>' : `
                    <div class="text-sm text-slate-500">
                        <p class="mb-3">Save text you paste all the time — email sign-offs, your address, meeting links, code. One click copies it.</p>
                        <div class="flex flex-wrap gap-2">
                            <button class="snip-seed" data-seed="Thanks so much — talk soon!|Friendly sign-off">✍️ Sign-off</button>
                            <button class="snip-seed" data-seed="https://|My meeting link">🔗 Meeting link</button>
                            <button class="snip-seed" data-seed="|Home address">🏠 Address</button>
                        </div>
                    </div>`}`;
            const qi = $('snip-q');
            if (qi) qi.oninput = () => { this._snipQuery = qi.value; this.renderSnippets(); const n = $('snip-q'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
            el.querySelectorAll('[data-copy]').forEach(b => b.onclick = () => this.copySnippet(b.dataset.copy));
            el.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => this.editSnippet(b.dataset.edit));
            el.querySelectorAll('[data-seed]').forEach(b => b.onclick = () => { const [text, label] = b.dataset.seed.split('|'); this.editSnippet(null, { text, label }); });
            this._rebuildIcons();
        },
        copySnippet(id) {
            const all = this._snippets();
            const s = all.find(x => x.id === id);
            if (!s) return;
            this.copyText(s.text, `Copied “${s.label || s.text.slice(0, 24)}”`);
            s.uses = (s.uses || 0) + 1;
            save('wd_snippets', all);
            this.renderSnippets();
        },
        editSnippet(id, seed) {
            const all = this._snippets();
            const s = all.find(x => x.id === id) || { id: 's-' + uid(), label: seed?.label || '', text: seed?.text || '', uses: 0, at: Date.now() };
            const isNew = !all.some(x => x.id === s.id);
            this.lifeModal(isNew ? 'New snippet' : 'Edit snippet', `
                ${this._field('Name', `<input id="sx-label" maxlength="60" value="${esc(s.label)}" placeholder="Zoom link" class="${this._inputCls}">`)}
                ${this._field('Text or link', `<textarea id="sx-text" rows="6" maxlength="5000" class="${this._inputCls} text-sm">${esc(s.text)}</textarea>`)}
                <div class="flex gap-2">
                    <button id="sx-save" class="${this._btnCls} flex-1">Save</button>
                    ${isNew ? '' : `<button id="sx-del" class="${this._ghostBtnCls} text-rose-500">Delete</button>`}
                </div>`, wrap => {
                if (seed) setTimeout(() => wrap.querySelector('#sx-text').focus(), 40);
                wrap.querySelector('#sx-save').onclick = () => {
                    const text = wrap.querySelector('#sx-text').value;
                    if (!text.trim()) { this.showToast('Add some text to save'); return; }
                    const next = { ...s, label: wrap.querySelector('#sx-label').value.trim(), text };
                    const i = all.findIndex(x => x.id === s.id);
                    if (i >= 0) all[i] = next; else all.unshift(next);
                    save('wd_snippets', all.slice(0, 200));
                    this.closeLifeModal();
                    this.renderSnippets();
                };
                const del = wrap.querySelector('#sx-del');
                if (del) del.onclick = () => {
                    const i = all.findIndex(x => x.id === s.id);
                    const [gone] = all.splice(i, 1);
                    save('wd_snippets', all);
                    this.closeLifeModal();
                    this.renderSnippets();
                    if (this.offerUndo) this.offerUndo('Snippet deleted', () => { all.splice(i, 0, gone); save('wd_snippets', all); this.renderSnippets(); });
                };
            });
        },

        // ─────────────────────────────────────────────────────────
        // 5b. SUBSCRIPTIONS & QUICK EXPENSES
        // ─────────────────────────────────────────────────────────
        _moneyTab: 'subs',
        _money(n) {
            const cur = localStorage.getItem('wd_money_cur') || 'USD';
            try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur, maximumFractionDigits: cur === 'JPY' ? 0 : 2 }).format(n || 0); }
            catch (e) { return (n || 0).toFixed(2); }
        },
        renderMoney() {
            const el = $('w-money');
            if (!el) return;
            const subs = readLocal('wd_subs', []);
            const exps = readLocal('wd_expenses', []);
            const cur = localStorage.getItem('wd_money_cur') || 'USD';
            const t = today();
            let body;
            if (this._moneyTab === 'subs') {
                const rows = subs.map(s => ({ ...s, due: nextRenewal(s) })).sort((a, b) => a.due.localeCompare(b.due));
                const monthly = subs.reduce((a, s) => a + (+s.amount || 0) * (CYCLES[s.cycle] || CYCLES.monthly).perMonth, 0);
                const soon = rows.filter(s => s.due <= addDays(t, 7));
                body = `
                    <div class="money-totals"><div><b>${this._money(monthly)}</b><span>/ month</span></div><div><b>${this._money(monthly * 12)}</b><span>/ year</span></div><div><b>${soon.length}</b><span>renew this week</span></div></div>
                    ${rows.length ? `<div class="money-list">${rows.slice(0, 8).map(s => {
                        const days = Math.round((new Date(s.due + 'T12:00') - new Date(t + 'T12:00')) / 86400000);
                        return `<div class="money-row">
                            <span class="min-w-0 flex-1"><span class="block font-bold text-sm truncate">${esc(s.name)}</span><span class="block text-[11px] ${days <= 3 ? 'text-rose-500 font-bold' : 'text-slate-400'}">${days === 0 ? 'Renews today' : days === 1 ? 'Renews tomorrow' : `Renews ${dayLabel(s.due)} · ${days}d`}</span></span>
                            <span class="text-sm font-bold">${this._money(+s.amount)}<span class="text-[10px] text-slate-400">/${(CYCLES[s.cycle] || CYCLES.monthly).label}</span></span>
                            <button class="snip-act" data-delsub="${esc(s.id)}" aria-label="Remove ${esc(s.name)}"><i data-lucide="x" class="w-3.5 h-3.5"></i></button>
                        </div>`;
                    }).join('')}</div>` : '<p class="text-sm text-slate-400 mb-2">Track Netflix, Spotify, iCloud, gym… and see what they cost you a year.</p>'}
                    <form id="sub-form" class="money-form">
                        <input name="name" required maxlength="40" placeholder="Netflix" class="widget-input min-w-[8rem] flex-[2]" aria-label="Subscription name">
                        <input name="amount" required type="number" min="0" step="0.01" placeholder="15.49" class="widget-input min-w-[5.5rem] flex-1" inputmode="decimal" aria-label="Price">
                        <select name="cycle" class="widget-input" aria-label="Billing cycle">${Object.entries(CYCLES).map(([k, v]) => `<option value="${k}"${k === 'monthly' ? ' selected' : ''}>/${v.label}</option>`).join('')}</select>
                        <input name="next" type="date" value="${t}" class="widget-input flex-1" title="Next renewal date" aria-label="Next renewal date">
                        <button class="money-add" aria-label="Add subscription"><i data-lucide="plus" class="w-4 h-4"></i></button>
                    </form>`;
            } else {
                const month = t.slice(0, 7), weekStart = addDays(t, -6);
                const sum = f => exps.filter(f).reduce((a, e) => a + (+e.amount || 0), 0);
                const recent = [...exps].sort((a, b) => b.at - a.at).slice(0, 6);
                body = `
                    <div class="money-totals"><div><b>${this._money(sum(e => e.date === t))}</b><span>today</span></div><div><b>${this._money(sum(e => e.date >= weekStart))}</b><span>7 days</span></div><div><b>${this._money(sum(e => e.date.startsWith(month)))}</b><span>this month</span></div></div>
                    <form id="exp-form" class="money-form">
                        <input name="amount" required type="number" min="0" step="0.01" placeholder="4.50" class="widget-input min-w-0 flex-1" inputmode="decimal" aria-label="Amount">
                        <input name="note" maxlength="60" placeholder="Coffee" class="widget-input min-w-0 flex-[2]" aria-label="What for">
                        <button class="money-add" aria-label="Add expense"><i data-lucide="plus" class="w-4 h-4"></i></button>
                    </form>
                    ${recent.length ? `<div class="money-list">${recent.map(e => `<div class="money-row">
                        <span class="min-w-0 flex-1"><span class="block font-bold text-sm truncate">${esc(e.note || 'Expense')}</span><span class="block text-[11px] text-slate-400">${dayLabel(e.date)}</span></span>
                        <span class="text-sm font-bold">${this._money(+e.amount)}</span>
                        <button class="snip-act" data-delexp="${esc(e.id)}" aria-label="Remove"><i data-lucide="x" class="w-3.5 h-3.5"></i></button>
                    </div>`).join('')}</div>` : '<p class="text-sm text-slate-400 mt-2">Log a spend in two taps. Totals update instantly.</p>'}`;
            }
            el.innerHTML = `
                <div class="widget-head"><span class="widget-label text-lime-600 dark:text-lime-400">Money</span>
                    <span class="flex items-center gap-1">
                        <span class="seg"><button data-mtab="subs" class="${this._moneyTab === 'subs' ? 'on' : ''}">Subscriptions</button><button data-mtab="spend" class="${this._moneyTab === 'spend' ? 'on' : ''}">Spending</button></span>
                        <select id="money-cur" class="seg-select" aria-label="Currency">${CURRENCIES.map(c => `<option${c === cur ? ' selected' : ''}>${c}</option>`).join('')}</select>
                    </span></div>
                ${body}`;
            el.querySelectorAll('[data-mtab]').forEach(b => b.onclick = () => { this._moneyTab = b.dataset.mtab; this.renderMoney(); });
            $('money-cur').onchange = e => { localStorage.setItem('wd_money_cur', e.target.value); this.renderMoney(); };
            const sf = $('sub-form');
            if (sf) sf.onsubmit = e => {
                e.preventDefault();
                const f = new FormData(sf);
                const list = readLocal('wd_subs', []);
                list.push({ id: 'sub-' + uid(), name: String(f.get('name')).trim(), amount: Math.max(0, parseFloat(f.get('amount')) || 0), cycle: f.get('cycle'), next: f.get('next') || t });
                save('wd_subs', list);
                this.renderMoney();
            };
            const ef = $('exp-form');
            if (ef) ef.onsubmit = e => {
                e.preventDefault();
                const f = new FormData(ef);
                const list = readLocal('wd_expenses', []);
                list.push({ id: 'exp-' + uid(), amount: Math.max(0, parseFloat(f.get('amount')) || 0), note: String(f.get('note') || '').trim(), date: t, at: Date.now() });
                // Keep about a year of quick expenses.
                const cutoff = addDays(t, -400);
                save('wd_expenses', list.filter(x => x.date >= cutoff));
                this.renderMoney();
                const a = document.querySelector('#exp-form [name=amount]'); if (a) a.focus();
            };
            el.querySelectorAll('[data-delsub]').forEach(b => b.onclick = () => {
                const list = readLocal('wd_subs', []);
                const i = list.findIndex(x => x.id === b.dataset.delsub);
                const [gone] = list.splice(i, 1);
                save('wd_subs', list); this.renderMoney();
                if (gone && this.offerUndo) this.offerUndo(`Removed ${gone.name}`, () => { list.splice(i, 0, gone); save('wd_subs', list); this.renderMoney(); });
            });
            el.querySelectorAll('[data-delexp]').forEach(b => b.onclick = () => {
                save('wd_expenses', readLocal('wd_expenses', []).filter(x => x.id !== b.dataset.delexp));
                this.renderMoney();
            });
            this._rebuildIcons();
        },

        // ─────────────────────────────────────────────────────────
        // 5c. CALENDAR AGENDA (.ics, read-only)
        // ─────────────────────────────────────────────────────────
        _agendaCache: null,
        _agendaErr: '',
        _agendaBusy: false,
        async refreshAgenda(force) {
            const url = (localStorage.getItem('wd_ics_url') || '').trim();
            if (!url) { this._agendaCache = null; this.renderAgenda(); return; }
            // Cached copy stays on this device (not part of the synced Desk).
            const cache = readLocal('wdl_ics_cache', null);
            if (!force && cache && cache.url === url && Date.now() - cache.at < 30 * 60 * 1000) {
                this._agendaText = cache.text;
                this._buildAgenda();
                return;
            }
            this._agendaBusy = true;
            this._agendaErr = '';
            this.renderAgenda();
            const https = url.replace(/^webcals?:\/\//i, 'https://');
            let text = '', err = '';
            try {
                const r = await fetch('/.netlify/functions/ics?url=' + encodeURIComponent(https));
                const body = await r.text();
                if (r.ok && /BEGIN:VCALENDAR/i.test(body)) text = body;
                else if (r.status !== 404 || /calendar/i.test(body)) err = body.slice(0, 200) || `Error ${r.status}`;
            } catch (e) { /* no function here (local dev) — try the feed directly */ }
            if (!text) {
                try {
                    const r = await fetch(https);
                    const body = await r.text();
                    if (/BEGIN:VCALENDAR/i.test(body)) { text = body; err = ''; }
                } catch (e) { if (!err) err = 'Couldn\'t load that calendar. Check the link is the public or secret iCal (.ics) address.'; }
            }
            this._agendaBusy = false;
            if (text) {
                this._agendaText = text;
                try { localStorage.setItem('wdl_ics_cache', JSON.stringify({ url, at: Date.now(), text: text.length < 1500000 ? text : '' })); } catch (e) {}
                this._buildAgenda();
            } else {
                this._agendaErr = err || 'That link didn\'t return a calendar.';
                if (cache && cache.url === url && cache.text) { this._agendaText = cache.text; this._buildAgenda(); }
                else this.renderAgenda();
            }
        },
        _buildAgenda() {
            const from = new Date(); from.setHours(0, 0, 0, 0);
            const to = new Date(from); to.setDate(to.getDate() + 8);
            try { this._agendaCache = agendaFrom(this._agendaText || '', from, to); }
            catch (e) { this._agendaCache = []; this._agendaErr = 'Couldn\'t read that calendar file.'; }
            this.renderAgenda();
        },
        renderAgenda() {
            const el = $('w-agenda');
            if (!el) return;
            const url = localStorage.getItem('wd_ics_url') || '';
            const head = `<div class="widget-head"><span class="widget-label text-sky-600 dark:text-sky-400">Calendar agenda</span>
                ${url ? `<span class="flex items-center gap-3">
                    <button class="home-link text-xs" id="ag-refresh"><i data-lucide="refresh-cw" class="w-3.5 h-3.5${this._agendaBusy ? ' animate-spin' : ''}"></i> Refresh</button>
                    <button class="home-link text-xs" id="ag-change">Change link</button></span>` : '<span class="text-[11px] text-slate-400">Read-only · private</span>'}</div>`;
            if (!url || this._agendaEditing) {
                el.innerHTML = head + `
                    <form id="ag-form" class="flex flex-col sm:flex-row gap-2">
                        <input id="ag-url" type="url" inputmode="url" required value="${esc(url)}" placeholder="Paste your calendar's .ics link (https:// or webcal://)" class="widget-input flex-1 min-w-0 text-sm">
                        <button class="px-5 py-3 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-sm">Show my agenda</button>
                        ${url ? '<button type="button" id="ag-remove" class="px-4 py-3 rounded-2xl border border-slate-300 dark:border-slate-600 font-bold text-sm">Remove</button>' : ''}
                    </form>
                    <details class="mt-3 text-xs text-slate-500">
                        <summary class="cursor-pointer font-bold">Where do I find my .ics link?</summary>
                        <ul class="mt-2 space-y-1 list-disc pl-5">
                            <li><b>Google Calendar</b>: Settings → pick your calendar → Integrate calendar → <i>Secret address in iCal format</i>.</li>
                            <li><b>Outlook</b>: Settings → Calendar → Shared calendars → Publish a calendar → copy the <i>ICS</i> link.</li>
                            <li><b>Apple iCloud</b>: Calendar app → share icon next to a calendar → Public Calendar → copy link.</li>
                        </ul>
                        <p class="mt-2">WebDesks only reads the feed to show your next 7 days; nothing is written back. The link is saved with your Desk — treat it like a password.</p>
                    </details>`;
                const form = $('ag-form');
                form.onsubmit = e => {
                    e.preventDefault();
                    const v = $('ag-url').value.trim();
                    if (!/^(https?|webcals?):\/\//i.test(v)) { this.showToast('Paste the full link, starting with https:// or webcal://'); return; }
                    localStorage.setItem('wd_ics_url', v);
                    this._agendaEditing = false;
                    this.refreshAgenda(true);
                };
                const rm = $('ag-remove');
                if (rm) rm.onclick = () => { localStorage.removeItem('wd_ics_url'); localStorage.removeItem('wdl_ics_cache'); this._agendaEditing = false; this._agendaCache = null; this.renderAgenda(); };
                this._rebuildIcons();
                return;
            }
            let body;
            if (this._agendaBusy && !this._agendaCache) body = '<p class="text-sm text-slate-400">Loading your calendar…</p>';
            else if (!this._agendaCache) body = `<p class="text-sm text-rose-500">${esc(this._agendaErr || 'Not loaded yet.')}</p>`;
            else {
                const days = {};
                const from = new Date(); from.setHours(0, 0, 0, 0);
                this._agendaCache.forEach(e => {
                    // Multi-day events show on each day they cover (from today).
                    const first = e.start < from ? new Date(from) : new Date(e.start.getFullYear(), e.start.getMonth(), e.start.getDate());
                    for (let d = first, i = 0; d < e.end && i < 8; d.setDate(d.getDate() + 1), i++) {
                        const k = ymd(d);
                        (days[k] = days[k] || []).push(e);
                        if (!e.allDay) break;
                    }
                });
                const keys = Object.keys(days).sort().slice(0, 7);
                const now = new Date();
                body = keys.length ? `<div class="agenda">${keys.map(k => `
                    <div class="agenda-day${k === today() ? ' is-today' : ''}">
                        <div class="agenda-date">${esc(dayLabel(k))}</div>
                        <div class="agenda-items">${days[k].slice(0, 8).map(e => `
                            <div class="agenda-item${!e.allDay && e.end < now ? ' past' : ''}${!e.allDay && e.start <= now && e.end > now ? ' now' : ''}">
                                <span class="agenda-time">${e.allDay ? 'All day' : esc(timeLabel(e.start))}</span>
                                <span class="min-w-0"><span class="block font-semibold text-sm truncate">${esc(e.title)}</span>${e.location ? `<span class="block text-[11px] text-slate-400 truncate">${esc(e.location)}</span>` : ''}</span>
                            </div>`).join('')}${days[k].length > 8 ? `<div class="text-[11px] text-slate-400 pl-16">+${days[k].length - 8} more</div>` : ''}</div>
                    </div>`).join('')}</div>` : '<p class="text-sm text-slate-400">Nothing on your calendar for the next 7 days. 🎉</p>';
                if (this._agendaErr) body = `<p class="text-xs text-amber-600 mb-2">Showing the last copy — ${esc(this._agendaErr)}</p>` + body;
            }
            el.innerHTML = head + body;
            $('ag-refresh').onclick = () => this.refreshAgenda(true);
            $('ag-change').onclick = () => { this._agendaEditing = true; this.renderAgenda(); };
            this._rebuildIcons();
        },

        // ─────────────────────────────────────────────────────────
        // ⌘K palette: actions + launchers + snippets
        // ─────────────────────────────────────────────────────────
        _paletteItems() {
            const base = orig.paletteItems.call(this);
            const extra = [
                { id: 'act-brief', label: 'Morning brief', icon: 'sunrise', keywords: 'morning brief standup plan today yesterday', sub: 'Action', run: () => this.openMorningBrief() },
                { id: 'act-shutdown', label: 'Shut down day', icon: 'moon-star', keywords: 'daily shutdown end of day roll over tasks standup summary log focus', sub: 'Action', run: () => this.openShutdown() },
                { id: 'act-launcher-new', label: 'New workspace launcher', icon: 'folder-plus', keywords: 'launcher folder quick actions urls open tabs', sub: 'Action', run: () => this.editLauncher() },
                { id: 'act-snippet-new', label: 'Add a snippet', icon: 'clipboard-plus', keywords: 'snippet clipboard vault text paste', sub: 'Action', run: () => this.editSnippet() },
                ...Object.entries(PRESETS).map(([k, p]) => ({
                    id: 'act-desk-' + k, label: k === 'all' ? 'Desk: show all tools' : `Switch to ${p.name} Desk`, icon: 'layout-dashboard',
                    keywords: `desk preset layout role ${p.name} ${p.blurb || ''} sidebar`, sub: 'Desk preset', run: () => this.setDeskPreset(k)
                })),
                ...this._launchers().map(l => ({ id: 'launch-' + l.id, label: `Launch ${l.name}`, icon: 'rocket', keywords: 'launcher workspace ' + l.urls.join(' '), sub: 'Launcher', run: () => this.runLauncher(l.id) })),
                ...this._snippets().slice(0, 30).map(s => ({ id: 'snip-' + s.id, label: `Copy: ${s.label || s.text.slice(0, 40)}`, icon: 'clipboard', keywords: 'snippet copy ' + s.text.slice(0, 120), sub: 'Snippet', run: () => this.copySnippet(s.id) }))
            ];
            return base.concat(extra);
        },

        init() {
            orig.init.call(this);
            this.deskPreset = PRESETS[localStorage.getItem('wd_desk_preset')] ? localStorage.getItem('wd_desk_preset') : 'all';
            this._onboardState();
            this.applyDeskPreset();
            this.renderOnboarding();
            this.updateAlarmUI();
            this.renderLaunchers();
            this.renderSnippets();
            this.renderMoney();
            this.renderAgenda();
            this.renderBriefButton();
            this._trackFocus();
            this.refreshAgenda();
            // Keep the agenda, brief button and spotlight current.
            setInterval(() => {
                if (document.hidden) return;
                this._trackFocus();
                this.renderBriefButton();
                if (this.currentTab === 'dashboard') {
                    if (this.deskPreset !== 'all') this.renderSpotlight();
                    if (this._agendaCache) this.renderAgenda();
                }
            }, 60 * 1000);
            setInterval(() => { if (!document.hidden) this.refreshAgenda(); }, 30 * 60 * 1000);
            // A Desk sync can bring new values in another tab: re-render ours.
            window.addEventListener('storage', e => {
                if (!e.key) return;
                if (e.key === 'wd_snippets') this.renderSnippets();
                if (e.key === 'wd_subs' || e.key === 'wd_expenses' || e.key === 'wd_money_cur') this.renderMoney();
                if (e.key === 'wd_launchers' || e.key === 'wd_mixes') this.renderLaunchers();
            });
        }
    });

    // Styles for everything above.
    const css = document.createElement('style');
    css.id = 'wd-desks';
    css.textContent = `
        #home-bento { grid-auto-flow: row dense; }
        @media (min-width: 1024px) { #home-bento > .wd-wide { grid-column: span 2; } }
        .desk-presets { display: flex; flex-wrap: wrap; gap: .5rem; margin: -.25rem 0 1rem; }
        .desk-chip { display: inline-flex; align-items: center; gap: .4rem; padding: .5rem .95rem; border-radius: 999px; font-weight: 700; font-size: .85rem;
            background: var(--surface); border: 1px solid var(--border); color: inherit; transition: border-color .15s, background .15s; }
        .desk-chip:hover { border-color: var(--accent); }
        .desk-chip.active { background: var(--accent); border-color: var(--accent); color: #fff; }
        .desk-icon-dev { background: linear-gradient(135deg, #0f172a, #334155); }
        .desk-icon-student { background: linear-gradient(135deg, #f59e0b, #ef4444); }
        .desk-icon-remote { background: linear-gradient(135deg, #0ea5e9, #6366f1); }
        .nav-btn.preset-hidden, .nav-group.preset-empty { display: none !important; }
        @media (min-width: 1024px) { aside nav.preset-on .nav-group.collapsed .nav-btn:not(.preset-hidden) { display: flex; } }
        .nav-preset-toggle { display: none; }
        @media (min-width: 1024px) { .nav-preset-toggle { display: block; width: 100%; margin-top: .75rem; padding: .55rem .75rem; border-radius: .75rem; font-size: .72rem; font-weight: 700;
            color: var(--accent); border: 1px dashed var(--border-strong, #cbd5e1); text-align: left; } .nav-preset-toggle:hover { background: var(--accent-soft, #eef2ff); } }
        .spot-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .75rem; }
        @media (max-width: 767px) { .spot-grid { grid-template-columns: minmax(0, 1fr); } }
        .spot-card { display: flex; align-items: center; gap: .75rem; padding: .8rem .9rem; border-radius: 1.1rem; background: var(--bg); border: 1px solid var(--border); min-width: 0; }
        .spot-cta { flex-shrink: 0; padding: .45rem .8rem; border-radius: .8rem; font-size: .78rem; font-weight: 800; background: var(--accent); color: #fff; }
        .spot-cta:hover { filter: brightness(1.1); }
        .onboard { margin-top: 1rem; display: grid; gap: .5rem; }
        .onboard-step { display: flex; align-items: center; gap: .75rem; padding: .7rem .8rem; border-radius: 1rem; background: var(--bg); border: 1px solid var(--border); }
        .onboard-step.done { opacity: .6; }
        .onboard-step.done .font-bold { text-decoration: line-through; }
        .onboard-num { width: 1.9rem; height: 1.9rem; border-radius: 999px; display: grid; place-items: center; font-weight: 800; font-size: .85rem; flex-shrink: 0;
            background: var(--accent-soft, #eef2ff); color: var(--accent); }
        .onboard-step.done .onboard-num { background: #10b981; color: #fff; }
        .onboard-cta { flex-shrink: 0; padding: .45rem .9rem; border-radius: .8rem; font-size: .8rem; font-weight: 800; background: #10b981; color: #fff; }
        .onboard-cta:hover { background: #059669; }
        .onboard-skip { justify-self: start; font-size: .75rem; font-weight: 600; color: #94a3b8; padding: .1rem .2rem; }
        .onboard-skip:hover { color: var(--accent); }
        .brief-box { padding: .8rem 1rem; border-radius: 1rem; background: rgba(99,102,241,.07); }
        .brief-k { font-size: .68rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #94a3b8; margin-bottom: .3rem; }
        .brief-list { list-style: disc; padding-left: 1.1rem; display: grid; gap: .15rem; }
        .brief-tag { font-size: .65rem; font-weight: 700; color: #d97706; background: rgba(245,158,11,.12); padding: .05rem .4rem; border-radius: 999px; }
        .brief-pre { white-space: pre-wrap; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .75rem; line-height: 1.5; padding: .8rem 1rem; border-radius: 1rem;
            background: rgba(15,23,42,.05); max-height: 14rem; overflow: auto; }
        .dark .brief-pre { background: rgba(255,255,255,.06); }
        .brief-stat { padding: .7rem; border-radius: 1rem; background: rgba(99,102,241,.07); }
        .brief-stat b { display: block; font-size: 1.4rem; font-weight: 900; }
        .brief-stat span { font-size: .7rem; color: #94a3b8; font-weight: 700; }
        .brief-steps { display: grid; gap: .35rem; }
        .launchers { display: grid; grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr)); gap: .5rem; margin-bottom: .75rem; }
        .launcher { display: flex; align-items: stretch; border-radius: 1rem; background: var(--bg); border: 1px solid var(--border); min-width: 0; overflow: hidden; }
        .launcher:hover { border-color: var(--accent); }
        .launcher-go { flex: 1; min-width: 0; display: flex; align-items: center; gap: .6rem; padding: .6rem .7rem; }
        .launcher-emoji { font-size: 1.35rem; line-height: 1; }
        .launcher-edit { padding: 0 .65rem; color: #94a3b8; border-left: 1px solid var(--border); }
        .launcher-edit:hover { color: var(--accent); }
        .snip-list { display: grid; gap: .4rem; }
        .snip { display: flex; align-items: center; border-radius: .9rem; background: var(--bg); border: 1px solid var(--border); min-width: 0; }
        .snip:hover { border-color: #d946ef; }
        .snip-copy { flex: 1; min-width: 0; display: flex; align-items: center; gap: .6rem; padding: .55rem .7rem; }
        .snip-act { padding: .4rem .55rem; color: #94a3b8; flex-shrink: 0; }
        .snip-act:hover { color: #ef4444; }
        .snip-seed { padding: .4rem .75rem; border-radius: 999px; background: var(--bg); border: 1px solid var(--border); font-weight: 600; font-size: .8rem; }
        .snip-seed:hover { border-color: #d946ef; }
        .seg { display: inline-flex; padding: .15rem; border-radius: .7rem; background: var(--bg); border: 1px solid var(--border); }
        .seg button { padding: .25rem .55rem; border-radius: .55rem; font-size: .7rem; font-weight: 700; color: #64748b; }
        .seg button.on { background: var(--surface); color: inherit; box-shadow: 0 1px 2px rgba(0,0,0,.08); }
        .seg-select { font-size: .7rem; font-weight: 700; background: transparent; border: 0; color: #64748b; padding: .2rem; }
        .money-totals { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .5rem; margin-bottom: .75rem; }
        .money-totals > div { padding: .55rem .7rem; border-radius: .9rem; background: rgba(132,204,22,.1); min-width: 0; }
        .money-totals b { display: block; font-size: 1rem; font-weight: 900; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .money-totals span { font-size: .68rem; color: #94a3b8; font-weight: 700; }
        .money-list { display: grid; gap: .3rem; margin: .5rem 0; max-height: 15rem; overflow: auto; }
        .money-row { display: flex; align-items: center; gap: .5rem; padding: .35rem .2rem .35rem .6rem; border-radius: .8rem; }
        .money-row:hover { background: var(--bg); }
        .money-form { display: flex; flex-wrap: wrap; gap: .4rem; margin-top: .5rem; }
        .money-form .widget-input { padding: .55rem .7rem; font-size: .85rem; border-radius: .8rem; }
        .money-add { width: 2.6rem; min-height: 2.6rem; flex-shrink: 0; border-radius: .8rem; background: #65a30d; color: #fff; display: grid; place-items: center; }
        .money-add:hover { background: #4d7c0f; }
        .agenda { display: grid; grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr)); gap: .75rem; }
        .agenda-day { padding: .75rem .85rem; border-radius: 1rem; background: var(--bg); border: 1px solid var(--border); min-width: 0; }
        .agenda-day.is-today { border-color: #0ea5e9; box-shadow: 0 0 0 1px #0ea5e9 inset; }
        .agenda-date { font-size: .72rem; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; color: #0284c7; margin-bottom: .4rem; }
        .agenda-items { display: grid; gap: .35rem; }
        .agenda-item { display: flex; gap: .6rem; align-items: baseline; min-width: 0; }
        .agenda-item.past { opacity: .45; }
        .agenda-item.now .agenda-time { color: #fff; background: #0ea5e9; }
        .agenda-time { flex-shrink: 0; width: 3.9rem; font-size: .7rem; font-weight: 700; color: #64748b; padding: .05rem .3rem; border-radius: .4rem; text-align: center; }
    `;
    document.head.appendChild(css);
})();

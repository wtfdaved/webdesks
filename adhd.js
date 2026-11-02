// ═══════════════════════════════════════════════════════════════
// ADHD MODE — WebDesks built around the five ADHD friction points (v0.33).
//
// Starting, time blindness, overwhelm, shame and working memory. Each
// feature below answers one of them:
//
//  1. Pick 1 For Me      — a spin that hides the list, picks ONE task or
//                          chore that matches your Low / Med / High energy
//                          and starts a 5-minute starter timer.
//  2. What fits?         — free minutes before your next calendar event
//                          (WebDesks Calendar + your connected .ics feed),
//                          one task that fits, and a transition alarm.
//                          Includes a plain-English guide to .ics links.
//  3. Fresh Start        — sweep every overdue task and chore into the
//                          Someday Vault in one click. Streaks untouched.
//  4. Trial rescue       — free trials and "return by" dates in Bills, with
//                          an urgent countdown pinned to the Dashboard from
//                          48 hours before the charge.
//  5. Just 5 minutes     — a micro-start next to the 25m/45m/50m timers, and
//                          a gentle "keep going or bank your win?" prompt.
//  6. Tiny steps ⚡       — split any task, chore or priority into
//                          3-minute micro-checkboxes.
//  7. Focus Tunnel       — "Start" on a priority hides everything except
//                          that one thing, a countdown bar, Scratchpad (or a
//                          calculator) and the Sounds player.
//  8. Day depleting bar  — a thin bar across the top showing how much of
//                          your workday has gone, plus an optional soft
//                          chime every 30 / 60 minutes.
//  9. Where was I?       — a resume card on the Dashboard after interruptions.
// 10. Doom pile          — brain-dump from anywhere (B, or the Today box),
//                          then sort it with single keys: T C B P ⌫.
//
// Storage (synced with the Desk unless noted):
//   wd_someday        Someday Vault items
//   wd_rescues        free trials / return-by dates
//   wd_doom           the doom pile (unsorted brain-dump lines)
//   wd_daybar         workday bar + chime settings
//   wd_micro_wins     5-minute starts you banked
// This device only (not synced):
//   wdl_where         last place you were working ("Where was I?")
//   wdl_focus_task    the one thing you're working on right now
//   wdl_transition    pending transition alarm
// ═══════════════════════════════════════════════════════════════
(() => {
    const $ = id => document.getElementById(id);
    const esc = s => app.escapeHtml(String(s ?? ''));
    const pad = n => String(n).padStart(2, '0');
    const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const today = () => ymd(new Date());
    const parseDay = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
    const addDays = (s, n) => { const d = parseDay(s); d.setDate(d.getDate() + n); return ymd(d); };
    const readLocal = (k, fb) => { try { return JSON.parse(localStorage.getItem(k)) ?? fb; } catch (e) { return fb; } };
    const writeLocal = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { app.showToast('Storage is full — export something and clear space'); } };
    const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const clockTime = d => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    const dur = mins => {
        mins = Math.max(0, Math.round(mins));
        if (mins < 60) return `${mins} min`;
        const h = Math.floor(mins / 60), m = mins % 60;
        return m ? `${h}h ${m}m` : `${h}h`;
    };
    const ago = ms => {
        const m = Math.round(ms / 60000);
        if (m < 1) return 'just now';
        if (m < 60) return `${m}m ago`;
        const h = Math.floor(m / 60);
        return h < 24 ? `${h}h ${m % 60 ? (m % 60) + 'm ' : ''}ago` : `${Math.floor(h / 24)}d ago`;
    };
    const reducedMotion = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const typing = () => {
        const a = document.activeElement;
        return a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName));
    };

    const ENERGY = { 1: { icon: '🔋', label: 'Low' }, 2: { icon: '⚡', label: 'Medium' }, 3: { icon: '🔥', label: 'High' } };
    const TOOL_NAMES = id => {
        const it = (app.searchItems || []).find(i => i.id === id);
        return it ? it.label.replace(/ —.*$/, '').replace(/ \(.*\)$/, '') : id;
    };

    // ── Tiny steps: 3-minute recipes for the tasks that freeze people ──
    const RECIPES = [
        [/\b(clean|tidy|declutter|reset)\b.*\b(apartment|flat|house|home|place|room|bedroom|living room|kitchen|office|desk|car)\b|\bclean(ing)? (up|the place)\b/i, [
            'Pick up trash only', 'Put dishes near the sink', 'Wipe one counter', 'Gather clothes into one pile',
            'Clear one surface (table or desk)', 'Put 5 things back where they live', 'Take the trash out', 'Quick sweep where you walk most']],
        [/\btax(es)?\b|\birs\b|\bhmrc\b/i, [
            'Make a folder called "Taxes"', 'Find last year\'s return — just find it', 'Drop every W-2 / 1099 / income form in the folder',
            'List big deductible costs on one note', 'Pick how you\'ll file (software or a person)', 'Open the software and log in',
            'Fill in only the personal-info page', 'Enter one income form', 'Save and stop — that counts']],
        [/\b(e-?mails?|inbox|messages|slack)\b/i, [
            'Open the inbox (only open it)', 'Archive everything older than a month', 'Reply to one easy message',
            'Star the 3 that need real answers', 'Answer one starred message', 'Unsubscribe from one newsletter']],
        [/\blaundry|wash(ing)? clothes|fold(ing)?\b/i, [
            'Carry the laundry to the machine', 'Load it and press start', 'Set a timer for when it finishes',
            'Move it to the dryer or rack', 'Fold just the shirts', 'Put away one pile']],
        [/\bdish(es)?\b|\bdishwasher\b/i, ['Clear the sink', 'Load or wash 5 items', 'Load or wash 5 more', 'Start the dishwasher / rack the rest', 'Wipe the sink']],
        [/\b(write|draft|essay|report|paper|blog|article|proposal|thesis|post|cover letter)\b/i, [
            'Open a blank doc and give it a name', 'Write a messy one-line goal', 'List 3 bullet points',
            'Write one ugly sentence per bullet', 'Add one more sentence anywhere', 'Read it once — fix nothing yet']],
        [/\b(call|phone|ring|book|appointment|schedule|dentist|doctor|vet|haircut)\b/i, [
            'Find the number or booking page', 'Write what you need in one line', 'Pick two times that work for you',
            'Call / open the booking page', 'Put it in your calendar right away']],
        [/\b(grocer(y|ies)|shopping|groceries|supermarket|errands?)\b/i, [
            'Check the fridge for one minute', 'Write 5 must-haves', 'Add ingredients for 3 easy meals',
            'Grab bags, keys and wallet', 'Go — the list does the thinking']],
        [/\b(study|homework|revise|revision|exam|test|assignment|learn|course|lecture)\b/i, [
            'Open the material to the right page', 'Read only the headings', 'Do one practice question',
            'Write 3 things you remember', 'Do one more question', 'Note where to start next time']],
        [/\b(pay|bill|budget|bank|invoice|refund|insurance|subscription)\b/i, [
            'Open the account or the bill', 'Check the amount and due date', 'Pay it or switch on autopay',
            'Save the confirmation (screenshot is fine)', 'Mark it paid in WebDesks']],
        [/\b(pack|packing|move|moving|unpack)\b/i, ['Grab one box or bag', 'Pack one drawer only', 'Label the box', 'Pack one shelf', 'Stack the box by the door']],
        [/\b(apply|application|job|resume|résumé|cv|interview)\b/i, [
            'Open your résumé', 'Update one line', 'Find one job post', 'Copy the job title into a note',
            'Write 2 sentences on why you fit', 'Hit apply (good enough is enough)']],
        [/\b(workout|exercise|gym|run|walk|yoga|stretch)\b/i, ['Put on workout clothes', 'Fill your water bottle', 'Stretch for one minute', 'Move for 3 minutes', 'Decide: stop here or keep going?']],
        [/\b(cook|dinner|lunch|breakfast|meal|bake|recipe)\b/i, ['Pick the meal', 'Take out every ingredient', 'Chop one thing', 'Turn on the stove or oven', 'Cook the main part', 'Put one dish in the sink after']],
        [/\b(organi[sz]e|sort|closet|drawer|garage|paperwork|files|documents)\b/i, ['Pick ONE drawer, shelf or pile', 'Take everything out', 'Toss obvious trash', 'Make a "keep" and a "go" pile', 'Put the keep pile back', 'Bag the go pile and put it by the door']],
        [/\b(fix|repair|install|set ?up|update|upgrade)\b/i, ['Find the thing / open the app', 'Search for how to do it (2 min max)', 'Gather the tools or logins', 'Do the first step only', 'Test it once']]
    ];
    const tinyStepsFor = text => {
        const t = String(text || '');
        const hit = RECIPES.find(([re]) => re.test(t));
        if (hit) return hit[1].slice();
        const short = t.length > 40 ? t.slice(0, 38) + '…' : t;
        return ['Get what you need in front of you', 'Decide what "done" looks like (one line)',
            `Do the very first tiny piece of “${short}”`, 'Do the next tiny piece', 'Check: is it good enough? Then stop'];
    };

    const orig = {
        init: app.init, switchTab: app.switchTab, renderTasks: app.renderTasks, renderToday: app.renderToday,
        renderChores: app.renderChores, renderBills: app.renderBills, choreRow: app._choreRow,
        completeTimer: app.completeTimer, todayQuickAdd: app.todayQuickAdd, onLifeTab: app.onLifeTab,
        paletteItems: app._paletteItems
    };

    Object.assign(app, {
        // ═══════════════════════════════════════════════════════
        // Shared: "items" are tasks, chores and today's top-3
        // priorities, addressed as { kind, id }.
        // ═══════════════════════════════════════════════════════
        _adItem(kind, id) {
            if (kind === 'task') {
                const t = (this.tasks || []).find(x => String(x.id) === String(id));
                return t ? { kind, id: t.id, title: t.text, energy: t.energy || 0, mins: this._taskMins(t), done: !!t.done, ref: t } : null;
            }
            if (kind === 'chore') {
                const c = (this.chores || []).find(x => x.id === id);
                return c ? { kind, id: c.id, title: c.name, energy: c.energy || 2, mins: c.mins || 10, done: c.lastDone === today(), ref: c } : null;
            }
            if (kind === 'top' && this._checkin) {
                const p = this._checkin().top[Number(id)];
                return p && p.t ? { kind, id: Number(id), title: p.t, energy: 0, mins: p.steps && p.steps.length ? p.steps.length * 3 : 25, done: !!p.d, ref: p } : null;
            }
            return null;
        },
        _taskMins(t) { return t.mins || (t.steps && t.steps.length ? t.steps.length * 3 : 15); },
        _adComplete(item) {
            if (!item) return;
            if (item.kind === 'task') {
                const i = this.tasks.findIndex(x => x.id === item.id);
                if (i >= 0 && !this.tasks[i].done) { this.toggleTask(i); if (this._celebrate) this._celebrate('Done! That was the hard part. 🎉'); }
            } else if (item.kind === 'chore') {
                const c = this.chores.find(x => x.id === item.id);
                if (c && c.lastDone !== today()) this.completeChore(c.id);
            } else if (item.kind === 'top') {
                this.todaySetTop(item.id, 'd', true);
            }
            const f = readLocal('wdl_focus_task', null);
            if (f && f.kind === item.kind && String(f.id) === String(item.id)) localStorage.removeItem('wdl_focus_task');
        },
        _setFocusTask(item) {
            if (!item) return;
            writeLocal('wdl_focus_task', { kind: item.kind, id: item.id, title: item.title, at: Date.now() });
        },

        // ═══════════════════════════════════════════════════════
        // 1. PICK 1 FOR ME (spin)
        // ═══════════════════════════════════════════════════════
        _pickPool(level, scope = 'all') {
            const t = today();
            const pool = [];
            if (scope !== 'chores') {
                (this.tasks || []).forEach(x => {
                    if (x.done) return;
                    const due = x.date && x.date <= t;
                    if (x.date && !due) return; // future tasks can wait
                    pool.push({ kind: 'task', id: x.id, title: x.text, energy: x.energy || 2, mins: this._taskMins(x), weight: due ? 3 : 1, why: due ? (x.date < t ? 'carried over' : 'due today') : 'from your inbox' });
                });
                if (this._checkin) this._checkin().top.forEach((p, i) => {
                    if (p.t && !p.d) pool.push({ kind: 'top', id: i, title: p.t, energy: 2, mins: 25, weight: 5, why: 'one of today\'s top 3' });
                });
            }
            if (scope !== 'tasks' && this._choreSchedule) {
                (this._choreSchedule(t, 1)[t] || []).filter(x => !x.doneToday).forEach(x => {
                    pool.push({ kind: 'chore', id: x.chore.id, title: x.chore.name, energy: x.chore.energy || 2, mins: x.chore.mins, weight: 2, why: 'chore for today' });
                });
            }
            const fits = pool.filter(p => p.energy <= level);
            return fits.length ? fits : pool.sort((a, b) => a.energy - b.energy || a.mins - b.mins).slice(0, 3);
        },
        _weightedPick(pool, avoid) {
            const list = pool.filter(p => !avoid || !avoid.has(p.kind + ':' + p.id));
            const src = list.length ? list : pool;
            const total = src.reduce((s, p) => s + p.weight, 0);
            let r = Math.random() * total;
            for (const p of src) { r -= p.weight; if (r <= 0) return p; }
            return src[src.length - 1];
        },
        openPickOne(scope = 'all') {
            let level = (this._checkin && this._checkin().energy) || 2;
            const avoid = new Set();
            let current = null;
            this.lifeModal('🎡 Pick 1 for me', `
                <p class="text-sm text-slate-500 mb-3">The list is hidden. Tell me your energy and I'll pick <b>one</b> thing. Then just do 5 minutes of it.</p>
                <div class="seg-big mb-4" role="radiogroup" aria-label="Your energy right now">
                    ${[1, 2, 3].map(l => `<button role="radio" data-lv="${l}" aria-checked="${l === level}" class="${l === level ? 'on' : ''}">${ENERGY[l].icon} ${ENERGY[l].label}</button>`).join('')}
                </div>
                <div id="spin-window" class="spin-window" aria-live="polite"><span class="spin-q">?</span></div>
                <div id="spin-meta" class="text-xs text-slate-400 text-center mt-2 min-h-[1rem]"></div>
                <div id="spin-actions" class="grid gap-2 mt-4">
                    <button id="spin-go" class="${this._btnCls} w-full text-lg py-3">🎡 Spin</button>
                </div>`, wrap => {
                const win = wrap.querySelector('#spin-window'), meta = wrap.querySelector('#spin-meta'), acts = wrap.querySelector('#spin-actions');
                wrap.querySelectorAll('[data-lv]').forEach(b => b.onclick = () => {
                    level = Number(b.dataset.lv);
                    wrap.querySelectorAll('[data-lv]').forEach(x => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-checked', String(on)); });
                    if (this._checkin) { this._checkin().energy = level; this._saveCheckins(); }
                });
                const spin = () => {
                    const pool = this._pickPool(level, scope);
                    if (!pool.length) {
                        win.innerHTML = '<span class="spin-name">Nothing waiting. 🎉</span>';
                        meta.textContent = 'No tasks due, no chores today. Add something or enjoy the break.';
                        return;
                    }
                    const pick = this._weightedPick(pool, avoid);
                    avoid.add(pick.kind + ':' + pick.id);
                    const land = () => {
                        current = pick;
                        win.innerHTML = `<span class="spin-name landed">${esc(pick.title)}</span>`;
                        meta.textContent = `${ENERGY[pick.energy] ? ENERGY[pick.energy].icon + ' ' + ENERGY[pick.energy].label + ' energy · ' : ''}~${dur(pick.mins)} · ${pick.why}`;
                        acts.innerHTML = `
                            <button data-a="start" class="${this._btnCls} w-full text-lg py-3">▶ Start a 5-minute starter</button>
                            <div class="grid grid-cols-2 gap-2">
                                <button data-a="steps" class="${this._ghostBtnCls}">⚡ Tiny steps</button>
                                <button data-a="again" class="${this._ghostBtnCls}">🎡 Not this one</button>
                            </div>`;
                        acts.querySelector('[data-a=start]').onclick = () => { this.closeLifeModal(); this.openTunnel(pick, 5); };
                        acts.querySelector('[data-a=steps]').onclick = () => this.openTinySteps(pick.kind, pick.id);
                        acts.querySelector('[data-a=again]').onclick = spin;
                        this.vibrate && this.vibrate([20, 30, 40]);
                    };
                    if (reducedMotion() || pool.length < 2) return land();
                    // Slot-machine style: names flicker, slow down, land.
                    acts.innerHTML = '<button class="' + this._ghostBtnCls + ' w-full" disabled>Spinning…</button>';
                    let i = 0, delay = 45;
                    const step = () => {
                        const p = pool[i++ % pool.length];
                        win.innerHTML = `<span class="spin-name blur">${esc(p.title)}</span>`;
                        delay *= 1.17;
                        if (delay < 340) setTimeout(step, delay); else land();
                    };
                    step();
                };
                wrap.querySelector('#spin-go').onclick = spin;
            });
        },

        // ═══════════════════════════════════════════════════════
        // 2. WHAT FITS BEFORE MY NEXT EVENT? (+ .ics guide)
        // ═══════════════════════════════════════════════════════
        _nextEvent() {
            const now = new Date();
            const horizon = new Date(now.getTime() + 16 * 3600000);
            const out = [];
            (this.calEvents || []).forEach(e => {
                if (!e || e.allDay || !e.start || e.start.length < 16) return;
                const s = new Date(e.start);
                if (!isNaN(s) && s > now && s < horizon) out.push({ title: e.title || 'Event', start: s, src: 'WebDesks Calendar' });
            });
            (this._agendaCache || []).forEach(e => {
                if (!e.allDay && e.start > now && e.start < horizon) out.push({ title: e.title || 'Event', start: e.start, src: 'your calendar' });
            });
            out.sort((a, b) => a.start - b.start);
            return out[0] || null;
        },
        _bridgeState() {
            const now = new Date();
            const ev = this._nextEvent();
            const set = this._daybarPrefs();
            const [eh, em] = set.end.split(':').map(Number);
            const endOfDay = new Date(now); endOfDay.setHours(eh, em, 0, 0);
            let free, until;
            if (ev && (ev.start.toDateString() === now.toDateString() || ev.start - now < 3 * 3600000)) { free = (ev.start - now) / 60000; until = ev; }
            else if (endOfDay > now) { free = (endOfDay - now) / 60000; until = null; }
            else { free = null; until = null; }
            return { ev: until, free, endOfDay, connected: !!(localStorage.getItem('wd_ics_url') || '').trim() };
        },
        _bridgeSuggest(free, skip) {
            const level = (this._checkin && this._checkin().energy) || 2;
            const room = Math.max(3, free - 5); // leave 5 minutes to switch
            const pool = this._pickPool(3).filter(p => !skip || !skip.has(p.kind + ':' + p.id));
            const fit = pool.filter(p => p.mins <= room);
            const ranked = (fit.length ? fit : pool).sort((a, b) => (b.weight - a.weight) || ((a.energy > level) - (b.energy > level)) || (b.mins - a.mins));
            return ranked[0] ? Object.assign({}, ranked[0], { tooBig: !fit.length }) : null;
        },
        _bridgeHtml(where) {
            const st = this._bridgeState();
            const skip = this._bridgeSkip || (this._bridgeSkip = new Set());
            const tr = readLocal('wdl_transition', null);
            const trOn = tr && tr.at > Date.now();
            const help = `<button class="ad-link" data-b="ics">What's an .ics link?</button>`;
            if (st.free == null) {
                return `<div class="ad-card-h"><span>⏳ What fits before my next event?</span>${help}</div>
                    <p class="text-sm text-slate-500">Your workday is over. 🌙 Rest is part of the plan.</p>
                    ${!st.connected ? `<button class="ad-btn ghost mt-3" data-b="connect">📅 Connect my calendar</button>` : ''}`;
            }
            const sug = this._bridgeSuggest(st.free, skip);
            const head = st.ev
                ? `You have <b class="ad-big">${dur(st.free)}</b> before <b>${esc(st.ev.title)}</b> at ${esc(clockTime(st.ev.start))}.`
                : `No more events ${st.connected || (this.calEvents || []).length ? 'today' : 'that I know of'} — <b class="ad-big">${dur(st.free)}</b> until your workday ends (${esc(clockTime(st.endOfDay))}).`;
            const runMins = sug ? Math.max(5, Math.min(sug.mins, 25, Math.floor(st.free - 5))) : 0;
            return `<div class="ad-card-h"><span>⏳ What fits before my next event?</span>${help}</div>
                <p class="text-sm">${head}</p>
                ${st.free < 8 && st.ev ? '<p class="text-xs text-slate-500 mt-1">Not enough time to start something big — get water, stretch, open what you need for the meeting.</p>' : sug ? `
                <div class="ad-sug">
                    <div class="min-w-0"><div class="text-[11px] font-bold uppercase tracking-widest text-slate-400">${sug.tooBig ? 'Start a piece of' : 'This fits'}</div>
                        <div class="font-bold truncate">${esc(sug.title)}</div>
                        <div class="text-[11px] text-slate-400">~${dur(sug.mins)}${sug.tooBig ? ' total — do the first 3-minute steps' : ''} · ${esc(sug.why)}</div></div>
                    <div class="flex gap-1.5 shrink-0">
                        <button class="ad-btn" data-b="start" data-k="${sug.kind}" data-id="${esc(sug.id)}" data-m="${runMins}">▶ ${runMins} min</button>
                        <button class="ad-btn ghost" data-b="other" data-k="${sug.kind}" data-id="${esc(sug.id)}" title="Suggest something else" aria-label="Suggest something else">↻</button>
                    </div>
                </div>` : '<p class="text-xs text-slate-500 mt-1">Nothing on your list — enjoy the free time or brain-dump what\'s on your mind.</p>'}
                ${st.ev ? `<div class="ad-trans">
                    ${trOn ? `<span>🔔 Transition alarm at <b>${esc(clockTime(new Date(tr.at)))}</b> (${tr.lead} min before)</span><button class="ad-link" data-b="trans-off">Cancel</button>`
                        : `<span>🔔 Transition alarm</span>${[5, 10, 15].map(m => `<button class="ad-chip" data-b="trans" data-m="${m}" ${st.free <= m ? 'disabled' : ''}>${m} min before</button>`).join('')}`}
                </div>` : ''}
                ${!st.connected ? `<div class="ad-connect"><span>${(this.calEvents || []).length ? 'Using events from WebDesks Calendar.' : 'I can\'t see your meetings yet.'} Connect Google, Outlook or Apple to count around them.</span><button class="ad-btn ghost" data-b="connect">📅 Connect</button></div>` : ''}`;
        },
        renderBridge(el, where) {
            if (!el) return;
            el.innerHTML = this._bridgeHtml(where);
            el.onclick = e => {
                const b = e.target.closest('[data-b]');
                if (!b) return;
                const a = b.dataset.b;
                if (a === 'ics' || a === 'connect') this.openIcsGuide();
                if (a === 'start') {
                    const it = this._adItem(b.dataset.k, b.dataset.k === 'task' ? Number(b.dataset.id) : b.dataset.k === 'top' ? Number(b.dataset.id) : b.dataset.id);
                    if (it) this.openTunnel(it, Number(b.dataset.m) || 25);
                }
                if (a === 'other') { this._bridgeSkip.add(b.dataset.k + ':' + b.dataset.id); this.renderBridge(el, where); }
                if (a === 'trans') this.setTransitionAlarm(Number(b.dataset.m));
                if (a === 'trans-off') { localStorage.removeItem('wdl_transition'); clearTimeout(this._transT); this.renderBridges(); this.showToast('Transition alarm cancelled'); }
            };
        },
        renderBridges() {
            this.renderBridge($('ad-bridge-today'), 'today');
            this.renderBridge($('ad-bridge-cal'), 'calendar');
        },
        setTransitionAlarm(lead) {
            const ev = this._nextEvent();
            if (!ev) return;
            const at = ev.start.getTime() - lead * 60000;
            if (at <= Date.now()) { this.showToast('That time has already passed'); return; }
            writeLocal('wdl_transition', { at, lead, title: ev.title, start: ev.start.getTime() });
            this._armTransition();
            if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
            this.renderBridges();
            this.showToast(`🔔 I'll nudge you at ${clockTime(new Date(at))} to wrap up`);
        },
        _armTransition() {
            clearTimeout(this._transT);
            const tr = readLocal('wdl_transition', null);
            if (!tr) return;
            const wait = tr.at - Date.now();
            if (wait < -5 * 60000) { localStorage.removeItem('wdl_transition'); return; }
            this._transT = setTimeout(() => this._fireTransition(), Math.max(0, Math.min(wait, 2147483000)));
        },
        _fireTransition() {
            const tr = readLocal('wdl_transition', null);
            localStorage.removeItem('wdl_transition');
            if (!tr) return;
            this.chime(3);
            const msg = `${tr.title} starts in ${tr.lead} minutes`;
            if ('Notification' in window && Notification.permission === 'granted') { try { new Notification('⏰ Time to wrap up', { body: msg, tag: 'wd-transition' }); } catch (e) {} }
            this.vibrate && this.vibrate([200, 100, 200]);
            const f = readLocal('wdl_focus_task', null);
            this.lifeModal('⏰ Time to wrap up', `
                <p class="text-lg font-bold mb-1">${esc(msg)}.</p>
                <p class="text-sm text-slate-500 mb-4">Leave yourself a breadcrumb so future-you can pick straight back up.</p>
                <textarea id="tr-note" rows="2" class="${this._inputCls} text-sm" placeholder="I stopped at… next I'll…"></textarea>
                <div class="flex gap-2 mt-3"><button id="tr-save" class="${this._btnCls} flex-1">Save & wrap up</button><button onclick="app.closeLifeModal()" class="${this._ghostBtnCls}">Dismiss</button></div>`, wrap => {
                wrap.querySelector('#tr-save').onclick = () => {
                    const v = wrap.querySelector('#tr-note').value.trim();
                    const where = readLocal('wdl_where', {}) || {};
                    where.note = v; where.at = Date.now();
                    if (f && !where.task) where.task = f.title;
                    writeLocal('wdl_where', where);
                    if (this.timerRunning) this.pauseTimer();
                    this.closeLifeModal();
                    this.showToast('Saved. It\'ll be on your Dashboard when you\'re back.');
                };
            });
            this.renderBridges();
        },
        openIcsGuide() {
            const url = localStorage.getItem('wd_ics_url') || '';
            const steps = {
                google: ['Open <b>calendar.google.com</b> on a computer.', 'Click the ⚙️ gear → <b>Settings</b>.', 'On the left, under "Settings for my calendars", click your calendar\'s name.', 'Scroll to <b>Integrate calendar</b>.', 'Copy <b>Secret address in iCal format</b> (ends in <code>.ics</code>).'],
                outlook: ['Open <b>outlook.com</b> (or Outlook on the web for work).', '⚙️ Settings → <b>Calendar</b> → <b>Shared calendars</b>.', 'Under <b>Publish a calendar</b>, pick your calendar and "Can view all details".', 'Click <b>Publish</b>, then copy the <b>ICS</b> link.'],
                apple: ['Open the <b>Calendar</b> app on iPhone or Mac (or icloud.com).', 'Tap ⓘ / the share icon next to your calendar.', 'Turn on <b>Public Calendar</b>.', 'Tap <b>Share Link…</b> → Copy (it starts with <code>webcal://</code>).']
            };
            this.lifeModal('📅 Connect your calendar', `
                <div class="ics-explain">
                    <p><b>An .ics link is a private, read-only web address for your calendar.</b> Think of it as a window: Google, Outlook or Apple keep it up to date, and WebDesks peeks through it to see <i>when you're busy</i> — so it can tell you how many free minutes you really have.</p>
                    <ul>
                        <li>👀 <b>Read-only</b> — WebDesks can't add, change or delete anything.</li>
                        <li>🔒 <b>Private</b> — the link is like a password. Don't post it publicly.</li>
                        <li>🔄 <b>Live</b> — new meetings show up automatically (refreshes every 30 min).</li>
                    </ul>
                </div>
                <div class="seg-big my-3" role="tablist" aria-label="Calendar app">
                    <button data-p="google" class="on">Google</button><button data-p="outlook">Outlook</button><button data-p="apple">Apple</button>
                </div>
                <ol id="ics-steps" class="ics-steps"></ol>
                ${this._field('Paste the link here', `<input id="ics-url" type="url" inputmode="url" class="${this._inputCls}" value="${esc(url)}" placeholder="https://… .ics   or   webcal://…">`)}
                <div class="flex gap-2"><button id="ics-save" class="${this._btnCls} flex-1">${url ? 'Update' : 'Connect'} calendar</button>${url ? '<button id="ics-rm" class="' + this._ghostBtnCls + '">Disconnect</button>' : ''}</div>
                <p class="text-[11px] text-slate-400 mt-3">Rather not connect? Add meetings in WebDesks <button class="ad-link" onclick="app.closeLifeModal(); app.switchTab('calendar')">Calendar</button> — "What fits?" counts those too.</p>`, wrap => {
                const show = p => {
                    wrap.querySelector('#ics-steps').innerHTML = steps[p].map(s => `<li>${s}</li>`).join('');
                    wrap.querySelectorAll('[data-p]').forEach(b => b.classList.toggle('on', b.dataset.p === p));
                };
                show('google');
                wrap.querySelectorAll('[data-p]').forEach(b => b.onclick = () => show(b.dataset.p));
                wrap.querySelector('#ics-save').onclick = () => {
                    const v = wrap.querySelector('#ics-url').value.trim();
                    if (!/^(https?|webcals?):\/\//i.test(v)) { this.showToast('Paste the full link — it starts with https:// or webcal://'); return; }
                    localStorage.setItem('wd_ics_url', v);
                    this.closeLifeModal();
                    this.showToast('📅 Connecting… your meetings will appear in a moment');
                    if (this.refreshAgenda) this.refreshAgenda(true).then(() => this.renderBridges()).catch(() => {});
                };
                const rm = wrap.querySelector('#ics-rm');
                if (rm) rm.onclick = () => {
                    localStorage.removeItem('wd_ics_url'); localStorage.removeItem('wdl_ics_cache');
                    this._agendaCache = null;
                    if (this.renderAgenda) this.renderAgenda();
                    this.closeLifeModal(); this.renderBridges();
                    this.showToast('Calendar disconnected');
                };
            });
        },

        // ═══════════════════════════════════════════════════════
        // 3. FRESH START → SOMEDAY VAULT
        // ═══════════════════════════════════════════════════════
        _vault() { return readLocal('wd_someday', []); },
        _overdue() {
            const t = today();
            const tasks = (this.tasks || []).filter(x => !x.done && x.date && x.date < t);
            const chores = this._choreSchedule ? (this._choreSchedule(t, 1)[t] || []).filter(x => x.overdue && !x.doneToday).map(x => x.chore) : [];
            return { tasks, chores, n: tasks.length + chores.length };
        },
        freshStart(scope = 'all') {
            const o = this._overdue();
            const tasks = scope === 'chores' ? [] : o.tasks;
            const chores = scope === 'tasks' ? [] : o.chores;
            const n = tasks.length + chores.length;
            if (!n) { this.showToast('Nothing overdue — you\'re already fresh 🌱'); return; }
            this.lifeModal('🌱 Fresh start', `
                <p class="text-lg font-bold mb-2">Sweep ${n} overdue thing${n > 1 ? 's' : ''} into your Someday Vault?</p>
                <ul class="text-sm text-slate-500 space-y-1 mb-4">
                    <li>✓ Nothing is deleted — pull anything back whenever you like.</li>
                    <li>✓ Your streaks and points stay exactly as they are.</li>
                    <li>✓ Today starts clean. Missing a day isn't failing.</li>
                </ul>
                <div class="text-xs text-slate-400 mb-4 max-h-32 overflow-auto">${tasks.map(t => `<div>• ${esc(t.text)}</div>`).join('')}${chores.map(c => `<div>• 🧹 ${esc(c.name)}</div>`).join('')}</div>
                <div class="flex gap-2"><button id="fs-go" class="${this._btnCls} flex-1">🌱 Fresh start</button><button onclick="app.closeLifeModal()" class="${this._ghostBtnCls}">Not now</button></div>`, wrap => {
                wrap.querySelector('#fs-go').onclick = () => {
                    const vault = this._vault();
                    const at = Date.now();
                    tasks.forEach(t => vault.push({ vid: uid(), kind: 'task', title: t.text, from: t.date, at, data: Object.assign({}, t) }));
                    const ids = new Set(tasks.map(t => t.id));
                    this.tasks = this.tasks.filter(t => !ids.has(t.id));
                    chores.forEach(c => { c.paused = true; c.vaulted = at; vault.push({ vid: uid(), kind: 'chore', title: c.name, id: c.id, at }); });
                    writeLocal('wd_someday', vault);
                    const log = readLocal('wd_fresh_starts', []); log.push({ at, n }); writeLocal('wd_fresh_starts', log.slice(-50));
                    if (chores.length) this._saveChores();
                    this.closeLifeModal();
                    this.renderTasks();
                    if (this.currentTab === 'chores') this.renderChores();
                    this._celebrate && this._celebrate(`🌱 Fresh start! ${n} thing${n > 1 ? 's are' : ' is'} safe in the Someday Vault.`);
                };
            });
        },
        openVault() {
            const render = () => {
                const v = this._vault();
                return v.length ? `<p class="text-sm text-slate-500 mb-3">Parked, not failed. Bring something back when you have room for it.</p>
                    <div class="divide-y divide-slate-200/60 dark:divide-slate-700/60">${v.slice().reverse().map(x => `
                        <div class="flex items-center gap-2 py-2">
                            <span class="flex-1 min-w-0"><span class="block truncate font-medium">${x.kind === 'chore' ? '🧹 ' : ''}${esc(x.title)}</span>
                                <span class="text-[11px] text-slate-400">parked ${new Date(x.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span></span>
                            <button class="ad-chip" data-v="today" data-id="${x.vid}">→ Today</button>
                            ${x.kind === 'task' ? `<button class="ad-chip" data-v="inbox" data-id="${x.vid}">Inbox</button>` : ''}
                            <button class="ad-chip muted" data-v="drop" data-id="${x.vid}" title="Let it go (delete)">Let go</button>
                        </div>`).join('')}</div>
                    <div class="flex gap-2 mt-4"><button class="${this._ghostBtnCls} text-sm" data-v="all-inbox">Bring all back to inbox</button></div>`
                    : '<div class="text-center py-6"><div class="text-4xl mb-2">🗄️</div><p class="text-slate-500">The Someday Vault is empty.</p><p class="text-xs text-slate-400 mt-1">"Fresh start" parks overdue things here instead of shaming you with red badges.</p></div>';
            };
            const restore = (x, where) => {
                if (x.kind === 'task') {
                    const t = Object.assign({}, x.data, { date: where === 'today' ? today() : '', done: false });
                    if (this.tasks.some(y => y.id === t.id)) t.id = this._taskId ? this._taskId() : Date.now();
                    this.tasks.push(t);
                } else {
                    const c = this.chores.find(y => y.id === x.id);
                    if (c) { c.paused = false; delete c.vaulted; c.nextDue = today(); c.snooze = ''; }
                }
            };
            this.lifeModal('🗄️ Someday Vault', `<div id="vault-body">${render()}</div>`, wrap => {
                const host = wrap.querySelector('#vault-body');
                host.onclick = e => {
                    const b = e.target.closest('[data-v]');
                    if (!b) return;
                    let v = this._vault();
                    const act = b.dataset.v;
                    if (act === 'all-inbox') { v.forEach(x => restore(x, 'inbox')); v = []; }
                    else {
                        const x = v.find(y => y.vid === b.dataset.id);
                        if (!x) return;
                        if (act === 'drop') {
                            if (x.kind === 'chore') { const c = this.chores.find(y => y.id === x.id); if (c) { c.paused = false; delete c.vaulted; this.chores = this.chores.filter(y => y.id !== x.id); } }
                        } else restore(x, act);
                        v = v.filter(y => y !== x);
                    }
                    writeLocal('wd_someday', v);
                    this._saveChores && this._saveChores();
                    this.renderTasks();
                    if (this.currentTab === 'chores') this.renderChores();
                    host.innerHTML = render();
                    if (act !== 'drop') this.showToast(act === 'today' ? 'Back on today\'s list' : 'Back in your inbox');
                };
            });
        },

        // ═══════════════════════════════════════════════════════
        // 4. FREE TRIAL / RETURN-BY RESCUE ALERTS
        // ═══════════════════════════════════════════════════════
        _rescues() { return readLocal('wd_rescues', []); },
        _rescueDeadline(r) {
            const [y, m, d] = r.date.split('-').map(Number);
            if (r.time) { const [h, mi] = r.time.split(':').map(Number); return new Date(y, m - 1, d, h, mi); }
            // Trials usually charge as the day starts; returns close at the end of the day.
            return r.kind === 'trial' ? new Date(y, m - 1, d, 0, 0) : new Date(y, m - 1, d, 23, 59);
        },
        _countdown(ms) {
            if (ms <= 0) return 'now';
            const m = Math.floor(ms / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24);
            if (d >= 2) return `${d} days`;
            if (h >= 1) return `${h}h ${m % 60}m`;
            return `${m} min`;
        },
        openRescueModal(id) {
            const list = this._rescues();
            const r = list.find(x => x.id === id) || { kind: 'trial', name: '', date: addDays(today(), 7), time: '', amount: '', link: '', notes: '' };
            const isEdit = !!r.id;
            this.lifeModal(isEdit ? 'Edit rescue alert' : '🛟 Add a free trial or return', `
                <div class="seg-big mb-3" role="radiogroup" aria-label="Type">
                    <button data-kind="trial" class="${r.kind === 'trial' ? 'on' : ''}">🆓 Free trial</button>
                    <button data-kind="return" class="${r.kind === 'return' ? 'on' : ''}">📦 Return by</button>
                </div>
                ${this._field('What is it?', `<input id="rs-name" class="${this._inputCls}" value="${esc(r.name)}" placeholder="Netflix trial, Amazon headphones…">`)}
                <div class="grid grid-cols-2 gap-3">
                    ${this._field('<span id="rs-date-l">' + (r.kind === 'trial' ? 'Charges on' : 'Return by') + '</span>', `<input id="rs-date" type="date" class="${this._inputCls}" value="${esc(r.date)}">`)}
                    ${this._field('Time (optional)', `<input id="rs-time" type="time" class="${this._inputCls}" value="${esc(r.time)}">`)}
                    ${this._field('<span id="rs-amt-l">' + (r.kind === 'trial' ? 'You\'ll be charged ($)' : 'Refund worth ($)') + '</span>', `<input id="rs-amount" type="number" step="0.01" min="0" class="${this._inputCls}" value="${esc(r.amount)}">`)}
                    ${this._field('Cancel / return link', `<input id="rs-link" type="url" class="${this._inputCls}" value="${esc(r.link)}" placeholder="https://…">`)}
                </div>
                ${this._field('Notes', `<input id="rs-notes" class="${this._inputCls}" value="${esc(r.notes)}" placeholder="Order #, which card, return label…">`)}
                <p class="text-xs text-slate-400 mb-3">An urgent countdown pins itself to your Dashboard 48 hours before the deadline.</p>
                <div class="flex justify-between gap-2">
                    ${isEdit ? `<button id="rs-del" class="text-red-500 font-bold text-sm px-3">Delete</button>` : '<span></span>'}
                    <div class="flex gap-2"><button onclick="app.closeLifeModal()" class="${this._ghostBtnCls}">Cancel</button><button id="rs-save" class="${this._btnCls}">Save</button></div>
                </div>`, wrap => {
                let kind = r.kind;
                wrap.querySelectorAll('[data-kind]').forEach(b => b.onclick = () => {
                    kind = b.dataset.kind;
                    wrap.querySelectorAll('[data-kind]').forEach(x => x.classList.toggle('on', x === b));
                    wrap.querySelector('#rs-date-l').textContent = kind === 'trial' ? 'Charges on' : 'Return by';
                    wrap.querySelector('#rs-amt-l').textContent = kind === 'trial' ? 'You\'ll be charged ($)' : 'Refund worth ($)';
                });
                wrap.querySelector('#rs-save').onclick = () => {
                    const name = wrap.querySelector('#rs-name').value.trim();
                    if (!name) return wrap.querySelector('#rs-name').focus();
                    const all = this._rescues();
                    const rec = isEdit ? all.find(x => x.id === r.id) : { id: uid(), done: false };
                    Object.assign(rec, {
                        kind, name, date: wrap.querySelector('#rs-date').value || today(), time: wrap.querySelector('#rs-time').value,
                        amount: Math.max(0, parseFloat(wrap.querySelector('#rs-amount').value) || 0),
                        link: wrap.querySelector('#rs-link').value.trim(), notes: wrap.querySelector('#rs-notes').value.trim()
                    });
                    if (!isEdit) all.push(rec);
                    writeLocal('wd_rescues', all);
                    this.closeLifeModal();
                    this._afterRescueChange();
                    this.showToast(isEdit ? 'Saved' : `🛟 Got it — I'll warn you 48 hours before`);
                };
                const del = wrap.querySelector('#rs-del');
                if (del) del.onclick = () => { writeLocal('wd_rescues', this._rescues().filter(x => x.id !== r.id)); this.closeLifeModal(); this._afterRescueChange(); };
            });
        },
        rescueDone(id, keep) {
            const all = this._rescues();
            const r = all.find(x => x.id === id);
            if (!r) return;
            r.done = true; r.doneAt = Date.now(); r.kept = !!keep;
            writeLocal('wd_rescues', all);
            if (keep && r.kind === 'trial' && this.bills) {
                // Keeping it: it becomes a monthly bill.
                this.bills.push({ id: uid(), name: r.name, amount: r.amount || 0, due: r.date, freq: 'monthly', cat: 'Subscription', autopay: true, notes: r.notes || 'Was a free trial', paid: [] });
                this._saveBills();
                this.lifeRefresh && this.lifeRefresh();
                this.showToast(`${r.name} added to Bills as a monthly subscription`);
            } else {
                this._celebrate && this._celebrate(r.kind === 'trial' ? `Cancelled in time — ${r.amount ? '$' + r.amount + ' saved' : 'money saved'} 💪` : 'Returned! Refund rescued 📦');
            }
            this._afterRescueChange();
        },
        _afterRescueChange() {
            this.renderPins();
            if (this.currentTab === 'bills') this.renderBills();
        },
        _rescueRow(r, banner) {
            const ms = this._rescueDeadline(r) - Date.now();
            const verb = r.kind === 'trial' ? (ms > 0 ? 'Charged in' : 'Charge was due') : (ms > 0 ? 'Return window closes in' : 'Return window closed');
            const urgent = ms <= 48 * 3600000;
            return `<div class="rescue ${banner ? 'banner' : ''} ${urgent ? 'urgent' : ''} ${ms <= 0 ? 'late' : ''}">
                <span class="rescue-ico">${r.kind === 'trial' ? '🆓' : '📦'}</span>
                <span class="min-w-0 flex-1"><b class="block truncate">${r.kind === 'trial' ? 'Cancel' : 'Return'} ${esc(r.name)}</b>
                    <span class="rescue-when">${verb} <b>${ms > 0 ? this._countdown(ms) : this._rescueDeadline(r).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</b>${r.amount ? ` · $${Number(r.amount).toFixed(2)}` : ''}</span></span>
                <span class="rescue-acts">
                    ${r.link && /^https?:\/\//i.test(r.link) ? `<a class="ad-btn small" href="${esc(r.link)}" target="_blank" rel="noopener noreferrer">${r.kind === 'trial' ? 'Cancel page' : 'Start return'} ↗</a>` : ''}
                    <button class="ad-btn small ok" onclick="app.rescueDone('${r.id}')">${r.kind === 'trial' ? 'I cancelled ✓' : 'Returned ✓'}</button>
                    ${r.kind === 'trial' ? `<button class="ad-btn small ghost" onclick="app.rescueDone('${r.id}', true)" title="Keep it — add it to Bills">Keep it</button>` : ''}
                    ${banner ? '' : `<button class="ad-link" onclick="app.openRescueModal('${r.id}')">Edit</button>`}
                </span>
            </div>`;
        },
        _rescueNotify() {
            if (!('Notification' in window) || Notification.permission !== 'granted') return;
            const sent = readLocal('wdl_rescue_notified', {});
            this._rescues().filter(r => !r.done).forEach(r => {
                const ms = this._rescueDeadline(r) - Date.now();
                [48, 24, 3].forEach(h => {
                    const key = r.id + ':' + h;
                    if (ms > 0 && ms <= h * 3600000 && !sent[key]) {
                        sent[key] = Date.now();
                        try { new Notification(r.kind === 'trial' ? `💳 Cancel ${r.name} before you're charged` : `📦 Return ${r.name}`, { body: `${this._countdown(ms)} left`, tag: 'wd-rescue-' + r.id }); } catch (e) {}
                    }
                });
            });
            writeLocal('wdl_rescue_notified', sent);
        },

        // ═══════════════════════════════════════════════════════
        // 5. JUST DO 5 MINUTES
        // ═══════════════════════════════════════════════════════
        startMicro(item) {
            if (item) { this.openTunnel(item, 5); return; }
            if (this.timerRunning) { this.showToast('A focus session is already running'); return; }
            this.setTimerMode(5);
            this.toggleTimer();
            this.showToast('⚡ Just 5 minutes. You can stop after — promise.');
        },
        completeTimer() {
            const mode = this.timerMode;
            orig.completeTimer.call(this);
            if (mode === 5) this._microPrompt();
            else if (this._tunnel) this._tunnelDone();
        },
        _microPrompt() {
            const keep = () => { this.setTimerMode(20); if (!this.timerRunning) this.toggleTimer(); if (this._tunnel) this._tunnelRender(); };
            const bank = () => {
                const n = Number(localStorage.getItem('wd_micro_wins') || 0) + 1;
                try { localStorage.setItem('wd_micro_wins', String(n)); } catch (e) {}
                this._celebrate && this._celebrate(`🏦 Win banked! ${n} five-minute start${n > 1 ? 's' : ''} so far.`);
                if (this._tunnel) this.closeTunnel();
            };
            this.chime(2);
            if (this._tunnel) {
                const ov = $('tunnel-prompt');
                if (!ov) return;
                ov.innerHTML = `<div class="tp-card"><div class="text-4xl mb-2">🎉</div><div class="text-2xl font-black mb-1">You're rolling!</div>
                    <p class="text-slate-500 mb-4">Keep going for 20 more minutes, or bank your win now?</p>
                    <div class="grid gap-2"><button class="ad-btn big" data-t="keep">Keep going · 20 min</button>
                    ${this._tunnel.item ? '<button class="ad-btn big ok" data-t="done">It\'s done ✓</button>' : ''}
                    <button class="ad-btn big ghost" data-t="bank">Bank my win 🏦</button></div></div>`;
                ov.hidden = false;
                ov.onclick = e => {
                    const t = e.target.closest('[data-t]');
                    if (!t) return;
                    ov.hidden = true;
                    if (t.dataset.t === 'keep') keep();
                    if (t.dataset.t === 'bank') bank();
                    if (t.dataset.t === 'done') { this._adComplete(this._tunnel.item); this.closeTunnel(); }
                };
                return;
            }
            this.lifeModal('🎉 You\'re rolling!', `
                <p class="text-slate-500 mb-4">Five minutes done — the hardest part is over. Keep going for 20 more minutes, or bank your win now?</p>
                <div class="grid gap-2"><button id="mp-keep" class="${this._btnCls} w-full">Keep going · 20 min</button><button id="mp-bank" class="${this._ghostBtnCls} w-full">Bank my win 🏦</button></div>`, wrap => {
                wrap.querySelector('#mp-keep').onclick = () => { this.closeLifeModal(); keep(); };
                wrap.querySelector('#mp-bank').onclick = () => { this.closeLifeModal(); bank(); };
            });
        },

        // ═══════════════════════════════════════════════════════
        // 6. BREAK INTO TINY STEPS ⚡
        // ═══════════════════════════════════════════════════════
        _stepsGet(item) {
            if (!item) return [];
            if (item.kind === 'task') return (item.ref.steps || []).map(s => ({ t: s.t, d: !!s.d }));
            if (item.kind === 'top') return (item.ref.steps || []).map(s => ({ t: s.t, d: !!s.d }));
            const c = item.ref;
            const done = c.stepDone && c.stepDone.day === today() ? c.stepDone.d : [];
            return (c.steps || []).map((t, i) => ({ t, d: !!done[i] }));
        },
        _stepsSet(item, arr) {
            if (item.kind === 'task') {
                item.ref.steps = arr;
                try { localStorage.setItem('wd_tasks', JSON.stringify(this.tasks)); } catch (e) {}
            } else if (item.kind === 'top') {
                item.ref.steps = arr;
                this._saveCheckins();
            } else {
                item.ref.steps = arr.map(s => s.t);
                item.ref.stepDone = { day: today(), d: arr.map(s => s.d) };
                this._saveChores();
            }
        },
        openTinySteps(kind, id) {
            if (kind === 'task') id = Number(id);
            if (kind === 'top') id = Number(id);
            const item = this._adItem(kind, id);
            if (!item) return;
            let steps = this._stepsGet(item);
            if (!steps.length) { steps = tinyStepsFor(item.title).map(t => ({ t, d: false })); this._stepsSet(item, steps); }
            const body = () => {
                const done = steps.filter(s => s.d).length;
                return `<div class="text-xl font-black mb-1">${esc(item.title)}</div>
                    <p class="text-sm text-slate-500 mb-3">Each step is about <b>3 minutes</b>. You only have to do the next one.</p>
                    <div class="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden mb-3"><div class="h-full bg-gradient-to-r from-amber-400 to-emerald-500 transition-all" style="width:${steps.length ? done / steps.length * 100 : 0}%"></div></div>
                    <ol class="ts-list">${steps.map((s, i) => `
                        <li class="ts-row ${s.d ? 'done' : ''}">
                            <input type="checkbox" data-c="${i}" ${s.d ? 'checked' : ''} aria-label="Step ${i + 1} done" class="w-5 h-5 accent-emerald-500 shrink-0">
                            <span class="ts-n">${i + 1}.</span>
                            <input class="ts-t" data-e="${i}" value="${esc(s.t)}" aria-label="Step ${i + 1}">
                            <button class="ts-x" data-x="${i}" aria-label="Remove step ${i + 1}">✕</button>
                        </li>`).join('')}</ol>
                    <div class="flex flex-wrap gap-2 mt-2">
                        <button class="ad-chip" data-s="add">+ Add a step</button>
                        <button class="ad-chip" data-s="again">↻ Suggest steps again</button>
                    </div>
                    ${done === steps.length && steps.length ? `<div class="ts-win">🎉 Every tiny step is done. <button class="ad-btn small ok" data-s="finish">Mark "${esc(item.title.length > 26 ? item.title.slice(0, 25) + '…' : item.title)}" done</button></div>` : ''}
                    <div class="flex gap-2 mt-4"><button class="${this._btnCls} flex-1" data-s="start">▶ Do step ${Math.min(steps.length, (steps.findIndex(s => !s.d) + 1) || steps.length)} now (5 min)</button><button class="${this._ghostBtnCls}" onclick="app.closeLifeModal()">Close</button></div>`;
            };
            const save = () => { this._stepsSet(item, steps); this._stepsChanged(); };
            this.lifeModal('⚡ Tiny steps', `<div id="ts-body">${body()}</div>`, wrap => {
                const host = wrap.querySelector('#ts-body');
                const redraw = () => { host.innerHTML = body(); };
                host.addEventListener('change', e => {
                    const c = e.target.closest('[data-c]');
                    if (c) {
                        steps[+c.dataset.c].d = c.checked;
                        save();
                        if (c.checked) this.vibrate && this.vibrate(25);
                        redraw();
                        return;
                    }
                    const ed = e.target.closest('[data-e]');
                    if (ed) { const v = ed.value.trim(); if (v) { steps[+ed.dataset.e].t = v; save(); } }
                });
                host.addEventListener('click', e => {
                    const x = e.target.closest('[data-x]');
                    if (x) { steps.splice(+x.dataset.x, 1); save(); redraw(); return; }
                    const s = e.target.closest('[data-s]');
                    if (!s) return;
                    if (s.dataset.s === 'add') { steps.push({ t: 'Next tiny thing', d: false }); save(); redraw(); const last = host.querySelector('.ts-row:last-child .ts-t'); if (last) { last.focus(); last.select(); } }
                    if (s.dataset.s === 'again') { steps = tinyStepsFor(item.title).map(t => ({ t, d: false })); save(); redraw(); }
                    if (s.dataset.s === 'finish') { this.closeLifeModal(); this._adComplete(item); }
                    if (s.dataset.s === 'start') { this.closeLifeModal(); this.openTunnel(this._adItem(item.kind, item.id), 5); }
                });
                host.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('.ts-t')) { e.preventDefault(); e.target.blur(); } });
            });
        },
        _stepsChanged() {
            if (this.currentTab === 'tasks') this._decorateTasks();
            if (this._tunnel) this._tunnelRender();
            if (this.currentTab === 'today') this.renderToday();
            if (this.currentTab === 'chores') this.renderChores();
        },

        // ═══════════════════════════════════════════════════════
        // 7. ONE-THING FOCUS TUNNEL
        // ═══════════════════════════════════════════════════════
        openTunnel(item, mins = 25) {
            if (item && !item.ref) item = this._adItem(item.kind, item.id) || item;
            this._tunnel = { item, side: localStorage.getItem('wdl_tunnel_side') || 'scratch' };
            if (item) this._setFocusTask(item);
            this.closeLifeModal && this.closeLifeModal();
            let el = $('tunnel');
            if (!el) {
                el = document.createElement('div');
                el.id = 'tunnel';
                el.setAttribute('role', 'dialog');
                el.setAttribute('aria-modal', 'true');
                el.setAttribute('aria-label', 'Focus tunnel');
                document.body.appendChild(el);
            }
            document.body.classList.add('tunnel-on');
            if (this.timerRunning) this.showToast('Your timer was already running — joined it');
            else { this.setTimerMode(mins); this.toggleTimer(); }
            this._tunnelRender();
            clearInterval(this._tunnelTick);
            this._tunnelTick = setInterval(() => this._tunnelUpdate(), 500);
            this._noteWhere();
        },
        _tunnelRender() {
            const el = $('tunnel');
            if (!el || !this._tunnel) return;
            const it = this._tunnel.item ? (this._adItem(this._tunnel.item.kind, this._tunnel.item.id) || this._tunnel.item) : null;
            this._tunnel.item = it;
            const steps = it && it.ref ? this._stepsGet(it) : [];
            const side = this._tunnel.side;
            const sounds = [['focus', '🎯 Deep focus'], ['rainycafe', '☕ Rainy café'], ['forest', '🌲 Forest'], ['lofi', '🎵 Lo-fi']];
            el.innerHTML = `
                <div class="tn-top"><span class="tn-eyebrow">One thing</span><button class="tn-exit" data-t="exit" aria-label="Leave the tunnel">Leave tunnel ✕</button></div>
                <div class="tn-grid">
                    <section class="tn-main">
                        <h2 class="tn-title">${it ? esc(it.title) : 'Focus'}</h2>
                        <div class="tn-time" id="tn-time">--:--</div>
                        <div class="tn-bar" role="progressbar" aria-label="Time left"><div id="tn-fill"></div></div>
                        <div class="tn-ctl">
                            <button class="ad-btn big" data-t="pause" id="tn-pause">Pause</button>
                            <button class="ad-btn big ghost" data-t="plus5">+5 min</button>
                            ${it ? '<button class="ad-btn big ok" data-t="done">Done ✓</button>' : ''}
                        </div>
                        ${it && it.ref ? (steps.length ? `<ol class="tn-steps">${steps.map((s, i) => `<li><label><input type="checkbox" data-st="${i}" ${s.d ? 'checked' : ''} class="w-5 h-5 accent-emerald-500"> <span>${esc(s.t)}</span></label></li>`).join('')}</ol>`
                            : `<button class="ad-link mt-4" data-t="steps">⚡ Break it into tiny steps</button>`) : ''}
                    </section>
                    <aside class="tn-side">
                        <div class="seg-big mb-2"><button data-side="scratch" class="${side === 'scratch' ? 'on' : ''}">📝 Scratchpad</button><button data-side="calc" class="${side === 'calc' ? 'on' : ''}">🧮 Calculator</button></div>
                        ${side === 'scratch' ? `<textarea id="tn-scratch" class="tn-scratch" placeholder="Park stray thoughts here so they stop circling. It's your normal Scratchpad.">${esc(localStorage.getItem('wd_scratch') || '')}</textarea>`
                            : `<div class="tn-calc"><input id="tn-calc-in" inputmode="decimal" placeholder="e.g. 12.5 * 4 + 10" autocomplete="off"><div id="tn-calc-out" class="tn-calc-out">=</div><p class="text-[11px] text-slate-400">+ − × ÷ ( ) and % work. Press Enter.</p></div>`}
                        <div class="tn-sounds"><div class="tn-sounds-h">Ambient sounds</div>
                            <div class="flex flex-wrap gap-1.5">${sounds.map(([id, l]) => `<button class="ad-chip" data-snd="${id}">${l}</button>`).join('')}<button class="ad-chip muted" data-snd="stop">⏹ Stop</button></div>
                            <label class="tn-vol">🔈 <input type="range" min="0" max="1" step="0.05" value="${(app._sound && app._sound.S && app._sound.S.master) || 0.85}" data-vol aria-label="Volume"></label>
                        </div>
                    </aside>
                </div>
                <div id="tunnel-prompt" class="tn-prompt" hidden></div>`;
            el.onclick = e => {
                const t = e.target.closest('[data-t]');
                if (t) {
                    const a = t.dataset.t;
                    if (a === 'exit') this.closeTunnel();
                    if (a === 'pause') { this.toggleTimer(); this._tunnelUpdate(); }
                    if (a === 'plus5') { this.timerTime += 300; this.timerMode = Math.ceil((this.timerMode * 60 + 300) / 60); this.updateTimerDisplay(); this._tunnelUpdate(); }
                    if (a === 'done') { const i = this._tunnel.item; if (this.timerRunning) this.pauseTimer(); this.resetTimer(); this._adComplete(i); this.closeTunnel(); }
                    if (a === 'steps') this.openTinySteps(it.kind, it.id);
                    return;
                }
                const sd = e.target.closest('[data-side]');
                if (sd) { this._tunnel.side = sd.dataset.side; try { localStorage.setItem('wdl_tunnel_side', sd.dataset.side); } catch (er) {} this._tunnelRender(); return; }
                const snd = e.target.closest('[data-snd]');
                if (snd) {
                    const id = snd.dataset.snd;
                    try {
                        if (id === 'stop') this.mixerStopAll && this.mixerStopAll(true);
                        else if (id === 'lofi') this.musicPlay ? this.musicPlay('lofi') : this.toggleMusic();
                        else this.mixerStart && this.mixerStart(id);
                    } catch (er) { /* audio blocked */ }
                }
            };
            el.onchange = e => {
                const st = e.target.closest('[data-st]');
                if (st && it) {
                    const arr = this._stepsGet(it); arr[+st.dataset.st].d = st.checked; this._stepsSet(it, arr);
                    if (arr.every(s => s.d)) this._celebrate && this._celebrate('Every tiny step done! 🎉');
                }
            };
            el.oninput = e => {
                if (e.target.matches('[data-vol]') && this.mixerSetMaster) this.mixerSetMaster(e.target.value);
                if (e.target.id === 'tn-scratch') {
                    try { localStorage.setItem('wd_scratch', e.target.value); } catch (er) {}
                    const n = $('note-area'); if (n) n.value = e.target.value;
                }
            };
            const ci = $('tn-calc-in');
            if (ci) ci.onkeydown = e => {
                if (e.key !== 'Enter') return;
                const out = $('tn-calc-out');
                const expr = ci.value.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/,/g, '');
                if (!/^[\d\s.+\-*/()%]+$/.test(expr)) { out.textContent = '= ?'; return; }
                try { const v = Function('"use strict";return (' + expr + ')')(); out.textContent = '= ' + (Number.isFinite(v) ? +v.toFixed(10) : '?'); } catch (er) { out.textContent = '= ?'; }
            };
            this._tunnelUpdate();
            const focusEl = el.querySelector('#tn-pause');
            if (focusEl) focusEl.focus({ preventScroll: true });
        },
        _tunnelUpdate() {
            if (!this._tunnel) return;
            const t = $('tn-time'), f = $('tn-fill'), p = $('tn-pause');
            if (!t) return;
            const left = Math.max(0, this.timerTime), total = Math.max(1, this.timerMode * 60);
            t.textContent = `${pad(Math.floor(left / 60))}:${pad(left % 60)}`;
            f.style.width = (left / total * 100).toFixed(2) + '%';
            if (p) p.textContent = this.timerRunning ? 'Pause' : (left < total ? 'Resume' : 'Start');
            document.title = `${pad(Math.floor(left / 60))}:${pad(left % 60)} · ${this._tunnel.item ? this._tunnel.item.title : 'Focus'}`;
        },
        _tunnelDone() {
            const ov = $('tunnel-prompt');
            if (!ov) return;
            this.chime(2);
            ov.innerHTML = `<div class="tp-card"><div class="text-4xl mb-2">⏰</div><div class="text-2xl font-black mb-1">Session complete</div>
                <p class="text-slate-500 mb-4">Nice stretch of focus. What now?</p>
                <div class="grid gap-2">${this._tunnel.item ? '<button class="ad-btn big ok" data-t2="done">It\'s done ✓</button>' : ''}
                <button class="ad-btn big" data-t2="again">Another 25 min</button><button class="ad-btn big ghost" data-t2="leave">Take a break</button></div></div>`;
            ov.hidden = false;
            ov.onclick = e => {
                const b = e.target.closest('[data-t2]');
                if (!b) return;
                ov.hidden = true;
                if (b.dataset.t2 === 'done') { this._adComplete(this._tunnel.item); this.closeTunnel(); }
                if (b.dataset.t2 === 'again') { this.setTimerMode(25); this.toggleTimer(); }
                if (b.dataset.t2 === 'leave') this.closeTunnel();
            };
        },
        closeTunnel() {
            clearInterval(this._tunnelTick);
            const el = $('tunnel');
            if (el) el.remove();
            document.body.classList.remove('tunnel-on');
            this._noteWhere();
            this._tunnel = null;
            document.title = this._titleBase || document.title;
            if (this.timerRunning) this.showToast('Timer still running — it\'s in the Focus timer');
            if (this.currentTab === 'today') this.renderToday();
        },

        // ═══════════════════════════════════════════════════════
        // 8. DAY DEPLETING BAR + GENTLE CHIME
        // ═══════════════════════════════════════════════════════
        _daybarPrefs() { return Object.assign({ on: true, start: '09:00', end: '17:00', chime: 0, weekends: false }, readLocal('wd_daybar', {})); },
        renderDayBar() {
            const p = this._daybarPrefs();
            let bar = $('day-bar');
            const now = new Date();
            const weekend = [0, 6].includes(now.getDay());
            if (!p.on || (weekend && !p.weekends)) { if (bar) bar.remove(); return; }
            if (!bar) {
                bar = document.createElement('button');
                bar.id = 'day-bar';
                bar.type = 'button';
                bar.innerHTML = '<span class="db-fill"></span><span class="db-tip"></span>';
                bar.onclick = () => this.openDayBarSettings();
                document.body.appendChild(bar);
            }
            const [sh, sm] = p.start.split(':').map(Number), [eh, em] = p.end.split(':').map(Number);
            const s = new Date(now); s.setHours(sh, sm, 0, 0);
            const e = new Date(now); e.setHours(eh, em, 0, 0);
            const total = Math.max(1, e - s);
            const frac = Math.min(1, Math.max(0, (now - s) / total));
            const left = (e - now) / 60000;
            const tip = now < s ? `Workday starts at ${clockTime(s)}` : now >= e ? 'Workday done — log off when you can 🌙' : `${Math.round(frac * 100)}% of your workday gone · ${dur(left)} left (until ${clockTime(e)})`;
            bar.querySelector('.db-fill').style.width = (frac * 100).toFixed(2) + '%';
            bar.querySelector('.db-tip').textContent = tip;
            bar.setAttribute('aria-label', tip + '. Click to change workday hours.');
            bar.classList.toggle('late', frac >= 0.85 && frac < 1);
            bar.classList.toggle('over', frac >= 1);
        },
        _chimeCheck() {
            const p = this._daybarPrefs();
            if (!p.on || !p.chime) return;
            const now = new Date();
            if ([0, 6].includes(now.getDay()) && !p.weekends) return;
            const mins = now.getHours() * 60 + now.getMinutes();
            const [sh, sm] = p.start.split(':').map(Number), [eh, em] = p.end.split(':').map(Number);
            if (mins <= sh * 60 + sm || mins > eh * 60 + em) return;
            if (now.getMinutes() % p.chime !== 0) return;
            const key = today() + ' ' + now.getHours() + ':' + now.getMinutes();
            if (this._lastChime === key) return;
            this._lastChime = key;
            // Only one open tab chimes.
            if (localStorage.getItem('wdl_last_chime') === key) return;
            try { localStorage.setItem('wdl_last_chime', key); } catch (e) {}
            this.chime(1);
            const left = (eh * 60 + em) - mins;
            this.showToast(`🕐 ${clockTime(now)} · ${left > 0 ? dur(left) + ' left in your workday' : 'workday done'}`);
        },
        chime(n = 1) {
            try {
                const C = window.AudioContext || window.webkitAudioContext;
                if (!C) return;
                const ctx = this._chimeCtx || (this._chimeCtx = new C());
                if (ctx.state === 'suspended') ctx.resume();
                const t0 = ctx.currentTime + 0.05;
                for (let k = 0; k < n; k++) {
                    [[659.25, 0], [987.77, 0.16]].forEach(([f, d]) => {
                        const o = ctx.createOscillator(), g = ctx.createGain();
                        o.type = 'sine'; o.frequency.value = f;
                        const t = t0 + k * 0.9 + d;
                        g.gain.setValueAtTime(0.0001, t);
                        g.gain.exponentialRampToValueAtTime(0.09, t + 0.02);
                        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
                        o.connect(g); g.connect(ctx.destination);
                        o.start(t); o.stop(t + 1.6);
                    });
                }
            } catch (e) { /* no audio */ }
        },
        openDayBarSettings() {
            const p = this._daybarPrefs();
            this.lifeModal('⏳ Workday bar & chime', `
                <p class="text-sm text-slate-500 mb-4">Clocks don't feel real to a time-blind brain. The thin bar at the very top fills up as your workday drains, so hours can't quietly disappear.</p>
                <label class="flex items-center gap-2 mb-3 font-bold"><input id="db-on" type="checkbox" ${p.on ? 'checked' : ''} class="w-4 h-4 accent-indigo-500"> Show the workday bar</label>
                <div class="grid grid-cols-2 gap-3">
                    ${this._field('Workday starts', `<input id="db-start" type="time" class="${this._inputCls}" value="${p.start}">`)}
                    ${this._field('Workday ends', `<input id="db-end" type="time" class="${this._inputCls}" value="${p.end}">`)}
                </div>
                ${this._field('Gentle chime', `<select id="db-chime" class="${this._inputCls}"><option value="0" ${!p.chime ? 'selected' : ''}>Off</option><option value="30" ${p.chime === 30 ? 'selected' : ''}>Every 30 minutes</option><option value="60" ${p.chime === 60 ? 'selected' : ''}>Every hour</option></select>`)}
                <label class="flex items-center gap-2 mb-4 text-sm"><input id="db-wk" type="checkbox" ${p.weekends ? 'checked' : ''} class="w-4 h-4 accent-indigo-500"> Also on weekends</label>
                <div class="flex gap-2"><button id="db-save" class="${this._btnCls} flex-1">Save</button><button id="db-test" class="${this._ghostBtnCls}">🔔 Test chime</button></div>`, wrap => {
                wrap.querySelector('#db-test').onclick = () => this.chime(1);
                wrap.querySelector('#db-save').onclick = () => {
                    const start = wrap.querySelector('#db-start').value || '09:00', end = wrap.querySelector('#db-end').value || '17:00';
                    if (end <= start) { this.showToast('The workday has to end after it starts'); return; }
                    writeLocal('wd_daybar', { on: wrap.querySelector('#db-on').checked, start, end, chime: Number(wrap.querySelector('#db-chime').value), weekends: wrap.querySelector('#db-wk').checked });
                    this.closeLifeModal();
                    this.renderDayBar();
                    this.renderBridges();
                    this.showToast('Workday saved');
                };
            });
        },

        // ═══════════════════════════════════════════════════════
        // 9. WHERE WAS I? (resume card)
        // ═══════════════════════════════════════════════════════
        _noteWhere(force) {
            const tab = this.currentTab;
            if (!this._tunnel && (!tab || tab === 'dashboard')) return;
            const now = Date.now();
            if (!force && this._whereAt && now - this._whereAt < 15000) return;
            this._whereAt = now;
            const f = readLocal('wdl_focus_task', null);
            const prev = readLocal('wdl_where', {}) || {};
            const rec = {
                tab: this._tunnel ? 'tunnel' : tab,
                tool: this._tunnel ? (this._tunnel.side === 'calc' ? 'Calculator' : 'Scratchpad') : TOOL_NAMES(tab),
                task: this._tunnel && this._tunnel.item ? this._tunnel.item.title : (f && now - f.at < 12 * 3600000 ? f.title : ''),
                item: this._tunnel && this._tunnel.item ? { kind: this._tunnel.item.kind, id: this._tunnel.item.id } : (f ? { kind: f.kind, id: f.id } : null),
                at: now,
                note: prev.note && now - (prev.at || 0) < 12 * 3600000 ? prev.note : ''
            };
            writeLocal('wdl_where', rec);
        },
        _whereCardHtml() {
            const w = readLocal('wdl_where', null);
            if (!w || !w.at) return '';
            const gap = Date.now() - w.at;
            if (gap < 3 * 60000 || gap > 20 * 3600000) return '';
            if (localStorage.getItem('wdl_where_dismissed') === String(w.at)) return '';
            const item = w.item ? this._adItem(w.item.kind, w.item.id) : null;
            if (item && item.done) return '';
            const what = w.task ? `You were working on <b>${esc(w.task)}</b>${w.tool ? ` with <b>${esc(w.tool)}</b> open` : ''}` : `You were in <b>${esc(w.tool || 'WebDesks')}</b>`;
            let crumb = w.note ? `“${esc(w.note)}”` : '';
            if (!crumb && /scratch/i.test(w.tool || '')) {
                const last = (localStorage.getItem('wd_scratch') || '').trim().split('\n').filter(Boolean).pop();
                if (last) crumb = `Last line: “${esc(last.length > 80 ? last.slice(0, 79) + '…' : last)}”`;
            }
            return `<div class="where-card" role="region" aria-label="Where was I?">
                <span class="where-ico">🧭</span>
                <span class="min-w-0 flex-1"><span class="where-k">Where was I? · Last active ${esc(ago(gap))}</span>
                    <span class="block">${what}.</span>${crumb ? `<span class="where-crumb">${crumb}</span>` : ''}</span>
                <button class="ad-btn" onclick="app.resumeWhere()">→ 1-click resume</button>
                <button class="where-x" onclick="app.dismissWhere()" aria-label="Dismiss">✕</button>
            </div>`;
        },
        resumeWhere() {
            const w = readLocal('wdl_where', null);
            if (!w) return;
            try { localStorage.setItem('wdl_where_dismissed', String(w.at)); } catch (e) {}
            const item = w.item ? this._adItem(w.item.kind, w.item.id) : null;
            if (w.tab === 'tunnel' && item && !item.done) { this.openTunnel(item, 25); return; }
            if (w.tab && w.tab !== 'tunnel' && document.getElementById(w.tab)) this.switchTab(w.tab);
            else if (w.tab === 'tunnel') this.switchTab('today');
            if (w.task) this.showToast(`Picking up: ${w.task}`);
            this.renderPins();
        },
        dismissWhere() {
            const w = readLocal('wdl_where', null);
            if (w) try { localStorage.setItem('wdl_where_dismissed', String(w.at)); } catch (e) {}
            this.renderPins();
        },

        // Dashboard pins: rescue countdowns, Where was I?, doom-pile nudge.
        renderPins() {
            const home = document.querySelector('#dashboard .home');
            if (!home) return;
            let el = $('ad-pins');
            if (!el) { el = document.createElement('div'); el.id = 'ad-pins'; el.className = 'ad-pins'; home.prepend(el); }
            const urgent = this._rescues().filter(r => !r.done && this._rescueDeadline(r) - Date.now() <= 48 * 3600000 && this._rescueDeadline(r) - Date.now() > -3 * 86400000)
                .sort((a, b) => this._rescueDeadline(a) - this._rescueDeadline(b));
            const pile = this._doom();
            const p = this._daybarPrefs();
            const evening = new Date().getHours() * 60 + new Date().getMinutes() >= Math.min(17 * 60, (+p.end.split(':')[0]) * 60 + (+p.end.split(':')[1]) - 30);
            const nudge = pile.length && (evening || pile.length >= 10)
                ? `<div class="doom-nudge"><span>🧠 <b>${pile.length}</b> thought${pile.length > 1 ? 's' : ''} in your doom pile.</span><button class="ad-btn small" onclick="app.openDoomSort()">Sort them in 2 min →</button></div>` : '';
            el.innerHTML = urgent.map(r => this._rescueRow(r, true)).join('') + this._whereCardHtml() + nudge;
            el.hidden = !el.innerHTML.trim();
        },

        // ═══════════════════════════════════════════════════════
        // 10. DOOM PILE (brain dump) + SORT GAME
        // ═══════════════════════════════════════════════════════
        _doom() { return readLocal('wd_doom', []); },
        addToDoomPile(text) {
            const lines = String(text || '').split('\n').map(s => s.replace(/^\s*[-*•]\s*/, '').trim()).filter(Boolean);
            if (!lines.length) return 0;
            const pile = this._doom();
            lines.forEach(t => pile.push({ id: uid(), text: t.slice(0, 500), at: Date.now() }));
            writeLocal('wd_doom', pile.slice(-500));
            this._afterDoomChange();
            return lines.length;
        },
        _afterDoomChange() {
            const n = this._doom().length;
            document.querySelectorAll('[data-doom-count]').forEach(e => { e.textContent = n; });
            document.querySelectorAll('[data-doom-wrap]').forEach(e => { e.hidden = !n; });
            if (this.currentTab === 'dashboard') this.renderPins();
        },
        openBrainDump() {
            if (this.openQuickCapture) this.openQuickCapture('dump');
        },
        _doomPage() {
            let page = (this.pages || []).find(p => p.doom);
            if (!page && this.newPage) {
                page = this.newPage('blank', true);
                page.title = 'Sorted from my doom pile';
                page.icon = '🧠';
                page.doom = true;
                page.data = { time: Date.now(), blocks: [] };
                this._savePages();
            }
            return page;
        },
        async _routeDoom(entry, key) {
            const text = entry.text;
            if (key === 't') {
                let p = { title: text };
                try { if (this.smartParse) p = (await this.smartParse(text)) || p; } catch (e) {}
                const t = { text: p.title || text, time: p.time || '', date: p.date || '', done: false, id: this._taskId ? this._taskId() : Date.now() };
                this.tasks.push(t);
                this.renderTasks();
                return { kind: 't', id: t.id };
            }
            if (key === 'c') {
                const c = { id: uid(), name: text, cat: 'Custom', mins: 10, every: 7, energy: 1, steps: [], day: null, lastDone: '', history: [], start: today() };
                this.chores.push(c);
                this._saveChores();
                this.lifeRefresh && this.lifeRefresh();
                return { kind: 'c', id: c.id };
            }
            if (key === 'b') {
                const m = text.match(/\$\s?(\d+(?:[.,]\d{1,2})?)/) || text.match(/(\d+(?:\.\d{1,2})?)\s?(?:usd|dollars|bucks)/i);
                let due = addDays(today(), 7);
                try { const p = this.smartParse ? await this.smartParse(text) : null; if (p && p.date) due = p.date; } catch (e) {}
                const b = { id: uid(), name: text.replace(/\$\s?\d+(?:[.,]\d{1,2})?/, '').trim() || text, amount: m ? parseFloat(m[1].replace(',', '.')) : 0, due, freq: 'once', cat: 'Other', autopay: false, notes: 'From your doom pile — check the amount and date', paid: [] };
                this.bills.push(b);
                this._saveBills();
                this.lifeRefresh && this.lifeRefresh();
                return { kind: 'b', id: b.id };
            }
            if (key === 'p') {
                const page = this._doomPage();
                if (!page) return { kind: 'x' };
                const block = { id: uid(), type: 'paragraph', data: { text: esc(text) } };
                const open = this._editor && localStorage.getItem('wd_pages_active') === page.id && this._editor.blocks;
                if (open) { try { this._editor.blocks.insert('paragraph', { text: esc(text) }); } catch (e) {} }
                else { page.data = page.data || { blocks: [] }; page.data.blocks.push(block); page.updated = Date.now(); this._savePages(); }
                this.renderPagesList && this.renderPagesList();
                return { kind: 'p', id: page.id, block: block.id, open: !!open };
            }
            return { kind: 'x' };
        },
        _undoDoom(res) {
            if (!res) return;
            if (res.kind === 't') { this.tasks = this.tasks.filter(t => t.id !== res.id); this.renderTasks(); }
            if (res.kind === 'c') { this.chores = this.chores.filter(c => c.id !== res.id); this._saveChores(); }
            if (res.kind === 'b') { this.bills = this.bills.filter(b => b.id !== res.id); this._saveBills(); }
            if (res.kind === 'p' && !res.open) { const pg = this.pages.find(p => p.id === res.id); if (pg) { pg.data.blocks = pg.data.blocks.filter(b => b.id !== res.block); this._savePages(); } }
            this.lifeRefresh && this.lifeRefresh();
        },
        openDoomSort() {
            const queue = this._doom();
            if (!queue.length) { this.showToast('Your doom pile is empty 🧘 — press B anywhere to dump a thought'); return; }
            this.closeLifeModal && this.closeLifeModal();
            const counts = { t: 0, c: 0, b: 0, p: 0, d: 0, s: 0 };
            const history = [];
            let idx = 0, busy = false;
            const started = Date.now();
            const LIMIT = 120;
            const el = document.createElement('div');
            el.id = 'doom-game';
            el.setAttribute('role', 'dialog');
            el.setAttribute('aria-modal', 'true');
            el.setAttribute('aria-label', 'Sort my doom pile');
            document.body.appendChild(el);
            document.body.classList.add('tunnel-on');
            const KEYS = [['t', 'T', '✅', 'Tasks'], ['c', 'C', '🧹', 'Chores'], ['b', 'B', '💸', 'Bills'], ['p', 'P', '📝', 'Pages'], ['d', '⌫', '🗑️', 'Delete'], ['s', 'S', '⏭️', 'Later']];
            const removeFromPile = id => writeLocal('wd_doom', this._doom().filter(x => x.id !== id));
            const timerTxt = () => {
                const s = Math.floor((Date.now() - started) / 1000);
                const r = LIMIT - s;
                return r >= 0 ? `${Math.floor(r / 60)}:${pad(r % 60)}` : `+${Math.floor(-r / 60)}:${pad(-r % 60)} · no rush`;
            };
            const draw = (fly) => {
                if (idx >= queue.length) return finish();
                const e = queue[idx];
                el.innerHTML = `
                    <div class="dg-top"><span class="dg-title">🧠 Sort my doom pile</span><span class="dg-clock" id="dg-clock">${timerTxt()}</span><button class="tn-exit" data-k="esc">Stop ✕</button></div>
                    <div class="dg-prog"><div style="width:${idx / queue.length * 100}%"></div></div>
                    <div class="dg-count">${idx + 1} / ${queue.length}</div>
                    <div class="dg-card ${fly ? 'in' : ''}" id="dg-card"><div class="dg-text">${esc(e.text)}</div><div class="dg-when">dumped ${esc(ago(Date.now() - e.at))}</div></div>
                    <div class="dg-keys">${KEYS.map(([k, label, ico, name]) => `<button data-k="${k}" class="dg-key k-${k}"><kbd>${label}</kbd><span>${ico} ${name}</span></button>`).join('')}</div>
                    <div class="dg-help">One key per thought. <kbd>U</kbd> undo · <kbd>Esc</kbd> stop (the rest stays in the pile)</div>`;
            };
            const finish = () => {
                clearInterval(clock);
                const secs = Math.round((Date.now() - started) / 1000);
                const sorted = counts.t + counts.c + counts.b + counts.p + counts.d;
                el.innerHTML = `<div class="dg-done"><div class="text-5xl mb-3">🧘</div><div class="text-3xl font-black mb-2">Pile sorted!</div>
                    <p class="mb-4 opacity-80">${sorted} thought${sorted === 1 ? '' : 's'} in ${Math.floor(secs / 60)}:${pad(secs % 60)}. Your brain has a little more room now.</p>
                    <div class="dg-sum">${[['t', '✅ Tasks'], ['c', '🧹 Chores'], ['b', '💸 Bills'], ['p', '📝 Pages'], ['d', '🗑️ Deleted'], ['s', '⏭️ Later']].filter(([k]) => counts[k]).map(([k, l]) => `<span>${l} <b>${counts[k]}</b></span>`).join('')}</div>
                    <button class="ad-btn big mt-6" data-k="esc">Done</button></div>`;
                if (sorted && this._celebrate) this._celebrate();
                try { localStorage.setItem('wd_doom_sorted', String(Number(localStorage.getItem('wd_doom_sorted') || 0) + sorted)); } catch (e) {}
            };
            const close = () => {
                clearInterval(clock);
                document.removeEventListener('keydown', onKey, true);
                el.remove();
                document.body.classList.remove('tunnel-on');
                this._afterDoomChange();
                if (this.currentTab === 'today') this.renderToday();
            };
            const act = async k => {
                if (busy) return;
                if (k === 'esc') return close();
                if (idx >= queue.length) return;
                if (k === 'u') {
                    const h = history.pop();
                    if (!h) return;
                    busy = true;
                    this._undoDoom(h.res);
                    if (h.k !== 's') { const pile = this._doom(); pile.push(h.entry); writeLocal('wd_doom', pile); }
                    counts[h.k]--; idx--;
                    busy = false;
                    return draw(true);
                }
                if (!['t', 'c', 'b', 'p', 'd', 's'].includes(k)) return;
                busy = true;
                const entry = queue[idx];
                const card = $('dg-card');
                if (card && !reducedMotion()) card.classList.add('out-' + k);
                let res = null;
                try { if (k !== 'd' && k !== 's') res = await this._routeDoom(entry, k); } catch (e) { res = null; }
                if (k !== 's') removeFromPile(entry.id);
                history.push({ k, entry, res });
                counts[k]++; idx++;
                setTimeout(() => { busy = false; draw(true); }, reducedMotion() ? 0 : 170);
            };
            const onKey = e => {
                if (e.metaKey || e.ctrlKey || e.altKey) return;
                const map = { Backspace: 'd', Delete: 'd', Escape: 'esc', ArrowRight: 's' };
                const k = map[e.key] || (e.key.length === 1 ? e.key.toLowerCase() : '');
                if (!k) return;
                e.preventDefault();
                e.stopImmediatePropagation();
                act(k);
            };
            document.addEventListener('keydown', onKey, true);
            el.addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (b) act(b.dataset.k); });
            const clock = setInterval(() => { const c = $('dg-clock'); if (c) { c.textContent = timerTxt(); c.classList.toggle('over', Date.now() - started > LIMIT * 1000); } }, 500);
            draw(true);
        },

        // ═══════════════════════════════════════════════════════
        // Wiring into existing views
        // ═══════════════════════════════════════════════════════
        // Tasks tab: toolbar + per-row energy, ⚡ tiny steps and ▶ start.
        renderTasks(...args) {
            const r = orig.renderTasks.apply(this, args);
            this._decorateTasks();
            return r;
        },
        _decorateTasks() {
            const list = $('task-list');
            if (!list) return;
            const filterRow = document.querySelector('#tasks .filter-btn') && document.querySelector('#tasks .filter-btn').parentElement;
            if (filterRow) {
                let bar = $('ad-task-bar');
                if (!bar) { bar = document.createElement('div'); bar.id = 'ad-task-bar'; bar.className = 'ad-bar'; filterRow.before(bar); }
                const o = this._overdue(), v = this._vault().length;
                bar.innerHTML = `<button class="ad-btn" onclick="app.openPickOne('tasks')">🎡 Pick 1 for me</button>
                    ${o.tasks.length ? `<button class="ad-btn fresh" onclick="app.freshStart('tasks')" title="Move overdue tasks to the Someday Vault — no guilt, streaks kept">🌱 Fresh start <span class="opacity-70">(${o.tasks.length} carried over)</span></button>` : ''}
                    <button class="ad-btn ghost" onclick="app.openVault()">🗄️ Someday${v ? ` <b>${v}</b>` : ''}</button>
                    <button class="ad-btn ghost" onclick="app.startMicro()" title="Lower the activation barrier: just 5 minutes">⚡ Just 5 min</button>`;
            }
            [...list.children].forEach(row => {
                if (row.querySelector('.ad-row-acts')) return;
                let idx = row.dataset.idx;
                if (idx == null) { const m = (row.getAttribute('ondragstart') || '').match(/dragTaskStart\(event,\s*(\d+)\)/); idx = m ? m[1] : null; }
                const t = idx != null ? this.tasks[Number(idx)] : null;
                if (!t || t.id == null) return;
                const acts = document.createElement('span');
                acts.className = 'ad-row-acts';
                const steps = t.steps || [];
                const sd = steps.filter(s => s.d).length;
                acts.innerHTML = `${t.done ? '' : `<button class="ad-mini en${t.energy ? '' : ' unset'}" data-a="en" title="${t.energy ? ENERGY[t.energy].label + ' energy' : 'How much energy does this need?'} — click to change">${t.energy ? ENERGY[t.energy].icon : '🔋?'}<span class="sr-only"> energy</span></button>`}
                    <button class="ad-mini steps" data-a="steps" title="Break into tiny steps">⚡${steps.length ? ` <b>${sd}/${steps.length}</b>` : ''}<span class="sr-only"> Break into tiny steps</span></button>
                    ${t.done ? '' : '<button class="ad-mini go" data-a="go" title="Start — focus tunnel">▶<span class="sr-only"> Start</span></button>'}`;
                acts.onclick = e => {
                    e.stopPropagation();
                    const b = e.target.closest('[data-a]');
                    if (!b) return;
                    if (b.dataset.a === 'en') { t.energy = ((t.energy || 0) + 1) % 4; try { localStorage.setItem('wd_tasks', JSON.stringify(this.tasks)); } catch (er) {} this.showToast(t.energy ? `${ENERGY[t.energy].icon} ${ENERGY[t.energy].label} energy` : 'Energy cleared'); this.renderTasks(); }
                    if (b.dataset.a === 'steps') this.openTinySteps('task', t.id);
                    if (b.dataset.a === 'go') this.openTunnel(this._adItem('task', t.id), 25);
                };
                const trash = row.querySelector('button[onclick^="app.removeTask"]');
                if (trash) trash.before(acts); else row.appendChild(acts);
            });
        },

        // Today: Pick 1, What fits?, Fresh start, priority ▶, doom pile.
        renderToday() {
            orig.renderToday.call(this);
            const root = $('today-root');
            const wrap = root && root.firstElementChild;
            if (!wrap) return;
            const hero = wrap.firstElementChild;
            const o = this._overdue();
            const strip = document.createElement('div');
            strip.className = 'grid grid-cols-1 md:grid-cols-2 gap-6';
            strip.innerHTML = `
                <div class="glass p-5 rounded-2xl ad-pick">
                    <div class="ad-card-h"><span>🎡 Can't start?</span><button class="ad-link" onclick="app.openDayBarSettings()">Workday ${esc(this._daybarPrefs().start)}–${esc(this._daybarPrefs().end)}</button></div>
                    <p class="text-sm text-slate-500 mb-3">Let me hide the list and pick <b>one</b> thing that matches your energy, then start a 5-minute starter.</p>
                    <div class="flex flex-wrap gap-2"><button class="ad-btn" onclick="app.openPickOne()">🎡 Pick 1 for me</button><button class="ad-btn ghost" onclick="app.startMicro()">⚡ Just 5 min</button></div>
                    ${o.n ? `<div class="ad-fresh"><span>${o.n} thing${o.n > 1 ? 's' : ''} carried over from earlier days.</span><button class="ad-btn small fresh" onclick="app.freshStart()">🌱 Fresh start</button></div>` : ''}
                </div>
                <div class="glass p-5 rounded-2xl" id="ad-bridge-today"></div>`;
            if (hero) hero.after(strip);
            this.renderBridge($('ad-bridge-today'), 'today');

            // ▶ Start on each priority → Focus Tunnel; ⚡ tiny steps.
            root.querySelectorAll('input[type=text][oninput^="app.todaySetTop"]').forEach(inp => {
                const i = Number((inp.getAttribute('oninput').match(/todaySetTop\((\d)/) || [])[1]);
                const p = this._checkin().top[i];
                if (!p || !p.t || p.d) return;
                const n = (p.steps || []).length, d = (p.steps || []).filter(s => s.d).length;
                inp.insertAdjacentHTML('afterend', `<button class="ad-mini steps" onclick="app.openTinySteps('top', ${i})" title="Break into tiny steps">⚡${n ? ` <b>${d}/${n}</b>` : ''}</button><button class="ad-mini go wide" onclick="app.openTunnel(app._adItem('top', ${i}), 25)" title="Start: hide everything else">▶ Start</button>`);
            });
            // Task rows: ⚡ and ▶.
            root.querySelectorAll('button[onclick^="app.todayToggleTask"]').forEach(btn => {
                const id = Number((btn.getAttribute('onclick').match(/todayToggleTask\((\d+)\)/) || [])[1]);
                const t = this.tasks.find(x => x.id === id);
                if (!t || t.done) return;
                const n = (t.steps || []).length, d = (t.steps || []).filter(s => s.d).length;
                const span = btn.parentElement.querySelector('span.flex-1');
                if (span) span.insertAdjacentHTML('afterend', `<button class="ad-mini steps" onclick="app.openTinySteps('task', ${id})" title="Break into tiny steps">⚡${n ? ` <b>${d}/${n}</b>` : ''}</button><button class="ad-mini go" onclick="app.openTunnel(app._adItem('task', ${id}), 25)" title="Start">▶</button>`);
            });
            // Brain dump box: a "Doom pile — sort later" destination.
            const sel = $('today-capture-when');
            if (sel && !sel.querySelector('option[value=pile]')) {
                sel.insertAdjacentHTML('afterbegin', '<option value="pile">🧠 Doom pile</option>');
                sel.value = localStorage.getItem('wdl_capture_when') || 'pile';
                sel.onchange = () => { try { localStorage.setItem('wdl_capture_when', sel.value); } catch (e) {} };
                const box = sel.parentElement;
                const n = this._doom().length;
                box.insertAdjacentHTML('afterend', `<div class="doom-row"><span>🧠 Dump anything here (or press <kbd>B</kbd> on any page), sort it later with one key per thought.</span>
                    <button class="ad-btn small" data-doom-wrap ${n ? '' : 'hidden'} onclick="app.openDoomSort()">Sort my doom pile (<span data-doom-count>${n}</span>) →</button></div>`);
            }
        },
        async todayQuickAdd(e) {
            const sel = $('today-capture-when');
            if (e && e.key && e.key !== 'Enter') return;
            if (sel && sel.value === 'pile') {
                const input = $('today-capture');
                const n = this.addToDoomPile(input.value);
                if (!n) return;
                input.value = '';
                this.showToast(`🧠 On the pile (${this._doom().length}). Sort it later.`);
                return;
            }
            return orig.todayQuickAdd.call(this, e);
        },

        // Chores: toolbar + ⚡ on every row + "in vault" tag.
        _choreRow(x, date, compact) {
            const html = orig.choreRow.call(this, x, date, compact);
            const c = x.chore;
            const n = (c.steps || []).length;
            const extra = `${c.vaulted ? '<span class="text-[10px] font-bold text-slate-400" title="Parked in the Someday Vault">🗄️ vault</span>' : ''}
                <button onclick="app.openTinySteps('chore','${c.id}')" class="ad-mini steps" title="Break into tiny steps">⚡${n ? `<span class="sr-only"> ${n} steps</span>` : ''}</button>`;
            return html.replace(/<\/div>\s*$/, extra + '</div>');
        },
        renderChores() {
            orig.renderChores.call(this);
            const root = $('chores-root');
            const tabsRow = root && root.querySelector('button[onclick^="app.setChoreFilter"]');
            if (!tabsRow || !this.chores.length) return;
            const o = this._overdue();
            const v = this._vault().filter(x => x.kind === 'chore').length;
            tabsRow.parentElement.insertAdjacentHTML('beforebegin', `<div class="ad-bar mb-4">
                <button class="ad-btn" onclick="app.openPickOne('chores')">🎡 Spin for a chore</button>
                ${o.chores.length ? `<button class="ad-btn fresh" onclick="app.freshStart('chores')">🌱 Fresh start <span class="opacity-70">(${o.chores.length} overdue)</span></button>` : ''}
                <button class="ad-btn ghost" onclick="app.openVault()">🗄️ Someday${v ? ` <b>${v}</b>` : ''}</button></div>`);
        },

        // Bills: trials & return-by section.
        renderBills() {
            orig.renderBills.call(this);
            const root = $('bills-root');
            const wrap = root && root.firstElementChild;
            if (!wrap) return;
            const list = this._rescues();
            const open = list.filter(r => !r.done).sort((a, b) => this._rescueDeadline(a) - this._rescueDeadline(b));
            const done = list.filter(r => r.done);
            const saved = done.filter(r => r.kind === 'trial' && !r.kept).reduce((s, r) => s + (Number(r.amount) || 0), 0);
            const sec = document.createElement('div');
            sec.className = 'glass p-5 rounded-2xl mb-6 ad-rescues';
            sec.innerHTML = `<div class="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div><div class="text-xs font-bold uppercase tracking-widest text-slate-400">🛟 Free trials & return-by dates</div>
                    <p class="text-xs text-slate-500 mt-0.5">A countdown pins to your Dashboard 48 hours before you're charged.${saved ? ` You've rescued <b>$${saved.toFixed(2)}</b> so far.` : ''}</p></div>
                    <button class="ad-btn" onclick="app.openRescueModal()">+ Trial / return</button>
                </div>
                ${open.length ? `<div class="grid gap-2">${open.map(r => this._rescueRow(r)).join('')}</div>` : '<p class="text-sm text-slate-400 py-1">Nothing to rescue. Signed up for a free trial or bought something you might return? Add it so it can\'t sneak up on you.</p>'}`;
            const header = wrap.firstElementChild;
            if (header) header.after(sec); else wrap.prepend(sec);
        },

        // Calendar: "What fits?" banner.
        onLifeTab(tabId) {
            orig.onLifeTab.call(this, tabId);
            if (tabId === 'calendar') {
                let el = $('ad-bridge-cal');
                const head = document.querySelector('#calendar > div > div');
                if (!el && head) { el = document.createElement('div'); el.id = 'ad-bridge-cal'; el.className = 'glass p-4 rounded-2xl ad-bridge-cal'; head.after(el); }
                this.renderBridge(el, 'calendar');
            }
        },

        switchTab(tabId, ...rest) {
            const before = this.currentTab;
            if (before && before !== 'dashboard') this._noteWhere(true);
            const r = orig.switchTab.call(this, tabId, ...rest);
            if (this.currentTab === 'dashboard') this.renderPins();
            else this._noteWhere(true);
            return r;
        },

        _paletteItems() {
            return orig.paletteItems.call(this).concat([
                { id: 'act-pick-one', label: 'Pick 1 for me (spin)', icon: 'dices', keywords: 'adhd spin wheel pick one task choose random energy start stuck', sub: 'ADHD', run: () => this.openPickOne() },
                { id: 'act-micro', label: 'Just do 5 minutes', icon: 'zap', keywords: 'adhd micro start five minutes 5 min timer low dopamine', sub: 'ADHD', run: () => this.startMicro() },
                { id: 'act-tunnel', label: 'Focus tunnel (one thing)', icon: 'scan', keywords: 'adhd focus tunnel one thing anti overwhelm hide everything', sub: 'ADHD', run: () => this.openPickOne() },
                { id: 'act-fresh', label: 'Fresh start (sweep overdue to Someday)', icon: 'sprout', keywords: 'adhd fresh start bankruptcy overdue someday vault reset guilt', sub: 'ADHD', run: () => this.freshStart() },
                { id: 'act-vault', label: 'Open the Someday Vault', icon: 'archive', keywords: 'someday vault parked later overdue', sub: 'ADHD', run: () => this.openVault() },
                { id: 'act-brain-dump', label: 'Brain dump (doom pile)', icon: 'brain', keywords: 'brain dump doom pile thoughts capture inbox B', sub: 'ADHD · B', run: () => this.openBrainDump() },
                { id: 'act-doom-sort', label: 'Sort my doom pile (2-minute game)', icon: 'gamepad-2', keywords: 'sort doom pile brain dump process triage end of day', sub: 'ADHD', run: () => this.openDoomSort() },
                { id: 'act-rescue', label: 'Add a free trial / return-by alert', icon: 'life-buoy', keywords: 'free trial cancel return by refund rescue subscription charge', sub: 'ADHD', run: () => this.openRescueModal() },
                { id: 'act-daybar', label: 'Workday bar & hourly chime', icon: 'hourglass', keywords: 'time blindness day bar workday chime hourly progress', sub: 'ADHD', run: () => this.openDayBarSettings() },
                { id: 'act-ics-guide', label: 'Connect my calendar (.ics guide)', icon: 'calendar-plus', keywords: 'ics ical google outlook apple calendar connect what fits free time', sub: 'ADHD', run: () => this.openIcsGuide() }
            ]);
        },

        init() {
            orig.init.call(this);
            this._titleBase = document.title;
            // Focus timer: a "Just 5 min" button on the dashboard widget.
            const wt = $('w-timer');
            if (wt && !wt.querySelector('.ad-micro')) {
                const b = document.createElement('button');
                b.type = 'button'; b.className = 'ad-micro'; b.textContent = '⚡ Just 5 min';
                b.title = 'Lower the activation barrier: start a 5-minute micro-session';
                b.onclick = e => { e.stopPropagation(); this.startMicro(); };
                const head = wt.querySelector('.widget-head');
                if (head) head.appendChild(b);
            }
            this.renderDayBar();
            this.renderPins();
            this._decorateTasks();
            this._armTransition();
            this._rescueNotify();
            if (this.currentTab === 'calendar') this.onLifeTab('calendar');

            // Activity → "Where was I?"
            const touch = () => this._noteWhere();
            ['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, touch, { passive: true }));
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) this._noteWhere(true);
                else { this.renderDayBar(); if (this.currentTab === 'dashboard') this.renderPins(); }
            });
            window.addEventListener('pagehide', () => this._noteWhere(true));
            // Unlock audio for chimes on the first gesture.
            document.addEventListener('pointerdown', () => {
                try { const C = window.AudioContext || window.webkitAudioContext; if (C && !this._chimeCtx) this._chimeCtx = new C(); if (this._chimeCtx && this._chimeCtx.state === 'suspended') this._chimeCtx.resume(); } catch (e) {}
            }, { once: true });

            // B = brain dump from any page.
            document.addEventListener('keydown', e => {
                if ((e.key !== 'b' && e.key !== 'B') || e.metaKey || e.ctrlKey || e.altKey || typing()) return;
                if (this._cmdkOpen || document.querySelector('#life-modal.flex') || $('doom-game') || $('tunnel')) return;
                e.preventDefault();
                this.openBrainDump();
            });

            setInterval(() => {
                this.renderDayBar();
                this._chimeCheck();
                if (document.hidden) return;
                if (this.currentTab === 'dashboard') this.renderPins();
                if (this.currentTab === 'today' || this.currentTab === 'calendar') this.renderBridges();
                this._rescueNotify();
            }, 20 * 1000);
            window.addEventListener('storage', e => {
                if (e.key === 'wd_daybar') this.renderDayBar();
                if (e.key === 'wd_rescues' || e.key === 'wd_doom') this.renderPins();
            });
        }
    });

    const css = document.createElement('style');
    css.id = 'wd-adhd';
    css.textContent = `
        .sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); border:0; }
        .ad-btn { display:inline-flex; align-items:center; gap:.35rem; padding:.55rem .95rem; border-radius:.9rem; font-weight:800; font-size:.85rem; background:#4f46e5; color:#fff; transition:background .15s, transform .1s; white-space:nowrap; }
        .ad-btn:hover { background:#4338ca; } .ad-btn:active { transform:scale(.97); }
        .ad-btn.ghost { background:rgba(148,163,184,.16); color:inherit; } .ad-btn.ghost:hover { background:rgba(148,163,184,.3); }
        .ad-btn.ok { background:#10b981; } .ad-btn.ok:hover { background:#059669; }
        .ad-btn.fresh { background:#ecfdf5; color:#047857; border:1px solid #a7f3d0; } .ad-btn.fresh:hover { background:#d1fae5; }
        .dark .ad-btn.fresh { background:rgba(16,185,129,.15); color:#6ee7b7; border-color:rgba(16,185,129,.35); }
        .ad-btn.small { padding:.35rem .7rem; font-size:.75rem; border-radius:.7rem; }
        .ad-btn.big { padding:.85rem 1.3rem; font-size:1rem; justify-content:center; border-radius:1.1rem; }
        .ad-btn:disabled { opacity:.5; }
        .ad-link { font-size:.72rem; font-weight:800; color:#6366f1; } .ad-link:hover { text-decoration:underline; }
        .ad-chip { padding:.3rem .65rem; border-radius:999px; font-size:.72rem; font-weight:800; background:rgba(99,102,241,.1); color:#4f46e5; }
        .ad-chip:hover { background:rgba(99,102,241,.2); } .ad-chip:disabled { opacity:.4; }
        .ad-chip.muted { background:rgba(148,163,184,.15); color:#64748b; }
        .dark .ad-chip { color:#a5b4fc; } .dark .ad-chip.muted { color:#94a3b8; }
        .ad-bar { display:flex; flex-wrap:wrap; gap:.5rem; margin-bottom:1rem; }
        .ad-card-h { display:flex; align-items:center; justify-content:space-between; gap:.5rem; margin-bottom:.6rem; font-size:.72rem; font-weight:800; letter-spacing:.1em; text-transform:uppercase; color:#94a3b8; }
        .ad-big { font-size:1.15em; color:#4f46e5; } .dark .ad-big { color:#a5b4fc; }
        .ad-sug { display:flex; align-items:center; gap:.75rem; margin-top:.75rem; padding:.7rem .8rem; border-radius:1rem; background:rgba(99,102,241,.07); border:1px solid rgba(99,102,241,.18); }
        .ad-trans { display:flex; flex-wrap:wrap; align-items:center; gap:.4rem; margin-top:.7rem; font-size:.78rem; color:#64748b; }
        .ad-connect { display:flex; align-items:center; gap:.6rem; justify-content:space-between; margin-top:.8rem; padding-top:.7rem; border-top:1px dashed rgba(148,163,184,.4); font-size:.75rem; color:#64748b; }
        .ad-fresh { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:.5rem; margin-top:.9rem; padding:.6rem .75rem; border-radius:.9rem; background:rgba(16,185,129,.08); font-size:.8rem; color:#047857; }
        .dark .ad-fresh { color:#6ee7b7; }
        .ad-bridge-cal { flex-shrink:0; }
        .ad-mini { flex-shrink:0; display:inline-flex; align-items:center; gap:.2rem; height:1.75rem; min-width:1.75rem; padding:0 .45rem; border-radius:.6rem; font-size:.75rem; font-weight:800; background:rgba(148,163,184,.14); color:#475569; justify-content:center; }
        .dark .ad-mini { color:#cbd5e1; }
        .ad-mini:hover { background:rgba(99,102,241,.18); color:#4f46e5; }
        .ad-mini.en.unset { opacity:.45; font-size:.65rem; } .ad-mini.en.unset:hover { opacity:1; }
        .ad-mini.steps { color:#d97706; } .ad-mini.steps b { font-size:.65rem; }
        .ad-mini.go { background:#4f46e5; color:#fff; } .ad-mini.go:hover { background:#4338ca; color:#fff; } .ad-mini.go.wide { padding:0 .7rem; }
        .ad-row-acts { display:flex; gap:.3rem; align-items:center; margin-left:.4rem; }
        .ad-micro { margin-left:auto; margin-right:.25rem; padding:.25rem .6rem; border-radius:999px; font-size:.7rem; font-weight:800; background:rgba(245,158,11,.15); color:#b45309; }
        .ad-micro:hover { background:rgba(245,158,11,.28); } .dark .ad-micro { color:#fcd34d; }
        /* Gentler "carried over" instead of shaming red. */
        #task-list .text-rose-500 { color:#b45309 !important; } #task-list .bg-rose-50 { background:#fef3c7 !important; }
        .dark #task-list .text-rose-500 { color:#fcd34d !important; } .dark #task-list .dark\\:bg-rose-900\\/30 { background:rgba(245,158,11,.15) !important; }
        #chores-root .text-rose-500 { color:#b45309 !important; } .dark #chores-root .text-rose-500 { color:#fcd34d !important; }

        /* Spin */
        .seg-big { display:flex; gap:.35rem; padding:.3rem; border-radius:1rem; background:rgba(148,163,184,.14); }
        .seg-big > button { flex:1; padding:.55rem .4rem; border-radius:.75rem; font-weight:800; font-size:.85rem; color:#64748b; }
        .seg-big > button.on { background:#fff; color:#4f46e5; box-shadow:0 2px 8px -2px rgba(15,23,42,.18); }
        .dark .seg-big > button.on { background:#1e293b; color:#a5b4fc; }
        .spin-window { height:7.5rem; display:grid; place-items:center; text-align:center; padding:0 1rem; border-radius:1.4rem; overflow:hidden;
            background:linear-gradient(135deg, rgba(99,102,241,.12), rgba(236,72,153,.1)); border:2px dashed rgba(99,102,241,.3); }
        .spin-q { font-size:3rem; font-weight:900; color:#a5b4fc; }
        .spin-name { font-size:1.35rem; font-weight:900; line-height:1.2; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; }
        .spin-name.blur { opacity:.55; filter:blur(.5px); }
        .spin-name.landed { animation:ad-pop .35s ease-out; }
        @keyframes ad-pop { 0% { transform:scale(.85); opacity:.3 } 70% { transform:scale(1.06) } 100% { transform:scale(1); opacity:1 } }

        /* Tiny steps */
        .ts-list { display:grid; gap:.35rem; }
        .ts-row { display:flex; align-items:center; gap:.5rem; padding:.35rem .5rem; border-radius:.75rem; background:rgba(148,163,184,.08); }
        .ts-row.done .ts-t { text-decoration:line-through; color:#94a3b8; }
        .ts-n { font-size:.75rem; font-weight:800; color:#94a3b8; width:1.3rem; }
        .ts-t { flex:1; min-width:0; background:transparent; border:0; padding:.3rem 0; font-size:.92rem; outline:none; }
        .ts-t:focus { border-bottom:1px solid #6366f1; }
        .ts-x { color:#94a3b8; font-size:.75rem; padding:.25rem .4rem; border-radius:.5rem; } .ts-x:hover { color:#ef4444; }
        .ts-win { margin-top:.8rem; padding:.7rem .8rem; border-radius:.9rem; background:rgba(16,185,129,.1); font-weight:700; display:flex; flex-wrap:wrap; gap:.5rem; align-items:center; }
        .ics-explain p { font-size:.9rem; line-height:1.5; } .ics-explain ul { margin-top:.6rem; display:grid; gap:.3rem; font-size:.82rem; color:#475569; }
        .dark .ics-explain ul { color:#cbd5e1; }
        .ics-steps { list-style:decimal; padding-left:1.3rem; display:grid; gap:.35rem; font-size:.85rem; margin-bottom:1rem; }
        .ics-steps code, .ics-explain code { font-size:.78em; padding:0 .25rem; border-radius:.3rem; background:rgba(148,163,184,.2); }

        /* Focus tunnel + doom game share the full-screen shell */
        body.tunnel-on { overflow:hidden; }
        body.tunnel-on aside[role=navigation], body.tunnel-on #quick-capture-fab, body.tunnel-on #mobile-music-bar { display:none !important; }
        #tunnel, #doom-game { position:fixed; inset:0; z-index:420; overflow-y:auto; padding:max(1rem, env(safe-area-inset-top)) 1rem calc(1rem + env(safe-area-inset-bottom));
            background:radial-gradient(circle at 30% 0%, #312e81 0%, #0f172a 55%, #020617 100%); color:#e2e8f0; }
        .tn-top, .dg-top { display:flex; align-items:center; justify-content:space-between; gap:1rem; max-width:72rem; margin:0 auto 1rem; }
        .tn-eyebrow { font-size:.72rem; font-weight:800; letter-spacing:.2em; text-transform:uppercase; color:#a5b4fc; }
        .tn-exit { padding:.45rem .85rem; border-radius:.8rem; font-size:.8rem; font-weight:800; color:#cbd5e1; background:rgba(255,255,255,.08); }
        .tn-exit:hover { background:rgba(255,255,255,.16); }
        .tn-grid { display:grid; gap:1.5rem; max-width:72rem; margin:0 auto; grid-template-columns:minmax(0,1.4fr) minmax(0,1fr); }
        @media (max-width: 860px) { .tn-grid { grid-template-columns:1fr; } }
        .tn-main { text-align:center; padding:2rem 1rem; display:flex; flex-direction:column; align-items:center; }
        .tn-title { font-size:clamp(1.6rem, 4vw, 2.8rem); font-weight:900; line-height:1.15; max-width:36rem; }
        .tn-time { font-family:ui-monospace, SFMono-Regular, Menlo, monospace; font-size:clamp(3.5rem, 11vw, 6.5rem); font-weight:900; letter-spacing:-.04em; margin-top:1.2rem; font-variant-numeric:tabular-nums; }
        .tn-bar { width:100%; max-width:34rem; height:.9rem; border-radius:999px; background:rgba(255,255,255,.1); overflow:hidden; margin-top:.6rem; }
        #tn-fill { height:100%; border-radius:999px; background:linear-gradient(90deg, #f59e0b, #ec4899 40%, #6366f1); transition:width .5s linear; }
        .tn-ctl { display:flex; flex-wrap:wrap; justify-content:center; gap:.6rem; margin-top:1.6rem; }
        .tn-ctl .ad-btn.ghost, .tp-card .ad-btn.ghost { background:rgba(255,255,255,.1); color:#e2e8f0; }
        .tn-steps { margin-top:1.6rem; text-align:left; display:grid; gap:.35rem; width:100%; max-width:30rem; }
        .tn-steps label { display:flex; gap:.6rem; align-items:center; padding:.5rem .7rem; border-radius:.8rem; background:rgba(255,255,255,.06); cursor:pointer; }
        .tn-steps input:checked + span { text-decoration:line-through; opacity:.55; }
        .tn-main .ad-link { color:#fcd34d; }
        .tn-side { background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.08); border-radius:1.5rem; padding:1rem; display:flex; flex-direction:column; min-height:24rem; }
        .tn-side .seg-big { background:rgba(255,255,255,.07); } .tn-side .seg-big > button { color:#cbd5e1; } .tn-side .seg-big > button.on { background:#e2e8f0; color:#312e81; }
        .tn-scratch { flex:1; min-height:14rem; width:100%; resize:none; border-radius:1rem; padding:.9rem; background:rgba(2,6,23,.45); color:#e2e8f0; border:1px solid rgba(255,255,255,.08); outline:none; font-size:.95rem; line-height:1.5; }
        .tn-calc { flex:1; display:flex; flex-direction:column; gap:.5rem; }
        .tn-calc input { border-radius:1rem; padding:.9rem; background:rgba(2,6,23,.45); color:#e2e8f0; border:1px solid rgba(255,255,255,.1); font-size:1.2rem; font-family:ui-monospace, monospace; outline:none; }
        .tn-calc-out { font-size:2rem; font-weight:900; font-family:ui-monospace, monospace; text-align:right; }
        .tn-sounds { margin-top:1rem; padding-top:1rem; border-top:1px solid rgba(255,255,255,.08); }
        .tn-sounds-h { font-size:.7rem; font-weight:800; letter-spacing:.15em; text-transform:uppercase; color:#94a3b8; margin-bottom:.5rem; }
        .tn-sounds .ad-chip { background:rgba(255,255,255,.08); color:#e2e8f0; } .tn-sounds .ad-chip:hover { background:rgba(255,255,255,.18); }
        .tn-vol { display:flex; align-items:center; gap:.5rem; margin-top:.7rem; font-size:.85rem; } .tn-vol input { flex:1; accent-color:#a5b4fc; }
        .tn-prompt { position:fixed; inset:0; z-index:430; display:grid; place-items:center; background:rgba(2,6,23,.7); backdrop-filter:blur(6px); padding:1rem; }
        .tn-prompt[hidden] { display:none; }
        .tp-card { width:min(26rem, 100%); text-align:center; padding:2rem 1.5rem; border-radius:1.6rem; background:#1e1b4b; border:1px solid rgba(255,255,255,.12); box-shadow:0 30px 60px -20px rgba(0,0,0,.6); }
        .tp-card .text-slate-500 { color:#a5b4fc !important; }

        /* Day depleting bar */
        #day-bar { position:fixed; top:0; left:0; right:0; height:4px; z-index:450; background:rgba(148,163,184,.18); padding:0; border:0; cursor:pointer; top:env(safe-area-inset-top, 0px); }
        #day-bar::before { content:''; position:absolute; left:0; right:0; top:0; height:14px; }
        #day-bar .db-fill { position:absolute; left:0; top:0; bottom:0; background:linear-gradient(90deg, #34d399, #6366f1); border-radius:0 3px 3px 0; transition:width 1s linear; }
        #day-bar.late .db-fill { background:linear-gradient(90deg, #34d399, #6366f1 50%, #f59e0b); }
        #day-bar.over .db-fill { background:#94a3b8; }
        #day-bar .db-tip { position:absolute; top:8px; left:50%; transform:translate(-50%, -4px); white-space:nowrap; padding:.3rem .7rem; border-radius:.6rem; font-size:.72rem; font-weight:700; background:#0f172a; color:#e2e8f0; opacity:0; pointer-events:none; transition:opacity .15s, transform .15s; }
        @media (hover: hover) { #day-bar:hover .db-tip { opacity:1; transform:translate(-50%, 0); } }
        #day-bar:focus-visible .db-tip { opacity:1; transform:translate(-50%, 0); }
        @media print { #day-bar { display:none; } }

        /* Dashboard pins */
        .ad-pins { display:grid; gap:.6rem; margin-bottom:1rem; } .ad-pins[hidden] { display:none; }
        .rescue { display:flex; flex-wrap:wrap; align-items:center; gap:.6rem .8rem; padding:.7rem .9rem; border-radius:1rem; background:rgba(148,163,184,.1); }
        .rescue-ico { font-size:1.4rem; }
        .rescue-when { display:block; font-size:.78rem; color:#64748b; }
        .rescue-acts { display:flex; flex-wrap:wrap; align-items:center; gap:.4rem; }
        .rescue.urgent { background:#fff7ed; border:1px solid #fdba74; }
        .rescue.urgent .rescue-when { color:#c2410c; }
        .rescue.late { background:#fef2f2; border-color:#fca5a5; }
        .dark .rescue.urgent { background:rgba(249,115,22,.12); border-color:rgba(249,115,22,.45); } .dark .rescue.urgent .rescue-when { color:#fdba74; }
        .rescue.banner { box-shadow:0 10px 30px -18px rgba(234,88,12,.7); }
        .rescue.banner.urgent { animation:ad-glow 2.4s ease-in-out infinite; }
        @keyframes ad-glow { 50% { box-shadow:0 10px 34px -12px rgba(234,88,12,.85); } }
        @media (prefers-reduced-motion: reduce) { .rescue.banner.urgent { animation:none; } }
        .where-card { display:flex; flex-wrap:wrap; align-items:center; gap:.6rem .9rem; padding:.85rem 1rem; border-radius:1.1rem;
            background:linear-gradient(135deg, rgba(99,102,241,.1), rgba(14,165,233,.08)); border:1px solid rgba(99,102,241,.25); }
        .where-ico { font-size:1.5rem; }
        .where-card > .min-w-0, .rescue > .min-w-0 { flex:1 1 14rem; }
        .where-k { display:block; font-size:.68rem; font-weight:800; letter-spacing:.12em; text-transform:uppercase; color:#6366f1; }
        .where-crumb { display:block; font-size:.78rem; color:#64748b; font-style:italic; margin-top:.15rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .where-x { color:#94a3b8; padding:.3rem .5rem; border-radius:.5rem; } .where-x:hover { color:#475569; }
        .doom-nudge { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:.5rem; padding:.65rem .9rem; border-radius:1rem; background:rgba(168,85,247,.09); border:1px solid rgba(168,85,247,.25); font-size:.88rem; }
        .doom-row { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:.5rem; margin-top:.6rem; font-size:.75rem; color:#64748b; }
        .doom-row kbd, .dg-help kbd { padding:0 .3rem; border:1px solid currentColor; border-radius:.3rem; font-size:.7rem; }
        .doom-row [hidden] { display:none; }

        /* Doom pile sort game */
        .dg-title { font-weight:900; font-size:1.05rem; }
        .dg-clock { font-family:ui-monospace, monospace; font-weight:800; font-size:1.1rem; padding:.25rem .7rem; border-radius:.7rem; background:rgba(255,255,255,.08); }
        .dg-clock.over { color:#fcd34d; font-size:.85rem; }
        .dg-prog { max-width:40rem; margin:0 auto; height:.5rem; border-radius:999px; background:rgba(255,255,255,.1); overflow:hidden; }
        .dg-prog > div { height:100%; background:linear-gradient(90deg, #a855f7, #6366f1); transition:width .25s; }
        .dg-count { text-align:center; font-size:.8rem; color:#94a3b8; margin:.6rem 0 1rem; font-weight:700; }
        .dg-card { max-width:40rem; margin:0 auto; min-height:12rem; display:flex; flex-direction:column; justify-content:center; text-align:center; padding:2rem 1.5rem; border-radius:1.6rem;
            background:#f8fafc; color:#0f172a; box-shadow:0 30px 60px -25px rgba(0,0,0,.7); transition:transform .17s ease-in, opacity .17s ease-in; }
        .dg-card.in { animation:dg-in .22s ease-out; }
        @keyframes dg-in { from { transform:translateY(16px) scale(.97); opacity:0; } }
        .dg-card.out-t { transform:translate(-60%, 20%) rotate(-8deg); opacity:0; } .dg-card.out-c { transform:translate(-25%, 60%) rotate(-3deg); opacity:0; }
        .dg-card.out-b { transform:translate(25%, 60%) rotate(3deg); opacity:0; } .dg-card.out-p { transform:translate(60%, 20%) rotate(8deg); opacity:0; }
        .dg-card.out-d { transform:scale(.6); opacity:0; } .dg-card.out-s { transform:translateX(70%); opacity:0; }
        .dg-text { font-size:clamp(1.25rem, 3.4vw, 1.9rem); font-weight:800; line-height:1.3; word-break:break-word; }
        .dg-when { font-size:.75rem; color:#64748b; margin-top:.8rem; }
        .dg-keys { max-width:40rem; margin:1.4rem auto 0; display:grid; grid-template-columns:repeat(6, minmax(0,1fr)); gap:.5rem; }
        @media (max-width: 560px) { .dg-keys { grid-template-columns:repeat(3, minmax(0,1fr)); } }
        .dg-key { display:flex; flex-direction:column; align-items:center; gap:.3rem; padding:.7rem .3rem; border-radius:1rem; background:rgba(255,255,255,.08); font-size:.75rem; font-weight:700; }
        .dg-key:hover { background:rgba(255,255,255,.16); }
        .dg-key kbd { font-family:ui-monospace, monospace; font-size:1.1rem; font-weight:900; min-width:2rem; padding:.15rem .4rem; border-radius:.5rem; background:rgba(255,255,255,.14); }
        .dg-key.k-t kbd { background:#0ea5e9; } .dg-key.k-c kbd { background:#10b981; } .dg-key.k-b kbd { background:#f59e0b; color:#1f2937; } .dg-key.k-p kbd { background:#8b5cf6; } .dg-key.k-d kbd { background:#ef4444; }
        .dg-help { text-align:center; font-size:.75rem; color:#94a3b8; margin-top:1rem; }
        .dg-done { max-width:30rem; margin:12vh auto 0; text-align:center; }
        .dg-sum { display:flex; flex-wrap:wrap; justify-content:center; gap:.5rem; } .dg-sum span { padding:.4rem .8rem; border-radius:999px; background:rgba(255,255,255,.1); font-size:.85rem; }
    `;
    document.head.appendChild(css);
})();

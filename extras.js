// ═══════════════════════════════════════════════════════════════
// EXTRAS — five usability upgrades layered on top of `app`.
//
//  1. Smart quick add   — "pay rent next friday 5pm" → dated task.
//                         wanasit/chrono (MIT), loaded on first use.
//  2. Search everything — the ⌘K palette also finds tasks, events,
//                         pages, chores and bills. krisk/Fuse (Apache-2.0).
//  3. Touch drag & drop — reorder tasks and move board cards on phones
//                         (HTML5 drag events don't fire on touch).
//                         SortableJS/Sortable (MIT).
//  4. Reminders         — timed tasks, events, bills due and today's
//                         chores, as notifications or in-app alerts.
//  5. Undo              — every delete can be taken back for a few seconds.
// ═══════════════════════════════════════════════════════════════

(() => {
    const CDN = {
        chrono: 'https://cdn.jsdelivr.net/npm/chrono-node@2.9.0/+esm',
        fuse: 'https://cdn.jsdelivr.net/npm/fuse.js@7.0.0/dist/fuse.min.js',
        sortable: 'https://cdn.jsdelivr.net/npm/sortablejs@1.15.6/Sortable.min.js'
    };
    const pad = n => String(n).padStart(2, '0');
    const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const hm = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const esc = s => app.escapeHtml(String(s ?? ''));
    const strip = html => String(html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    const fmtWhen = (date, time) => {
        if (!date) return '';
        const d = new Date(`${date}T${time || '00:00'}`);
        const day = date === ymd(new Date()) ? 'Today' : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
        return time ? `${day} · ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}` : day;
    };
    const readLocal = (k, fb) => { try { return JSON.parse(localStorage.getItem(k)) ?? fb; } catch (e) { return fb; } };

    const orig = {
        addTask: app.addTask,
        removeTask: app.removeTask,
        renderTasks: app.renderTasks,
        switchTab: app.switchTab,
        openPalette: app.openPalette,
        renderPalette: app.renderPalette,
        createBoardItem: app._createBoardItemEl,
        deleteEvent: app.deleteEvent,
        deleteBill: app.deleteBill,
        removeChore: app.removeChore,
        init: app.init
    };

    Object.assign(app, {
        // ═══════════════════════════════════════════════════════════
        // 1. SMART QUICK ADD (chrono)
        // ═══════════════════════════════════════════════════════════
        _chronoLib: null,
        _chrono() {
            if (!this._chronoLib) {
                this._chronoLib = import(CDN.chrono).catch(e => { this._chronoLib = null; throw e; });
            }
            return this._chronoLib;
        },

        // Pull a date/time out of free text. Returns { title, date, time, matched }.
        async smartParse(text) {
            const raw = String(text || '').trim();
            if (!raw) return { title: '' };
            let chrono;
            try { chrono = await this._chrono(); } catch (e) { return { title: raw }; }
            const results = chrono.parse(raw, new Date(), { forwardDate: true });
            const r = results[0];
            // Ignore bare numbers ("buy 2 eggs") — chrono only counts as a date if it found a day or time word.
            if (!r || !/[a-z]/i.test(r.text)) return { title: raw };
            const d = r.start.date();
            const hasTime = r.start.isCertain('hour');
            const title = (raw.slice(0, r.index) + ' ' + raw.slice(r.index + r.text.length))
                .replace(/\s{2,}/g, ' ')
                .replace(/\s+(on|at|by|due|for)\s*$/i, '')
                .replace(/^\s*(on|at|by|due)\s+/i, '')
                .trim();
            return { title: title || raw, date: ymd(d), time: hasTime ? hm(d) : '', matched: r.text };
        },

        // Live "📅 Fri, Nov 6 · 5:00 PM" hint under a quick-add input.
        _attachSmartHint(input, hintEl) {
            if (!input || !hintEl || input._smartHint) return;
            input._smartHint = true;
            let t = null;
            const update = async () => {
                const v = input.value.trim();
                if (v.length < 3) { hintEl.textContent = ''; return; }
                const p = await this.smartParse(v);
                if (input.value.trim() !== v) return;
                hintEl.innerHTML = p.date
                    ? `📅 <b>${esc(fmtWhen(p.date, p.time))}</b> <span class="opacity-70">— from “${esc(p.matched)}”</span>`
                    : '';
            };
            input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(update, 180); });
            input.addEventListener('focus', () => this._chrono().catch(() => {}), { once: true });
        },

        async addTask() {
            const input = document.getElementById('task-input');
            const dateInput = document.getElementById('task-date');
            const timeInput = document.getElementById('task-time');
            if (input && input.value.trim() && dateInput && !dateInput.value) {
                const p = await this.smartParse(input.value);
                if (p.date) {
                    input.value = p.title;
                    dateInput.value = p.date;
                    if (timeInput && p.time && !timeInput.value) timeInput.value = p.time;
                }
            }
            orig.addTask.call(this);
            const hint = document.getElementById('task-smart-hint');
            if (hint) hint.textContent = '';
        },

        async dashAddTask() {
            const input = document.getElementById('dash-task-input');
            const text = input ? input.value.trim() : '';
            if (!text) return;
            const p = await this.smartParse(text);
            this.tasks.push({ text: p.title, time: p.time || '', date: p.date || '', done: false, id: this._taskId ? this._taskId() : Date.now() });
            input.value = '';
            const hint = document.getElementById('dash-smart-hint');
            if (hint) hint.textContent = '';
            this.renderTasks();
            if (p.date) this.showToast(`Added for ${fmtWhen(p.date, p.time)}`);
        },

        // ═══════════════════════════════════════════════════════════
        // 2. SEARCH EVERYTHING (Fuse.js) in the command palette
        // ═══════════════════════════════════════════════════════════
        _contentIndex() {
            const out = [];
            (this.tasks || []).forEach(t => out.push({
                id: 'task-' + t.id, label: t.text, icon: t.done ? 'check-circle-2' : 'circle',
                sub: 'Task' + (t.date ? ' · ' + fmtWhen(t.date, t.time) : t.done ? ' · done' : ' · inbox'), keywords: '',
                run: () => { this.switchTab('tasks'); this.openTaskModal && this.openTaskModal(t.id); }
            }));
            (this.calEvents || []).forEach(e => out.push({
                id: 'event-' + e.id, label: e.title, icon: 'calendar-days',
                sub: 'Event · ' + fmtWhen(e.start.slice(0, 10), e.allDay ? '' : e.start.slice(11, 16)), keywords: e.notes || '',
                run: () => { this.switchTab('calendar'); this.openEventModal(e); }
            }));
            (this.pages || []).forEach(p => out.push({
                id: 'page-' + p.id, label: `${p.icon || '📝'} ${p.title || 'Untitled'}`, icon: 'notebook-pen', sub: 'Page',
                keywords: (p.data?.blocks || []).map(b => strip(b.data?.text || (b.data?.items || []).map(i => typeof i === 'string' ? i : (i.text || i.content || '')).join(' ') || (b.data?.content || []).flat().join(' '))).join(' ').slice(0, 4000),
                run: () => { this.switchTab('pages'); this.openPage(p.id); }
            }));
            (this.chores || []).forEach(c => out.push({
                id: 'chore-' + c.id, label: c.name, icon: 'sparkles', sub: `Chore · every ${c.every === 1 ? 'day' : c.every + ' days'}`, keywords: c.cat || '',
                run: () => { this.switchTab('chores'); this.openChoreDetail(c.id); }
            }));
            (this.bills || []).forEach(b => out.push({
                id: 'bill-' + b.id, label: b.name, icon: 'receipt', sub: `Bill · ${(Number(b.amount) || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' })}`, keywords: `${b.cat || ''} ${b.notes || ''}`,
                run: () => { this.switchTab('bills'); this.openBillModal(b.id); }
            }));
            return out;
        },

        openPalette(prefill) {
            if (!window.Fuse) this._loadScript(CDN.fuse).then(() => { if (this._cmdkOpen) this.renderPalette(); }).catch(() => {});
            this._chrono().catch(() => {});
            orig.openPalette.call(this, prefill);
        },

        renderPalette() {
            const query = (document.getElementById('cmdk-input').value || '').trim();
            if (!query || !window.Fuse) return orig.renderPalette.call(this);
            const items = this._paletteItems().concat(this._contentIndex());
            const fuse = new Fuse(items, {
                includeScore: true, ignoreLocation: true, threshold: 0.38, minMatchCharLength: 2,
                keys: [{ name: 'label', weight: 0.65 }, { name: 'keywords', weight: 0.25 }, { name: 'sub', weight: 0.1 }]
            });
            const results = fuse.search(query).slice(0, 18).map(r => r.item);
            // Typing a task straight into the palette: offer to add it.
            const addId = 'act-add-task';
            results.push({
                id: addId, icon: 'plus-circle', label: `Add task “${query}”`, sub: 'Action · smart dates understood',
                run: async () => {
                    const p = await this.smartParse(query);
                    this.tasks.push({ text: p.title, time: p.time || '', date: p.date || '', done: false, id: this._taskId ? this._taskId() : Date.now() });
                    this.renderTasks();
                    this.showToast(p.date ? `Task added for ${fmtWhen(p.date, p.time)}` : 'Task added to your inbox');
                }
            });
            this._cmdkResults = results;
            this._cmdkIndex = 0;
            const list = document.getElementById('cmdk-list');
            list.innerHTML = results.map((r, i) => `
                <button data-cmdk-index="${i}" role="option" aria-selected="${i === 0}"
                    class="cmdk-row w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${i === 0 ? 'bg-indigo-50 dark:bg-indigo-900/30' : 'hover:bg-slate-100/60 dark:hover:bg-slate-800/40'}">
                    <span class="p-2 rounded-lg ${r.id.startsWith('act-') || this.searchItems.some(t => t.id === r.id) ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600' : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600'} shrink-0">
                        <i data-lucide="${r.icon || 'circle'}" class="w-4 h-4"></i>
                    </span>
                    <span class="min-w-0 flex-1">
                        <span class="block font-bold text-sm truncate text-slate-700 dark:text-slate-200">${esc(r.label)}</span>
                        <span class="block text-[10px] uppercase tracking-wider text-slate-400">${esc(r.sub)}</span>
                    </span>
                </button>`).join('');
            list.querySelectorAll('.cmdk-row').forEach(btn => {
                btn.addEventListener('click', () => this.paletteExec(parseInt(btn.dataset.cmdkIndex, 10)));
                btn.addEventListener('mousemove', () => this.paletteHighlight(parseInt(btn.dataset.cmdkIndex, 10)));
            });
            this._rebuildIcons();
        },

        // ═══════════════════════════════════════════════════════════
        // 3. TOUCH-FRIENDLY DRAG & DROP (SortableJS)
        // ═══════════════════════════════════════════════════════════
        async _initSortables() {
            if (this._sortablesReady) return;
            try { await this._loadScript(CDN.sortable); } catch (e) { return; }
            if (!window.Sortable || this._sortablesReady) return;
            this._sortablesReady = true;
            const common = {
                animation: 160, forceFallback: true, fallbackTolerance: 4,
                delay: 160, delayOnTouchOnly: true, ghostClass: 'opacity-40', chosenClass: 'sortable-chosen'
            };
            const list = document.getElementById('task-list');
            if (list) Sortable.create(list, {
                ...common,
                filter: 'button, input, a', preventOnFilter: false,
                onEnd: () => {
                    // Rows can be a filtered subset: put them back into the same slots in the new order.
                    const order = [...list.children].map(el => Number(el.dataset.idx)).filter(n => !Number.isNaN(n));
                    const slots = [...order].sort((a, b) => a - b);
                    const moved = order.map(i => this.tasks[i]);
                    slots.forEach((slot, k) => { this.tasks[slot] = moved[k]; });
                    this.renderTasks();
                }
            });
            const borders = { todo: 'border-slate-400', doing: 'border-indigo-500', done: 'border-green-500' };
            ['todo', 'doing', 'done'].forEach(col => {
                const el = document.getElementById(`kb-${col}`);
                if (!el) return;
                Sortable.create(el, {
                    ...common, group: 'board', draggable: '[data-text]', filter: 'button', preventOnFilter: false,
                    onAdd: evt => { evt.item.className = evt.item.className.replace(/border-(?:slate|indigo|green)-(?:400|500)/, borders[col]); },
                    onEnd: () => { this.updateBoardCounts(); this.saveBoard(); }
                });
            });
            this._prepTaskRows();
        },

        // Rows carry their index for Sortable; native drag is disabled so the two don't fight.
        _prepTaskRows() {
            const list = document.getElementById('task-list');
            if (!list || !this._sortablesReady) return;
            [...list.children].forEach(row => {
                const m = (row.getAttribute('ondragstart') || '').match(/dragTaskStart\(event,\s*(\d+)\)/);
                if (!m) return;
                row.dataset.idx = m[1];
                ['draggable', 'ondragstart', 'ondragover', 'ondrop', 'ondragend'].forEach(a => row.removeAttribute(a));
                row.style.touchAction = 'pan-y';
            });
        },

        renderTasks() {
            orig.renderTasks.call(this);
            this._prepTaskRows();
        },

        _createBoardItemEl(col, text) {
            const item = orig.createBoardItem.call(this, col, text);
            // SortableJS handles dragging (mouse and touch); native drag would fight it.
            item.draggable = false;
            // Swap the delete handler for one that can be undone.
            const del = item.querySelector('button');
            if (del) {
                const fresh = del.cloneNode(true);
                fresh.addEventListener('click', e => {
                    e.stopPropagation();
                    const parent = item.parentElement, next = item.nextSibling;
                    item.remove();
                    this.updateBoardCounts();
                    this.saveBoard();
                    this.offerUndo(`Deleted “${text}”`, () => {
                        parent.insertBefore(item, next && next.parentElement === parent ? next : null);
                        this.updateBoardCounts();
                        this.saveBoard();
                    });
                });
                del.replaceWith(fresh);
            }
            return item;
        },

        switchTab(tabId) {
            orig.switchTab.call(this, tabId);
            if (tabId === 'tasks' || tabId === 'board') this._initSortables();
        },

        // ═══════════════════════════════════════════════════════════
        // 4. REMINDERS
        // ═══════════════════════════════════════════════════════════
        _reminderPrefs() {
            return Object.assign({ on: false, lead: 10, bills: true, chores: true }, readLocal('wd_reminder_prefs', {}));
        },

        _reminderDue() {
            const prefs = this._reminderPrefs();
            const now = Date.now();
            const today = ymd(new Date());
            const lead = prefs.lead * 60000;
            const window = 30 * 60000; // don't fire for things that ended long ago (e.g. tab was closed)
            const due = [];
            const at = (date, time) => new Date(`${date}T${time}`).getTime();
            (this.tasks || []).forEach(t => {
                if (t.done || !t.date || !t.time) return;
                const ts = at(t.date, t.time);
                if (now >= ts - lead && now < ts + window) due.push({ key: `task-${t.id}-${t.date}T${t.time}`, title: `⏰ ${t.text}`, body: ts > now ? `Starts ${fmtWhen(t.date, t.time)}` : 'Due now', tab: 'tasks' });
            });
            (this.calEvents || []).forEach(e => {
                if (e.allDay) {
                    if (e.start === today && now >= at(today, '08:00') && now < at(today, '20:00')) due.push({ key: `event-${e.id}-${today}`, title: `📅 Today: ${e.title}`, body: 'All-day event', tab: 'calendar' });
                    return;
                }
                const ts = new Date(e.start).getTime();
                if (now >= ts - lead && now < ts + window) due.push({ key: `event-${e.id}-${e.start}`, title: `📅 ${e.title}`, body: ts > now ? `Starts ${fmtWhen(e.start.slice(0, 10), e.start.slice(11, 16))}` : 'Starting now', tab: 'calendar' });
            });
            if (prefs.bills && this._billsBetween && now >= at(today, '09:00')) {
                const tomorrow = ymd(new Date(Date.now() + 86400000));
                this._billsBetween(today, tomorrow).filter(o => !o.paid && !o.bill.autopay).forEach(o => {
                    due.push({ key: `bill-${o.bill.id}-${o.date}-${o.date === today ? 'd0' : 'd1'}`, title: `💸 ${o.bill.name} is due ${o.date === today ? 'today' : 'tomorrow'}`, body: (Number(o.bill.amount) || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' }), tab: 'bills' });
                });
            }
            if (prefs.chores && this._choreSchedule && this.chorePrefs) {
                const hour = { morning: '08:00', afternoon: '13:00', evening: '18:00' }[this.chorePrefs.window] || '18:00';
                if (now >= at(today, hour) && now < at(today, '22:00')) {
                    const left = (this._choreSchedule(today, 1)[today] || []).filter(x => !x.doneToday);
                    if (left.length) due.push({ key: `chores-${today}`, title: `🧹 Chore time: ${left.length} to do`, body: `About ${left.reduce((n, x) => n + x.chore.mins, 0)} min · start with “${left[0].chore.name}”`, tab: 'chores' });
                }
            }
            return due;
        },

        _checkReminders() {
            if (!this._reminderPrefs().on) return;
            const fired = readLocal('webdesks-reminders-fired', {});
            const cutoff = Date.now() - 3 * 86400000;
            Object.keys(fired).forEach(k => { if (fired[k] < cutoff) delete fired[k]; });
            this._reminderDue().forEach(r => {
                if (fired[r.key]) return;
                fired[r.key] = Date.now();
                this._notify(r);
            });
            // Not a wd_ key on purpose: which alerts fired is per-device, not part of the synced Desk.
            try { localStorage.setItem('webdesks-reminders-fired', JSON.stringify(fired)); } catch (e) {}
        },

        _notify(r) {
            if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
                try {
                    const n = new Notification(r.title, { body: r.body, tag: r.key, icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🖥️</text></svg>' });
                    n.onclick = () => { window.focus(); this.switchTab(r.tab); n.close(); };
                    return;
                } catch (e) { /* fall through to the in-app alert */ }
            }
            this._inAppAlert(r);
        },

        _inAppAlert(r) {
            let stack = document.getElementById('reminder-stack');
            if (!stack) {
                stack = document.createElement('div');
                stack.id = 'reminder-stack';
                stack.className = 'fixed top-20 right-4 left-4 sm:left-auto z-[390] flex flex-col gap-2 sm:w-96';
                stack.setAttribute('role', 'alert');
                document.body.appendChild(stack);
            }
            const card = document.createElement('div');
            card.className = 'glass rounded-2xl p-4 flex items-start gap-3';
            card.innerHTML = `<div class="flex-1 min-w-0"><div class="font-bold">${esc(r.title)}</div><div class="text-sm text-slate-500">${esc(r.body)}</div></div>
                <div class="flex flex-col gap-1 shrink-0"><button data-a="open" class="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg">Open</button><button data-a="x" class="text-xs font-bold text-slate-400 hover:text-slate-600 px-3 py-1">Dismiss</button></div>`;
            card.querySelector('[data-a=open]').onclick = () => { this.switchTab(r.tab); card.remove(); };
            card.querySelector('[data-a=x]').onclick = () => card.remove();
            stack.appendChild(card);
            this.vibrate && this.vibrate([120, 60, 120]);
            try {
                const ctx = new (window.AudioContext || window.webkitAudioContext)();
                const o = ctx.createOscillator(), g = ctx.createGain();
                o.frequency.value = 880; g.gain.value = 0.06;
                o.connect(g); g.connect(ctx.destination);
                o.start(); o.stop(ctx.currentTime + 0.18);
                setTimeout(() => ctx.close(), 400);
            } catch (e) {}
            setTimeout(() => card.remove(), 60000);
        },

        openReminderSettings() {
            const p = this._reminderPrefs();
            const supported = 'Notification' in window;
            const perm = supported ? Notification.permission : 'unsupported';
            this.lifeModal('🔔 Reminders', `
                <label class="flex items-center justify-between gap-3 mb-4">
                    <span><span class="block font-bold">Remind me</span><span class="text-xs text-slate-500">Timed tasks and events, bills due, and chore time.</span></span>
                    <input id="rm-on" type="checkbox" ${p.on ? 'checked' : ''} class="w-6 h-6 accent-indigo-600">
                </label>
                ${this._field('Heads-up before timed tasks & events', `<select id="rm-lead" class="${this._inputCls}">${[0, 5, 10, 15, 30, 60].map(m => `<option value="${m}" ${p.lead === m ? 'selected' : ''}>${m ? m + ' minutes before' : 'At the time'}</option>`).join('')}</select>`)}
                <label class="flex items-center gap-2 mb-2 text-sm"><input id="rm-bills" type="checkbox" ${p.bills ? 'checked' : ''} class="w-4 h-4 accent-indigo-600"> Bills due today or tomorrow (9 AM)</label>
                <label class="flex items-center gap-2 mb-4 text-sm"><input id="rm-chores" type="checkbox" ${p.chores ? 'checked' : ''} class="w-4 h-4 accent-indigo-600"> Chore time (your chore window in Chores)</label>
                <p class="text-xs text-slate-500 mb-4">${perm === 'granted' ? '✅ System notifications are on for this browser.' : perm === 'denied' ? 'System notifications are blocked in your browser settings, so reminders appear inside WebDesks with a chime.' : supported ? 'We\'ll ask your browser for permission so reminders can pop up even when this tab is in the background.' : 'This browser can\'t show system notifications here (on iPhone, add WebDesks to your Home Screen first), so reminders appear inside WebDesks with a chime.'} Reminders work while WebDesks is open in a tab or installed as an app.</p>
                <div class="flex justify-between gap-2">
                    <button id="rm-test" class="${this._ghostBtnCls} text-sm">Send a test</button>
                    <button id="rm-save" class="${this._btnCls}">Save</button>
                </div>`, wrap => {
                wrap.querySelector('#rm-test').onclick = () => this._notify({ key: 'test', title: '🔔 This is a WebDesks reminder', body: 'Looks good!', tab: 'today' });
                wrap.querySelector('#rm-save').onclick = async () => {
                    const next = {
                        on: wrap.querySelector('#rm-on').checked,
                        lead: Number(wrap.querySelector('#rm-lead').value),
                        bills: wrap.querySelector('#rm-bills').checked,
                        chores: wrap.querySelector('#rm-chores').checked
                    };
                    localStorage.setItem('wd_reminder_prefs', JSON.stringify(next));
                    if (next.on && supported && Notification.permission === 'default') {
                        try { await Notification.requestPermission(); } catch (e) {}
                    }
                    this.closeLifeModal();
                    this.renderReminderButtons();
                    this.showToast(next.on ? 'Reminders on' : 'Reminders off');
                    this._checkReminders();
                };
            });
        },

        renderReminderButtons() {
            const on = this._reminderPrefs().on;
            document.querySelectorAll('[data-reminder-btn]').forEach(b => {
                b.innerHTML = `<i data-lucide="${on ? 'bell-ring' : 'bell-plus'}" class="w-3.5 h-3.5"></i> ${on ? 'Reminders on' : 'Reminders'}`;
                b.classList.toggle('text-indigo-600', on);
            });
            this._rebuildIcons();
        },

        // ═══════════════════════════════════════════════════════════
        // 5. UNDO
        // ═══════════════════════════════════════════════════════════
        offerUndo(message, undo) {
            document.getElementById('undo-toast')?.remove();
            const el = document.createElement('div');
            el.id = 'undo-toast';
            el.className = 'fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-[510] bg-slate-800 text-white pl-5 pr-2 py-2 rounded-full text-sm font-bold shadow-2xl flex items-center gap-3 max-w-[92vw]';
            el.setAttribute('role', 'status');
            el.innerHTML = `<span class="truncate">${esc(message)}</span><button class="bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-full">Undo</button>`;
            let done = false;
            el.querySelector('button').onclick = () => {
                if (done) return;
                done = true;
                el.remove();
                undo();
                this.showToast('Restored');
            };
            document.body.appendChild(el);
            setTimeout(() => { done = true; el.remove(); }, 7000);
        },

        removeTask(index) {
            const task = this.tasks[index];
            orig.removeTask.call(this, index);
            if (task) this.offerUndo(`Deleted “${task.text}”`, () => { this.tasks.splice(Math.min(index, this.tasks.length), 0, task); this.renderTasks(); });
        },

        deleteEvent(id) {
            const i = this.calEvents.findIndex(e => e.id === id);
            const ev = this.calEvents[i];
            orig.deleteEvent.call(this, id);
            if (ev) this.offerUndo(`Deleted “${ev.title}”`, () => { this.calEvents.splice(i, 0, ev); this._saveEvents(); this.lifeRefresh(); });
        },

        deleteBill(id) {
            const i = this.bills.findIndex(b => b.id === id);
            const bill = this.bills[i];
            orig.deleteBill.call(this, id);
            if (bill) this.offerUndo(`Deleted “${bill.name}”`, () => { this.bills.splice(i, 0, bill); this._saveBills(); this.lifeRefresh(); this.renderBills(); });
        },

        removeChore(id) {
            const i = this.chores.findIndex(c => c.id === id);
            const chore = this.chores[i];
            orig.removeChore.call(this, id);
            if (chore) this.offerUndo(`Removed “${chore.name}”`, () => { this.chores.splice(i, 0, chore); this._saveChores(); this.lifeRefresh(); this.renderChores(); });
        },

        // Replaces the confirm() dialog with an undoable delete.
        async deletePage() {
            await this._flushPage();
            const i = this.pages.findIndex(p => p.id === this._editorPage);
            const page = this.pages[i];
            if (!page) return;
            this.pages.splice(i, 1);
            this._savePages();
            this._editorPage = null;
            if (!this.pages.length) this.newPage('blank', true);
            this.openPage([...this.pages].sort((a, b) => b.updated - a.updated)[0].id);
            this.offerUndo(`Deleted “${page.title || 'Untitled'}”`, () => {
                this.pages.splice(i, 0, page);
                this._savePages();
                this.openPage(page.id);
            });
        },

        init() {
            orig.init.call(this);
            // Smart-date hints under the quick-add boxes.
            const taskInput = document.getElementById('task-input');
            if (taskInput && !document.getElementById('task-smart-hint')) {
                const hint = document.createElement('div');
                hint.id = 'task-smart-hint';
                hint.className = 'text-xs text-indigo-600 dark:text-indigo-300 -mt-3 mb-4 px-3 min-h-[1rem]';
                taskInput.closest('.glass').after(hint);
                taskInput.placeholder = 'Add a task — e.g. “rent fri 5pm”';
                this._attachSmartHint(taskInput, hint);
            }
            const dashInput = document.getElementById('dash-task-input');
            if (dashInput && !document.getElementById('dash-smart-hint')) {
                const hint = document.createElement('div');
                hint.id = 'dash-smart-hint';
                hint.className = 'text-xs text-indigo-600 dark:text-indigo-300 mt-2 px-1 min-h-[1rem]';
                dashInput.parentElement.after(hint);
                dashInput.placeholder = 'Quick add — “call mom tomorrow 6pm”';
                this._attachSmartHint(dashInput, hint);
            }
            const dashSearch = document.getElementById('dash-search');
            if (dashSearch) dashSearch.placeholder = 'Search tools, tasks, pages… (⌘K)';
            // Reminder button in the Tasks header.
            const stats = document.getElementById('task-stats');
            if (stats && !stats.parentElement.querySelector('[data-reminder-btn]')) {
                const b = document.createElement('button');
                b.dataset.reminderBtn = '1';
                b.className = 'glass px-3 py-1.5 rounded-xl text-xs font-bold uppercase flex items-center gap-1.5 hover:ring-2 hover:ring-indigo-400 transition-all';
                b.onclick = () => this.openReminderSettings();
                stats.after(b);
            }
            this.paletteActions.push({ id: 'act-reminders', label: 'Reminder settings', icon: 'bell-ring', keywords: 'notify notification alert remind alarm', run() { app.openReminderSettings(); } });
            this.renderReminderButtons();
            this._checkReminders();
            setInterval(() => this._checkReminders(), 30000);
            document.addEventListener('visibilitychange', () => { if (!document.hidden) this._checkReminders(); });
            if (this.currentTab === 'tasks' || this.currentTab === 'board') this._initSortables();
        }
    });
})();

// ═══════════════════════════════════════════════════════════════
// LIFE PLANNER — Today check-in, Calendar, Pages, Chores, Bills
//
// Extends the `app` object defined in index.html. Everything is
// stored in localStorage like the rest of WebDesks; the two heavy
// libraries are fetched lazily the first time their tab opens:
//   - fullcalendar/fullcalendar  (MIT)        → Calendar month/week/day/list
//   - codex-team/editor.js       (Apache-2.0) → Notion-style block pages
//   - catdad/canvas-confetti     (ISC)        → the "you did it" moment
// The chore scheduler and the recurrence maths are written here
// against plain Date objects; their shape follows Super Productivity
// (daily planning ritual), Loop Habit Tracker (frequency + streaks)
// and Daylio-style mood logging (year in pixels).
// ═══════════════════════════════════════════════════════════════

(() => {
    const CDN = {
        fullcalendar: 'https://cdn.jsdelivr.net/npm/fullcalendar@6.1.15/index.global.min.js',
        confetti: 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.js',
        editor: [
            'https://cdn.jsdelivr.net/npm/@editorjs/editorjs@2.31.0/dist/editorjs.umd.js',
            'https://cdn.jsdelivr.net/npm/@editorjs/header@2.8.8/dist/header.umd.js',
            'https://cdn.jsdelivr.net/npm/@editorjs/list@2.0.8/dist/editorjs-list.umd.js',
            'https://cdn.jsdelivr.net/npm/@editorjs/checklist@1.6.0/dist/checklist.umd.js',
            'https://cdn.jsdelivr.net/npm/@editorjs/quote@2.7.6/dist/quote.umd.js',
            'https://cdn.jsdelivr.net/npm/@editorjs/delimiter@1.4.2/dist/delimiter.umd.js',
            'https://cdn.jsdelivr.net/npm/@editorjs/table@2.4.5/dist/table.umd.js',
            'https://cdn.jsdelivr.net/npm/@editorjs/marker@1.4.0/dist/marker.umd.js',
            'https://cdn.jsdelivr.net/npm/@editorjs/inline-code@1.5.1/dist/inline-code.umd.js'
        ]
    };

    // ── Date helpers (local calendar days as YYYY-MM-DD strings) ─────
    const pad = n => String(n).padStart(2, '0');
    const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
    const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
    const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
    const todayStr = () => ymd(new Date());
    const hm = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const fmtDay = s => parse(s).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    const fmtTime = t => {
        if (!t) return '';
        const [h, m] = t.split(':').map(Number);
        return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    };
    const money = n => (Number(n) || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
    const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const load = (k, fb) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? fb; } catch (e) { return fb; } };
    const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { app.showToast('Storage is full — export something and clear space'); } };
    const esc = s => app.escapeHtml(String(s ?? ''));

    // ── Premade ADHD-friendly chore library ──────────────────────────
    // [id, name, minutes, energy 1-3, every N days, steps]
    const CHORE_LIBRARY = {
        'Daily basics': [
            ['make-bed', 'Make the bed', 3, 1, 1, ['Pull the sheet straight', 'Fluff pillows', 'Blanket on top — done is better than perfect']],
            ['meds', 'Take meds / vitamins', 1, 1, 1],
            ['water-bottle', 'Fill your water bottle', 2, 1, 1],
            ['dishes', 'Do the dishes (or load the dishwasher)', 15, 2, 1, ['Clear the sink', 'Load or wash 10 items', 'Wipe the sink']],
            ['wipe-counters', 'Wipe kitchen counters', 5, 1, 1],
            ['ten-min-tidy', '10-minute tidy', 10, 1, 1, ['Set a 10-min timer', 'Grab a basket', 'Put away anything out of place until the timer ends']],
            ['tomorrow-clothes', 'Lay out tomorrow\'s clothes', 3, 1, 1],
            ['check-calendar', 'Look at tomorrow\'s calendar', 3, 1, 1],
            ['pack-bag', 'Pack bag / keys / wallet by the door', 3, 1, 1]
        ],
        'Kitchen': [
            ['empty-dishwasher', 'Empty the dishwasher', 7, 1, 2],
            ['take-trash', 'Take out the trash', 5, 1, 3],
            ['recycling', 'Take out recycling', 5, 1, 7],
            ['clean-fridge', 'Toss old food from the fridge', 10, 1, 7],
            ['wipe-appliances', 'Wipe stove & microwave', 10, 2, 7],
            ['mop-kitchen', 'Sweep & mop kitchen floor', 20, 3, 7],
            ['meal-plan', 'Plan meals for the week', 15, 2, 7, ['Check what\'s in the fridge', 'Pick 4 easy dinners', 'Write the grocery list']],
            ['deep-fridge', 'Deep clean the fridge', 30, 3, 30]
        ],
        'Bathroom': [
            ['wipe-sink', 'Wipe bathroom sink & mirror', 5, 1, 3],
            ['clean-toilet', 'Clean the toilet', 7, 2, 7],
            ['clean-shower', 'Scrub shower / tub', 20, 3, 7],
            ['bath-towels', 'Swap bath towels', 3, 1, 7],
            ['bath-floor', 'Mop bathroom floor', 10, 2, 14],
            ['restock-tp', 'Restock toilet paper & soap', 3, 1, 14]
        ],
        'Bedroom & laundry': [
            ['laundry-wash', 'Start a load of laundry', 5, 1, 4, ['Grab the basket', 'Load the machine', 'Set a phone alarm to move it!']],
            ['laundry-fold', 'Fold & put away laundry', 15, 2, 4, ['Dump it on the bed (now you have to)', 'Fold shirts first', 'Put away by room']],
            ['change-sheets', 'Change the sheets', 15, 2, 7],
            ['clothes-chair', 'Clear "the chair" of clothes', 10, 1, 7],
            ['declutter-closet', 'Declutter 5 things from the closet', 15, 2, 30]
        ],
        'Living spaces': [
            ['vacuum', 'Vacuum main areas', 20, 3, 7],
            ['dust', 'Dust surfaces', 15, 2, 14],
            ['reset-couch', 'Reset couch & coffee table', 5, 1, 2],
            ['entry-reset', 'Clear the entryway / shoes', 5, 1, 7],
            ['windows', 'Wipe windows & glass doors', 20, 2, 30],
            ['desk-reset', 'Reset your desk', 10, 1, 7]
        ],
        'Self-care': [
            ['shower', 'Shower', 15, 2, 1],
            ['brush-teeth', 'Brush teeth (morning & night)', 4, 1, 1],
            ['skincare', 'Skincare', 5, 1, 1],
            ['move', 'Move your body for 15 min', 15, 2, 1, ['Shoes on', 'Walk around the block or stretch', 'Anything counts']],
            ['outside', 'Get 10 min of daylight', 10, 1, 1],
            ['hair-nails', 'Trim nails', 10, 1, 14],
            ['call-friend', 'Text or call someone you love', 10, 1, 7]
        ],
        'Admin & money': [
            ['check-bank', 'Check bank balance', 3, 1, 3],
            ['inbox-zero', 'Clear 10 emails', 10, 2, 2],
            ['open-mail', 'Open physical mail', 5, 1, 3],
            ['pay-bills', 'Review & pay upcoming bills', 15, 2, 7, ['Open the Bills tab', 'Pay anything due this week', 'Mark them paid']],
            ['budget-review', 'Weekly money check-in', 20, 2, 7],
            ['subscriptions', 'Review subscriptions', 15, 2, 30],
            ['backup-phone', 'Back up phone photos', 10, 1, 30],
            ['appointments', 'Book any overdue appointments', 10, 3, 30]
        ],
        'Errands': [
            ['groceries', 'Grocery run / order', 45, 3, 7],
            ['refill-rx', 'Refill prescriptions', 10, 2, 30],
            ['returns', 'Drop off returns / donations', 20, 2, 14],
            ['gas', 'Fill up the car', 10, 1, 7]
        ],
        'Outdoor & car': [
            ['car-trash', 'Clear trash out of the car', 5, 1, 7],
            ['water-garden', 'Water the yard / garden', 10, 1, 3],
            ['mow', 'Mow the lawn', 40, 3, 10],
            ['wash-car', 'Wash the car', 30, 3, 30],
            ['tire-check', 'Check tire pressure', 10, 1, 30]
        ],
        'Pets & plants': [
            ['feed-pet', 'Feed pets', 3, 1, 1],
            ['walk-dog', 'Walk the dog', 20, 2, 1],
            ['litter', 'Scoop the litter box', 5, 1, 1],
            ['water-plants', 'Water houseplants', 10, 1, 7],
            ['pet-meds', 'Pet flea / heartworm meds', 3, 1, 30]
        ],
        'Seasonal & deep clean': [
            ['smoke-detectors', 'Test smoke detectors', 10, 1, 90],
            ['hvac-filter', 'Replace HVAC filter', 10, 1, 90],
            ['mattress-flip', 'Rotate mattress', 15, 3, 90],
            ['baseboards', 'Wipe baseboards', 30, 3, 90],
            ['oven', 'Clean the oven', 40, 3, 90],
            ['gutters', 'Clean gutters', 60, 3, 180]
        ]
    };
    const CHORE_INDEX = {};
    Object.entries(CHORE_LIBRARY).forEach(([cat, items]) => items.forEach(([id, name, mins, energy, every, steps]) => {
        CHORE_INDEX[id] = { id, name, mins, energy, every, steps: steps || [], cat };
    }));

    const ROUTINE_PACKS = [
        { id: 'morning', name: 'Morning launch', icon: 'sunrise', ids: ['make-bed', 'meds', 'water-bottle', 'brush-teeth', 'outside'] },
        { id: 'evening', name: 'Evening shutdown', icon: 'moon', ids: ['dishes', 'wipe-counters', 'tomorrow-clothes', 'check-calendar', 'pack-bag'] },
        { id: 'reset', name: 'Weekly home reset', icon: 'sparkles', ids: ['change-sheets', 'vacuum', 'clean-toilet', 'take-trash', 'clean-fridge', 'laundry-wash', 'laundry-fold'] },
        { id: 'money', name: 'Money on autopilot', icon: 'wallet', ids: ['check-bank', 'open-mail', 'pay-bills', 'budget-review', 'subscriptions'] },
        { id: 'starter', name: 'ADHD starter kit (low effort)', icon: 'rocket', ids: ['make-bed', 'meds', 'ten-min-tidy', 'dishes', 'laundry-wash', 'take-trash', 'open-mail'] }
    ];
    const ENERGY = { 1: { label: 'Low', icon: '🔋', cls: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30' }, 2: { label: 'Medium', icon: '⚡', cls: 'text-amber-600 bg-amber-50 dark:bg-amber-900/30' }, 3: { label: 'High', icon: '🔥', cls: 'text-rose-600 bg-rose-50 dark:bg-rose-900/30' } };
    const WINDOW_HOUR = { morning: 8, afternoon: 13, evening: 18 };

    const BILL_CATS = ['Housing', 'Utilities', 'Phone & internet', 'Insurance', 'Loan / debt', 'Credit card', 'Subscription', 'Car', 'Health', 'Kids / school', 'Other'];
    const FREQS = { once: 'One time', weekly: 'Weekly', biweekly: 'Every 2 weeks', monthly: 'Monthly', quarterly: 'Every 3 months', yearly: 'Yearly' };
    const PER_MONTH = { once: 0, weekly: 52 / 12, biweekly: 26 / 12, monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 };

    const PAGE_ICONS = ['📝', '🌈', '📓', '🧠', '🎯', '💸', '🍽️', '🏡', '📚', '💡', '🌱', '✨', '🗂️', '❤️'];
    const p = text => ({ type: 'paragraph', data: { text } });
    const h = (text, level = 2) => ({ type: 'header', data: { text, level } });
    const check = items => ({ type: 'checklist', data: { items: items.map(t => ({ text: t, checked: false })) } });
    const ul = items => ({ type: 'list', data: { style: 'unordered', meta: {}, items: items.map(t => ({ content: t, meta: {}, items: [] })) } });
    const PAGE_TEMPLATES = {
        blank: { title: 'Untitled', icon: '📝', blocks: [] },
        journal: { title: () => 'Journal — ' + fmtDay(todayStr()), icon: '📓', blocks: [
            h('How am I feeling?'), p('Mood: … &nbsp;Energy: … &nbsp;Sleep: …'),
            h('Three things I\'m grateful for'), ul(['', '', '']),
            h('Today\'s one big thing'), p(''),
            h('Brain dump'), p('Get it out of your head so it stops buzzing.')
        ] },
        moodboard: { title: 'Mood board', icon: '🌈', blocks: [
            h('Vibe for this season', 1), p('Words, colours, quotes, songs — anything that feels like the life you want right now.'),
            h('Words'), ul(['Calm', 'Capable', '']),
            h('Colours & textures'), p(''),
            { type: 'quote', data: { text: 'You don\'t have to see the whole staircase, just take the first step.', caption: 'Martin Luther King Jr.', alignment: 'left' } },
            h('Things that make me feel good'), check(['A walk outside', 'My favourite playlist', 'Something new here…']),
            h('Next 90 days'), p('')
        ] },
        weekly: { title: () => 'Weekly review — week of ' + fmtDay(todayStr()), icon: '🎯', blocks: [
            h('Wins this week'), ul(['']),
            h('What got in the way?'), p(''),
            h('Bills & money'), check(['Checked the Bills tab', 'Paid everything due next week', 'Looked at bank balance']),
            h('Top 3 for next week'), check(['Priority one', 'Priority two', 'Priority three']),
            { type: 'delimiter', data: {} },
            p('Be kind to yourself — progress, not perfection.')
        ] },
        braindump: { title: 'Brain dump', icon: '🧠', blocks: [
            h('Everything on my mind'), p('Type it all. Don\'t organise yet.'),
            h('Sort it'), {
                type: 'table', data: { withHeadings: true, content: [['Do today', 'This week', 'Someday', 'Let go'], ['', '', '', '']] }
            }
        ] },
        budget: { title: 'Money notes', icon: '💸', blocks: [
            h('Income'), {
                type: 'table', data: { withHeadings: true, content: [['Source', 'Amount', 'When'], ['Paycheck', '', ''], ['', '', '']] }
            },
            h('Savings goals'), check(['Emergency fund', 'Next big thing']),
            h('Notes'), p('Bills live in the Bills tab and show up on your calendar automatically.')
        ] },
        meals: { title: 'Meal plan', icon: '🍽️', blocks: [
            h('This week'), {
                type: 'table', data: { withHeadings: true, content: [['Day', 'Breakfast', 'Lunch', 'Dinner'], ['Mon', '', '', ''], ['Tue', '', '', ''], ['Wed', '', '', ''], ['Thu', '', '', ''], ['Fri', '', '', ''], ['Sat', '', '', ''], ['Sun', '', '', '']] }
            },
            h('Grocery list'), check(['Milk', 'Eggs', 'Veggies'])
        ] },
        goals: { title: 'Goals', icon: '🌱', blocks: [
            h('This year', 1), ul(['']),
            h('This month'), check(['One small step toward a goal']),
            h('Why it matters'), p('')
        ] }
    };
    const TEMPLATE_LABELS = { blank: 'Blank page', journal: 'Daily journal', moodboard: 'Mood board', weekly: 'Weekly review', braindump: 'Brain dump', budget: 'Money notes', meals: 'Meal plan', goals: 'Goals' };

    Object.assign(app, {
        // ── State ───────────────────────────────────────────────────
        calEvents: [],
        bills: [],
        chores: [],
        chorePrefs: null,
        pages: [],
        checkins: {},
        _lifeReady: false,
        _calendar: null,
        _editor: null,
        _choreFilter: 'today',
        _choreTimer: null,

        initLife() {
            this.calEvents = load('wd_cal_events', []);
            this.bills = load('wd_bills', []);
            this.chores = load('wd_chores', []);
            this.chorePrefs = Object.assign({ budget: 45, offDays: [], window: 'evening', points: 0 }, load('wd_chore_prefs', {}));
            this.pages = load('wd_pages', []);
            this.checkins = load('wd_checkins', {});
            // Older tasks may predate ids; the planner addresses tasks by id.
            this.tasks.forEach(t => { if (!t.id) t.id = this._taskId(); });
            this.calLayers = Object.assign({ event: true, task: true, chore: true, bill: true }, load('wd_cal_layers', {}));
            this._lifeReady = true;
            this.renderToday();
            this.renderChores();
            this.renderBills();
            this.renderPagesList();
            this.renderLifeDashCard();
            // Roll the day over if the tab is left open past midnight.
            this._lifeDay = todayStr();
            setInterval(() => {
                if (this._lifeDay !== todayStr()) { this._lifeDay = todayStr(); this.lifeRefresh(); }
            }, 60000);
        },

        _taskId() {
            let id = Date.now();
            while (this.tasks.some(t => t.id === id)) id++;
            return id;
        },

        // Called by the main switchTab when one of the planner tabs opens.
        onLifeTab(tabId) {
            if (!this._lifeReady) return;
            if (tabId === 'calendar') this.initCalendar();
            if (tabId === 'pages') this.initPages();
            if (tabId === 'today') this.renderToday();
            if (tabId === 'chores') this.renderChores();
        },

        // Anything that changes tasks/chores/bills/events calls this so every view stays in sync.
        lifeRefresh() {
            if (!this._lifeReady) return;
            this.renderToday();
            this.renderLifeDashCard();
            if (this.currentTab === 'chores') this.renderChores();
            if (this.currentTab === 'bills') this.renderBills();
            if (this._calendar) this._calendar.refetchEvents();
        },

        // Open the Today check-in automatically on the first visit of the day.
        lifeMorningRedirect() {
            const prefs = load('wd_today_prefs', { autoOpen: true });
            if (!prefs.autoOpen || location.hash) return;
            if (localStorage.getItem('wd_today_opened') === todayStr()) return;
            localStorage.setItem('wd_today_opened', todayStr());
            this.switchTab('today');
        },

        _celebrate(msg) {
            if (msg) this.showToast(msg);
            this.vibrate?.([30, 20, 60]);
            this._loadScript(CDN.confetti).then(() => {
                if (typeof confetti === 'function') confetti({ particleCount: 90, spread: 70, origin: { y: 0.7 }, disableForReducedMotion: true });
            }).catch(() => {});
        },

        // ── Modal ───────────────────────────────────────────────────
        lifeModal(title, bodyHtml, onMount) {
            let wrap = document.getElementById('life-modal');
            if (!wrap) {
                wrap = document.createElement('div');
                wrap.id = 'life-modal';
                wrap.className = 'fixed inset-0 z-[360] hidden items-center justify-center bg-slate-950/50 backdrop-blur-sm p-4';
                wrap.setAttribute('role', 'dialog');
                wrap.setAttribute('aria-modal', 'true');
                wrap.addEventListener('click', e => { if (e.target === wrap) this.closeLifeModal(); });
                document.addEventListener('keydown', e => { if (e.key === 'Escape' && !wrap.classList.contains('hidden')) this.closeLifeModal(); });
                document.body.appendChild(wrap);
            }
            wrap.innerHTML = `
                <div class="glass bg-white/95 dark:bg-slate-900/95 w-full max-w-lg rounded-3xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-xl font-black">${title}</h3>
                        <button onclick="app.closeLifeModal()" class="p-2 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700" aria-label="Close"><i data-lucide="x" class="w-5 h-5"></i></button>
                    </div>
                    ${bodyHtml}
                </div>`;
            wrap.classList.remove('hidden');
            wrap.classList.add('flex');
            this._rebuildIcons();
            if (onMount) onMount(wrap);
            const first = wrap.querySelector('input:not([type=hidden]),textarea,select');
            if (first) setTimeout(() => first.focus(), 30);
        },

        closeLifeModal() {
            const wrap = document.getElementById('life-modal');
            if (wrap) { wrap.classList.add('hidden'); wrap.classList.remove('flex'); }
        },

        _field(label, input) {
            return `<label class="block mb-3"><span class="block text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1">${label}</span>${input}</label>`;
        },
        _inputBase: 'bg-white/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500',
        _inputCls: 'w-full bg-white/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500',
        _btnCls: 'bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold transition-colors',
        _ghostBtnCls: 'glass px-4 py-2.5 rounded-xl font-bold hover:bg-slate-200/70 dark:hover:bg-slate-700/70 transition-colors',

        // ═══════════════════════════════════════════════════════════
        // TODAY — the morning check-in
        // ═══════════════════════════════════════════════════════════
        _checkin(date = todayStr()) {
            if (!this.checkins[date]) this.checkins[date] = { energy: 0, note: '', top: [{ t: '', d: false }, { t: '', d: false }, { t: '', d: false }] };
            return this.checkins[date];
        },

        _saveCheckins() {
            // Keep about a year of history.
            const keys = Object.keys(this.checkins).sort();
            while (keys.length > 400) delete this.checkins[keys.shift()];
            save('wd_checkins', this.checkins);
        },

        _moodFor(date) {
            const hist = load('wd_mood_history', []);
            const e = hist.find(x => x.date === parse(date).toDateString());
            return e ? e.mood : 0;
        },

        todaySetMood(level) {
            this.setMood(level);
            this._checkin().checked = true;
            this._saveCheckins();
            this.renderToday();
        },

        todaySetEnergy(level) {
            this._checkin().energy = level;
            this._checkin().checked = true;
            this._saveCheckins();
            this.renderToday();
            if (this.currentTab === 'chores') this.renderChores();
        },

        todaySetTop(i, field, value) {
            const c = this._checkin();
            c.top[i][field] = value;
            this._saveCheckins();
            if (field === 'd') {
                if (value) this._celebrate('Priority done! 🎉');
                this.renderToday();
            }
        },

        todaySetNote(value) {
            this._checkin().note = value;
            this._saveCheckins();
        },

        todayQuickAdd(e) {
            if (e && e.key && e.key !== 'Enter') return;
            const input = document.getElementById('today-capture');
            const text = input.value.trim();
            if (!text) return;
            const when = document.getElementById('today-capture-when').value;
            const date = when === 'today' ? todayStr() : when === 'tomorrow' ? addDays(todayStr(), 1) : '';
            this.tasks.push({ text, time: '', date, done: false, id: this._taskId() });
            input.value = '';
            this.renderTasks();
            this.showToast(date ? `Added to ${when}` : 'Added to your inbox');
        },

        todayToggleTask(id) {
            const i = this.tasks.findIndex(t => t.id === id);
            if (i < 0) return;
            this.toggleTask(i);
            if (this.tasks[i] && this.tasks[i].done) this._celebrate();
        },

        todayMoveTask(id, days) {
            const t = this.tasks.find(x => x.id === id);
            if (!t) return;
            t.date = addDays(todayStr(), days);
            this.renderTasks();
            this.showToast(days === 1 ? 'Moved to tomorrow — no guilt' : 'Rescheduled');
        },

        _checkinStreak() {
            let n = 0, d = todayStr();
            if (!this.checkins[d]?.checked) d = addDays(d, -1);
            while (this.checkins[d]?.checked || this._moodFor(d)) { n++; d = addDays(d, -1); }
            return n;
        },

        renderToday() {
            const root = document.getElementById('today-root');
            if (!root || !this._lifeReady) return;
            const today = todayStr();
            const c = this._checkin();
            const mood = this._moodFor(today);
            const hour = new Date().getHours();
            const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

            const events = this._eventsOn(today);
            const dueTasks = this.tasks.filter(t => t.date === today);
            const overdue = this.tasks.filter(t => !t.done && t.date && t.date < today);
            const inbox = this.tasks.filter(t => !t.done && !t.date);
            const chores = (this._choreSchedule(today, 1)[today] || []);
            const bills = this._billsBetween(addDays(today, -30), addDays(today, 7)).filter(b => !b.paid && (b.date >= today || !b.bill.autopay));
            const choresDone = chores.filter(x => x.doneToday).length;
            const tasksDone = dueTasks.filter(t => t.done).length;
            const totalItems = dueTasks.length + chores.length + c.top.filter(x => x.t).length;
            const doneItems = tasksDone + choresDone + c.top.filter(x => x.t && x.d).length;
            const pct = totalItems ? Math.round(doneItems / totalItems * 100) : 0;
            const energyHint = c.energy === 1 ? 'Low-energy day: do the 🔋 items, skip the rest without guilt.' : c.energy === 3 ? 'High energy — great day to knock out a 🔥 chore.' : '';

            const taskRow = t => `
                <div class="flex items-center gap-3 py-2 group">
                    <button onclick="app.todayToggleTask(${t.id})" class="w-6 h-6 shrink-0 rounded-full border-2 ${t.done ? 'bg-green-500 border-green-500' : 'border-slate-300 dark:border-slate-600 hover:border-indigo-500'} flex items-center justify-center" aria-label="Toggle ${esc(t.text)}">${t.done ? '<i data-lucide="check" class="w-4 h-4 text-white"></i>' : ''}</button>
                    <span class="flex-1 ${t.done ? 'line-through text-slate-400' : ''}">${esc(t.text)}</span>
                    ${t.time ? `<span class="text-[10px] font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded-full">${fmtTime(t.time)}</span>` : ''}
                    ${t.date && t.date < today ? `<span class="text-[10px] font-bold text-rose-500">${fmtDay(t.date)}</span>` : ''}
                    ${!t.done ? `<button onclick="app.todayMoveTask(${t.id}, 1)" class="opacity-0 group-hover:opacity-100 text-[10px] font-bold uppercase text-slate-400 hover:text-indigo-500 px-2" title="Move to tomorrow">Tomorrow →</button>` : ''}
                </div>`;

            const moodBtns = this.moodEmojis.map((e, i) => `
                <button onclick="app.todaySetMood(${i + 1})" title="${this.moodLabelsArr[i]}" aria-label="Mood: ${this.moodLabelsArr[i]}"
                    class="flex-1 text-3xl py-3 rounded-2xl transition-all ${mood === i + 1 ? 'bg-purple-100 dark:bg-purple-900/40 ring-2 ring-purple-400 scale-105' : 'opacity-50 hover:opacity-100 hover:bg-slate-100 dark:hover:bg-slate-800/50'}">${e}</button>`).join('');
            const energyBtns = [1, 2, 3].map(l => `
                <button onclick="app.todaySetEnergy(${l})" class="flex-1 py-3 rounded-2xl font-bold text-sm transition-all ${c.energy === l ? 'ring-2 ring-indigo-400 bg-indigo-50 dark:bg-indigo-900/40' : 'opacity-60 hover:opacity-100 hover:bg-slate-100 dark:hover:bg-slate-800/50'}">${ENERGY[l].icon} ${ENERGY[l].label}</button>`).join('');

            root.innerHTML = `
            <div class="max-w-6xl mx-auto space-y-6 pb-24 md:pb-10">
                <div class="glass p-6 md:p-8 rounded-[2rem] relative overflow-hidden">
                    <div class="absolute inset-0 bg-gradient-to-br from-amber-400/10 via-pink-400/5 to-indigo-500/10 pointer-events-none"></div>
                    <div class="relative flex flex-wrap items-end justify-between gap-4">
                        <div>
                            <div class="text-xs font-bold uppercase tracking-widest text-slate-400">${parse(today).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</div>
                            <h2 class="text-3xl md:text-4xl font-black mt-1">${greet} ☀️</h2>
                            <p class="text-slate-500 mt-1">${totalItems ? `${doneItems} of ${totalItems} things done today.` : 'A fresh page. Check in, pick 3 priorities, go.'} ${this._checkinStreak() > 1 ? `🔥 ${this._checkinStreak()}-day check-in streak` : ''}</p>
                        </div>
                        <div class="w-full md:w-64">
                            <div class="h-3 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden"><div class="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all" style="width:${pct}%"></div></div>
                            <div class="text-right text-xs font-bold text-slate-400 mt-1">${pct}% of today</div>
                        </div>
                    </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div class="space-y-6 lg:col-span-1">
                        <div class="glass p-5 rounded-2xl">
                            <div class="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">1 · How are you feeling?</div>
                            <div class="flex gap-1">${moodBtns}</div>
                            <div class="text-xs font-bold uppercase tracking-widest text-slate-400 mt-5 mb-3">Energy level</div>
                            <div class="flex gap-1">${energyBtns}</div>
                            ${energyHint ? `<p class="text-xs text-slate-500 mt-3">${energyHint}</p>` : ''}
                            <textarea oninput="app.todaySetNote(this.value)" rows="2" placeholder="One line about today (optional)…" class="${this._inputCls} mt-4 text-sm resize-none">${esc(c.note)}</textarea>
                        </div>
                        <div class="glass p-5 rounded-2xl">
                            <div class="flex items-center justify-between mb-3">
                                <div class="text-xs font-bold uppercase tracking-widest text-slate-400">Mood — last 5 weeks</div>
                                <button onclick="app.openMoodYear()" class="text-[11px] font-bold text-indigo-500 hover:underline">Year in pixels</button>
                            </div>
                            ${this._moodGrid(35, 'w-full aspect-square')}
                        </div>
                    </div>

                    <div class="space-y-6 lg:col-span-2">
                        <div class="glass p-5 rounded-2xl">
                            <div class="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">2 · Today's top 3</div>
                            ${c.top.map((x, i) => `
                                <div class="flex items-center gap-3 mb-2">
                                    <input type="checkbox" ${x.d ? 'checked' : ''} onchange="app.todaySetTop(${i}, 'd', this.checked)" class="w-5 h-5 accent-emerald-500" aria-label="Priority ${i + 1} done">
                                    <input type="text" value="${esc(x.t)}" oninput="app.todaySetTop(${i}, 't', this.value)" placeholder="${['The one thing that would make today a win', 'Second priority', 'Something small for future you'][i]}"
                                        class="flex-1 bg-transparent border-b border-slate-200 dark:border-slate-700 py-2 focus:outline-none focus:border-indigo-500 ${x.d ? 'line-through text-slate-400' : ''}">
                                </div>`).join('')}
                        </div>

                        <div class="glass p-5 rounded-2xl">
                            <div class="flex items-center justify-between mb-2">
                                <div class="text-xs font-bold uppercase tracking-widest text-slate-400">3 · Today's plan</div>
                                <button onclick="app.switchTab('calendar')" class="text-[11px] font-bold text-indigo-500 hover:underline">Open calendar →</button>
                            </div>
                            ${events.length ? `<div class="mb-3">${events.map(e => `
                                <div class="flex items-center gap-3 py-1.5">
                                    <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background:${esc(e.color || '#6366f1')}"></span>
                                    <span class="text-xs font-bold text-slate-400 w-16 shrink-0">${e.allDay ? 'All day' : fmtTime(e.start.slice(11, 16))}</span>
                                    <span class="flex-1">${esc(e.title)}</span>
                                </div>`).join('')}</div>` : ''}
                            <div class="divide-y divide-slate-200/60 dark:divide-slate-700/60">
                                ${overdue.map(taskRow).join('')}
                                ${dueTasks.map(taskRow).join('')}
                            </div>
                            ${!events.length && !dueTasks.length && !overdue.length ? '<p class="text-sm text-slate-400 py-2">Nothing scheduled. Add something below or drag tasks onto today in the calendar.</p>' : ''}
                            <div class="flex gap-2 mt-4">
                                <input id="today-capture" onkeydown="app.todayQuickAdd(event)" placeholder="Brain dump — type a task and hit Enter" class="${this._inputBase} flex-1 min-w-0">
                                <select id="today-capture-when" class="${this._inputBase} shrink-0" aria-label="When">
                                    <option value="today">Today</option><option value="tomorrow">Tomorrow</option><option value="inbox">Inbox</option>
                                </select>
                            </div>
                            ${inbox.length ? `<button onclick="app.switchTab('tasks'); app.filterTasks('inbox')" class="mt-3 text-xs font-bold text-slate-500 hover:text-indigo-500">📥 ${inbox.length} undated task${inbox.length > 1 ? 's' : ''} in your inbox</button>` : ''}
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div class="glass p-5 rounded-2xl">
                                <div class="flex items-center justify-between mb-2">
                                    <div class="text-xs font-bold uppercase tracking-widest text-slate-400">Chores · ${choresDone}/${chores.length}</div>
                                    <button onclick="app.switchTab('chores')" class="text-[11px] font-bold text-indigo-500 hover:underline">${this.chores.length ? 'All chores →' : 'Set up →'}</button>
                                </div>
                                ${chores.length ? chores.map(x => this._choreRow(x, today, true)).join('') : `<p class="text-sm text-slate-400 py-2">${this.chores.length ? 'No chores today. Enjoy it!' : 'Pick from 70+ premade chores and we\'ll spread them across your week.'}</p>`}
                            </div>
                            <div class="glass p-5 rounded-2xl">
                                <div class="flex items-center justify-between mb-2">
                                    <div class="text-xs font-bold uppercase tracking-widest text-slate-400">Bills · next 7 days</div>
                                    <button onclick="app.switchTab('bills')" class="text-[11px] font-bold text-indigo-500 hover:underline">${this.bills.length ? 'All bills →' : 'Add bills →'}</button>
                                </div>
                                ${bills.length ? bills.map(b => this._billRow(b, true)).join('') : `<p class="text-sm text-slate-400 py-2">${this.bills.length ? 'Nothing due this week. 🎉' : 'Add your bills once and never miss a due date.'}</p>`}
                            </div>
                        </div>
                    </div>
                </div>
                <label class="flex items-center gap-2 text-xs text-slate-400 justify-center">
                    <input type="checkbox" ${load('wd_today_prefs', { autoOpen: true }).autoOpen ? 'checked' : ''} onchange="localStorage.setItem('wd_today_prefs', JSON.stringify({autoOpen:this.checked}))" class="accent-indigo-500">
                    Open this check-in automatically the first time I visit each day
                </label>
            </div>`;
            this._rebuildIcons();
        },

        _moodGrid(days, cellCls) {
            const colors = ['bg-slate-200 dark:bg-slate-700/70', 'bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-lime-400', 'bg-green-500'];
            const hist = load('wd_mood_history', []);
            const map = {};
            hist.forEach(x => { map[x.date] = x.mood; });
            const cells = [];
            for (let i = days - 1; i >= 0; i--) {
                const d = new Date(); d.setDate(d.getDate() - i);
                const m = map[d.toDateString()] || 0;
                cells.push(`<div class="${cellCls} rounded-md ${colors[m]}" title="${d.toLocaleDateString()} — ${['No entry', ...this.moodLabelsArr][m]}"></div>`);
            }
            return `<div class="grid grid-cols-7 gap-1.5">${cells.join('')}</div>`;
        },

        openMoodYear() {
            const colors = ['bg-slate-200 dark:bg-slate-700/70', 'bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-lime-400', 'bg-green-500'];
            const hist = load('wd_mood_history', []);
            const map = {};
            hist.forEach(x => { map[x.date] = x.mood; });
            const year = new Date().getFullYear();
            const months = [];
            for (let m = 0; m < 12; m++) {
                const len = new Date(year, m + 1, 0).getDate();
                const cells = [];
                for (let d = 1; d <= 31; d++) {
                    const mood = d <= len ? (map[new Date(year, m, d).toDateString()] || 0) : -1;
                    cells.push(`<div class="w-3 h-3 rounded-sm ${mood < 0 ? '' : colors[mood]}"></div>`);
                }
                months.push(`<div class="flex flex-col gap-[3px] items-center"><div class="text-[9px] font-bold text-slate-400 mb-1">${new Date(year, m, 1).toLocaleDateString(undefined, { month: 'narrow' })}</div>${cells.join('')}</div>`);
            }
            const counts = [1, 2, 3, 4, 5].map(l => Object.values(map).filter(v => v === l).length);
            this.lifeModal(`${year} in pixels`, `
                <div class="flex justify-between gap-1 overflow-x-auto pb-2">${months.join('')}</div>
                <div class="flex justify-center gap-3 mt-4 text-xs text-slate-500 flex-wrap">
                    ${this.moodEmojis.map((e, i) => `<span class="flex items-center gap-1"><span class="w-3 h-3 rounded-sm ${colors[i + 1]}"></span>${e} ${counts[i]}</span>`).join('')}
                </div>`);
        },

        renderLifeDashCard() {
            const el = document.getElementById('life-dash-card');
            if (!el || !this._lifeReady) return;
            const today = todayStr();
            const tasks = this.tasks.filter(t => !t.done && t.date && t.date <= today).length;
            const chores = (this._choreSchedule(today, 1)[today] || []).filter(x => !x.doneToday).length;
            const bills = this._billsBetween(today, addDays(today, 7)).filter(b => !b.paid).length;
            const events = this._eventsOn(today).length;
            const checked = this.checkins[today]?.checked;
            el.innerHTML = `
                <button onclick="app.switchTab('today')" class="w-full text-left glass p-5 rounded-2xl flex flex-wrap items-center gap-4 hover:shadow-lg transition-all group">
                    <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-pink-500 flex items-center justify-center text-2xl shrink-0">☀️</div>
                    <div class="flex-1 min-w-[12rem]">
                        <div class="font-black text-lg">${checked ? 'Today at a glance' : 'Start your morning check-in'}</div>
                        <div class="text-sm text-slate-500">${events} event${events === 1 ? '' : 's'} · ${tasks} task${tasks === 1 ? '' : 's'} · ${chores} chore${chores === 1 ? '' : 's'} · ${bills} bill${bills === 1 ? '' : 's'} due this week</div>
                    </div>
                    <i data-lucide="arrow-right" class="w-5 h-5 text-slate-400 group-hover:translate-x-1 transition-transform"></i>
                </button>`;
            this._rebuildIcons();
        },

        // ═══════════════════════════════════════════════════════════
        // CALENDAR — FullCalendar with events, tasks, chores and bills
        // ═══════════════════════════════════════════════════════════
        _saveEvents() { save('wd_cal_events', this.calEvents); },

        _eventsOn(date) {
            return this.calEvents
                .filter(e => e.start.slice(0, 10) <= date && (e.end ? e.end.slice(0, 10) : e.start.slice(0, 10)) >= date)
                .sort((a, b) => (a.allDay ? '0' : a.start).localeCompare(b.allDay ? '0' : b.start));
        },

        async initCalendar() {
            const el = document.getElementById('cal-root');
            if (!el) return;
            if (this._calendar) { this._calendar.updateSize(); return; }
            el.innerHTML = '<div class="h-full flex items-center justify-center text-slate-400">Loading calendar…</div>';
            try {
                await this._loadScript(CDN.fullcalendar);
            } catch (e) {
                el.innerHTML = '<div class="h-full flex items-center justify-center text-slate-400">Couldn\'t load the calendar. Check your connection and reopen this tab.</div>';
                return;
            }
            el.innerHTML = '';
            const narrow = window.innerWidth < 640;
            this._calendar = new FullCalendar.Calendar(el, {
                initialView: localStorage.getItem('wd_cal_view') || (narrow ? 'timeGridDay' : 'dayGridMonth'),
                headerToolbar: narrow
                    ? { left: 'prev,next', center: 'title', right: 'today' }
                    : { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek' },
                footerToolbar: narrow ? { center: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek' } : false,
                buttonText: { today: 'Today', month: 'Month', week: 'Week', day: 'Day', list: 'Agenda' },
                height: '100%',
                nowIndicator: true,
                selectable: true,
                editable: true,
                dayMaxEvents: true,
                scrollTime: '07:00:00',
                eventTimeFormat: { hour: 'numeric', minute: '2-digit', meridiem: 'short' },
                events: (info, ok) => ok(this._calFeed(info.start, info.end)),
                datesSet: info => {
                    localStorage.setItem('wd_cal_view', info.view.type);
                    // Chores render differently in time grids vs month/agenda views.
                    const grid = info.view.type.startsWith('timeGrid');
                    if (this._calGrid !== undefined && this._calGrid !== grid) this._calendar.refetchEvents();
                    this._calGrid = grid;
                },
                select: info => {
                    const s = info.start;
                    const e = info.end;
                    if (info.allDay) {
                        this.openEventModal({ date: ymd(s), endDate: addDays(ymd(e), -1), allDay: true });
                    } else {
                        this.openEventModal({ date: ymd(s), startTime: hm(s), endTime: hm(e), allDay: false });
                    }
                    this._calendar.unselect();
                },
                eventClick: info => {
                    info.jsEvent.preventDefault();
                    const x = info.event.extendedProps;
                    if (x.kind === 'event') this.openEventModal(this.calEvents.find(e => e.id === x.ref));
                    if (x.kind === 'task') this.openTaskModal(x.ref);
                    if (x.kind === 'chore') this.openChoreDetail(x.ref);
                    if (x.kind === 'bill') this.toggleBillPaid(x.ref, x.date);
                    if (x.kind === 'chores-day') this.openChoreDay(x.date);
                },
                eventDrop: info => this._calMoved(info),
                eventResize: info => this._calMoved(info),
                eventDidMount: info => {
                    const x = info.event.extendedProps;
                    if (x.tip) info.el.title = x.tip;
                }
            });
            this._calendar.render();
        },

        _calMoved(info) {
            const ev = info.event;
            const x = ev.extendedProps;
            if (x.kind === 'event') {
                const e = this.calEvents.find(e => e.id === x.ref);
                if (!e) return;
                e.allDay = ev.allDay;
                if (ev.allDay) {
                    e.start = ymd(ev.start);
                    e.end = ev.end ? addDays(ymd(ev.end), -1) : '';
                } else {
                    e.start = `${ymd(ev.start)}T${hm(ev.start)}`;
                    const end = ev.end || new Date(ev.start.getTime() + 3600000);
                    e.end = `${ymd(end)}T${hm(end)}`;
                }
                this._saveEvents();
                this.lifeRefresh();
            } else if (x.kind === 'task') {
                const t = this.tasks.find(t => t.id === x.ref);
                if (!t) return info.revert();
                t.date = ymd(ev.start);
                t.time = ev.allDay ? '' : hm(ev.start);
                this.renderTasks();
                this.showToast('Task rescheduled');
            } else {
                info.revert();
            }
        },

        _calFeed(start, end) {
            const from = ymd(start), to = ymd(end);
            const today = todayStr();
            const out = [];
            const L = this.calLayers;
            if (L.event) this.calEvents.forEach(e => {
                out.push({
                    id: 'e-' + e.id, title: e.title, allDay: !!e.allDay,
                    start: e.start, end: e.allDay ? (e.end ? addDays(e.end, 1) : undefined) : (e.end || undefined),
                    backgroundColor: e.color || '#6366f1', borderColor: e.color || '#6366f1',
                    extendedProps: { kind: 'event', ref: e.id, tip: e.notes || '' }
                });
            });
            if (L.task) this.tasks.forEach(t => {
                if (!t.date || t.date < from || t.date >= to) return;
                out.push({
                    id: 't-' + t.id, title: (t.done ? '✓ ' : '☐ ') + t.text,
                    start: t.time ? `${t.date}T${t.time}` : t.date, allDay: !t.time,
                    backgroundColor: t.done ? '#94a3b8' : '#0ea5e9', borderColor: t.done ? '#94a3b8' : '#0ea5e9',
                    classNames: t.done ? ['fc-done'] : [], extendedProps: { kind: 'task', ref: t.id }
                });
            });
            if (L.chore) {
                // Past: what you actually did. Today onward: the balanced schedule.
                const doneByDay = {};
                this.chores.forEach(c => (c.history || []).forEach(d => {
                    if (d >= from && d < to && d < today) (doneByDay[d] = doneByDay[d] || []).push(c.name);
                }));
                Object.entries(doneByDay).forEach(([d, names]) => out.push({
                    title: `✓ ${names.length} chore${names.length > 1 ? 's' : ''} done`, start: d, allDay: true, editable: false,
                    backgroundColor: '#a7f3d0', borderColor: '#a7f3d0', textColor: '#065f46', classNames: ['fc-done'],
                    extendedProps: { kind: 'none', tip: names.join('\n') }
                }));
                if (to > today) {
                    const startS = from > today ? from : today;
                    const sched = this._choreSchedule(startS, Math.min(120, diffDays(startS, to)));
                    const hour = WINDOW_HOUR[this.chorePrefs.window] || 18;
                    const timeGrid = (this._calendar?.view.type || '').startsWith('timeGrid');
                    Object.entries(sched).forEach(([d, list]) => {
                        // One block per day: a time box in week/day views, a summary chip in month/agenda.
                        const left = list.filter(x => !x.doneToday);
                        const mins = left.reduce((n, x) => n + x.chore.mins, 0);
                        const overdue = left.some(x => x.overdue);
                        const ev = {
                            title: left.length ? `🧹 ${left.length} chore${left.length > 1 ? 's' : ''} · ${mins}m` : '✓ Chores done',
                            editable: false,
                            backgroundColor: left.length ? (overdue ? '#f43f5e' : '#10b981') : '#a7f3d0',
                            borderColor: left.length ? (overdue ? '#f43f5e' : '#10b981') : '#a7f3d0',
                            textColor: left.length ? undefined : '#065f46',
                            classNames: left.length ? [] : ['fc-done'],
                            extendedProps: { kind: 'chores-day', date: d, tip: list.map(x => `${x.doneToday ? '✓' : '•'} ${x.chore.name} (${x.chore.mins}m)`).join('\n') }
                        };
                        if (timeGrid && left.length) {
                            const s = hour * 60, e = Math.min(s + Math.max(30, mins), 23 * 60 + 59);
                            ev.start = `${d}T${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
                            ev.end = `${d}T${pad(Math.floor(e / 60))}:${pad(e % 60)}`;
                            ev.title = `🧹 Chore time — ${left.length} chore${left.length > 1 ? 's' : ''} · ${mins}m`;
                        } else {
                            ev.start = d;
                            ev.allDay = true;
                        }
                        out.push(ev);
                    });
                }
            }
            if (L.bill) this._billsBetween(from, addDays(to, -1)).forEach(b => {
                out.push({
                    title: `${b.paid ? '✓' : '💲'} ${b.bill.name} ${money(b.bill.amount)}`, start: b.date, allDay: true, editable: false,
                    backgroundColor: b.paid ? '#fde68a' : (b.date < today ? '#ef4444' : '#f59e0b'),
                    borderColor: b.paid ? '#fde68a' : (b.date < today ? '#ef4444' : '#f59e0b'),
                    textColor: b.paid ? '#78350f' : undefined, classNames: b.paid ? ['fc-done'] : [],
                    extendedProps: { kind: 'bill', ref: b.bill.id, date: b.date, tip: b.paid ? 'Paid — click to undo' : 'Click to mark paid' }
                });
            });
            return out;
        },

        toggleCalLayer(layer) {
            this.calLayers[layer] = !this.calLayers[layer];
            save('wd_cal_layers', this.calLayers);
            document.querySelectorAll(`[data-cal-layer="${layer}"]`).forEach(b => b.classList.toggle('opacity-40', !this.calLayers[layer]));
            if (this._calendar) this._calendar.refetchEvents();
        },

        openEventModal(prefill = {}) {
            const isEdit = !!prefill.id;
            const e = Object.assign({ title: '', allDay: true, color: '#6366f1', notes: '' }, prefill);
            const date = e.date || (e.start ? e.start.slice(0, 10) : todayStr());
            const endDate = e.endDate || (e.allDay && e.end ? e.end.slice(0, 10) : '');
            const startTime = e.startTime || (!e.allDay && e.start ? e.start.slice(11, 16) : '09:00');
            const endTime = e.endTime || (!e.allDay && e.end ? e.end.slice(11, 16) : '10:00');
            const colors = ['#6366f1', '#ec4899', '#f97316', '#10b981', '#0ea5e9', '#a855f7', '#64748b'];
            this.lifeModal(isEdit ? 'Edit event' : 'Add to calendar', `
                ${!isEdit ? `<div class="flex gap-2 mb-4" role="tablist">
                    <button type="button" data-kind="event" class="ev-kind flex-1 py-2 rounded-xl font-bold text-sm bg-indigo-600 text-white">📅 Event</button>
                    <button type="button" data-kind="task" class="ev-kind flex-1 py-2 rounded-xl font-bold text-sm glass">☐ Task</button>
                </div>` : ''}
                ${this._field('Title', `<input id="ev-title" class="${this._inputCls}" value="${esc(e.title)}" placeholder="Dentist, Mom's birthday, Finish report…">`)}
                <div class="grid grid-cols-2 gap-3">
                    ${this._field('Date', `<input id="ev-date" type="date" class="${this._inputCls}" value="${date}">`)}
                    <div id="ev-enddate-wrap">${this._field('Ends (optional)', `<input id="ev-enddate" type="date" class="${this._inputCls}" value="${endDate}">`)}</div>
                </div>
                <label class="flex items-center gap-2 mb-3 text-sm font-medium"><input id="ev-allday" type="checkbox" ${e.allDay ? 'checked' : ''} class="w-4 h-4 accent-indigo-500"> All day</label>
                <div id="ev-times" class="grid grid-cols-2 gap-3 ${e.allDay ? 'hidden' : ''}">
                    ${this._field('Start', `<input id="ev-start" type="time" class="${this._inputCls}" value="${startTime}">`)}
                    <div id="ev-end-wrap">${this._field('End', `<input id="ev-end" type="time" class="${this._inputCls}" value="${endTime}">`)}</div>
                </div>
                <div id="ev-extra">
                    ${this._field('Colour', `<div class="flex gap-2">${colors.map(c => `<button type="button" data-color="${c}" class="ev-color w-8 h-8 rounded-full ring-offset-2 dark:ring-offset-slate-900 ${c === e.color ? 'ring-2 ring-indigo-500' : ''}" style="background:${c}" aria-label="Colour ${c}"></button>`).join('')}</div>`)}
                    ${this._field('Notes', `<textarea id="ev-notes" rows="2" class="${this._inputCls}">${esc(e.notes)}</textarea>`)}
                </div>
                <div class="flex justify-between gap-2 mt-4">
                    ${isEdit ? `<button onclick="app.deleteEvent('${e.id}')" class="text-red-500 font-bold text-sm px-3">Delete</button>` : '<span></span>'}
                    <div class="flex gap-2"><button onclick="app.closeLifeModal()" class="${this._ghostBtnCls}">Cancel</button><button id="ev-save" class="${this._btnCls}">Save</button></div>
                </div>`, wrap => {
                let kind = 'event', color = e.color;
                const allDay = wrap.querySelector('#ev-allday');
                const syncKind = () => {
                    wrap.querySelectorAll('.ev-kind').forEach(b => {
                        const on = b.dataset.kind === kind;
                        b.className = `ev-kind flex-1 py-2 rounded-xl font-bold text-sm ${on ? 'bg-indigo-600 text-white' : 'glass'}`;
                    });
                    wrap.querySelector('#ev-extra').classList.toggle('hidden', kind === 'task');
                    wrap.querySelector('#ev-enddate-wrap').classList.toggle('invisible', kind === 'task');
                    wrap.querySelector('#ev-end-wrap').classList.toggle('invisible', kind === 'task');
                };
                wrap.querySelectorAll('.ev-kind').forEach(b => b.onclick = () => { kind = b.dataset.kind; syncKind(); });
                allDay.onchange = () => wrap.querySelector('#ev-times').classList.toggle('hidden', allDay.checked);
                wrap.querySelectorAll('.ev-color').forEach(b => b.onclick = () => {
                    color = b.dataset.color;
                    wrap.querySelectorAll('.ev-color').forEach(x => x.classList.toggle('ring-2', x === b));
                    wrap.querySelectorAll('.ev-color').forEach(x => x.classList.toggle('ring-indigo-500', x === b));
                });
                const submit = () => {
                    const title = wrap.querySelector('#ev-title').value.trim();
                    if (!title) { wrap.querySelector('#ev-title').focus(); return; }
                    const d = wrap.querySelector('#ev-date').value || todayStr();
                    const ad = allDay.checked;
                    const st = wrap.querySelector('#ev-start').value || '09:00';
                    if (kind === 'task') {
                        this.tasks.push({ text: title, time: ad ? '' : st, date: d, done: false, id: this._taskId() });
                        this.closeLifeModal();
                        this.renderTasks();
                        this.showToast('Task added');
                        return;
                    }
                    const ed = wrap.querySelector('#ev-enddate').value;
                    let et = wrap.querySelector('#ev-end').value || st;
                    const rec = isEdit ? this.calEvents.find(x => x.id === e.id) : { id: uid() };
                    rec.title = title;
                    rec.allDay = ad;
                    rec.color = color;
                    rec.notes = wrap.querySelector('#ev-notes').value;
                    if (ad) {
                        rec.start = d;
                        rec.end = ed && ed > d ? ed : '';
                    } else {
                        const endDay = ed && ed > d ? ed : d;
                        if (endDay === d && et <= st) et = st;
                        rec.start = `${d}T${st}`;
                        rec.end = `${endDay}T${et}`;
                    }
                    if (!isEdit) this.calEvents.push(rec);
                    this._saveEvents();
                    this.closeLifeModal();
                    this.lifeRefresh();
                    this.showToast(isEdit ? 'Event updated' : 'Event added');
                };
                wrap.querySelector('#ev-save').onclick = submit;
                wrap.querySelector('#ev-title').onkeydown = ev => { if (ev.key === 'Enter') submit(); };
            });
        },

        deleteEvent(id) {
            this.calEvents = this.calEvents.filter(e => e.id !== id);
            this._saveEvents();
            this.closeLifeModal();
            this.lifeRefresh();
            this.showToast('Event deleted');
        },

        openTaskModal(id) {
            const t = this.tasks.find(x => x.id === id);
            if (!t) return;
            this.lifeModal('Task', `
                ${this._field('Task', `<input id="tk-text" class="${this._inputCls}" value="${esc(t.text)}">`)}
                <div class="grid grid-cols-2 gap-3">
                    ${this._field('Date', `<input id="tk-date" type="date" class="${this._inputCls}" value="${t.date || ''}">`)}
                    ${this._field('Time', `<input id="tk-time" type="time" class="${this._inputCls}" value="${t.time || ''}">`)}
                </div>
                <label class="flex items-center gap-2 mb-3 text-sm font-medium"><input id="tk-done" type="checkbox" ${t.done ? 'checked' : ''} class="w-4 h-4 accent-emerald-500"> Done</label>
                <div class="flex justify-between gap-2 mt-4">
                    <button id="tk-del" class="text-red-500 font-bold text-sm px-3">Delete</button>
                    <div class="flex gap-2"><button onclick="app.closeLifeModal()" class="${this._ghostBtnCls}">Cancel</button><button id="tk-save" class="${this._btnCls}">Save</button></div>
                </div>`, wrap => {
                wrap.querySelector('#tk-save').onclick = () => {
                    const wasDone = t.done;
                    t.text = wrap.querySelector('#tk-text').value.trim() || t.text;
                    t.date = wrap.querySelector('#tk-date').value;
                    t.time = wrap.querySelector('#tk-time').value;
                    t.done = wrap.querySelector('#tk-done').checked;
                    this.closeLifeModal();
                    this.renderTasks();
                    if (t.done && !wasDone) this._celebrate('Nice work! 🎉');
                };
                wrap.querySelector('#tk-del').onclick = () => {
                    this.tasks = this.tasks.filter(x => x.id !== id);
                    this.closeLifeModal();
                    this.renderTasks();
                };
            });
        },

        exportICS() {
            const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
            const dt = s => s.replace(/[-:]/g, '') + (s.length > 10 ? '00' : '');
            const escI = s => String(s || '').replace(/[\\;,]/g, m => '\\' + m).replace(/\n/g, '\\n');
            const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//WebDesks//Planner//EN'];
            this.calEvents.forEach(e => {
                lines.push('BEGIN:VEVENT', `UID:${e.id}@webdesks.app`, `DTSTAMP:${stamp}`, `SUMMARY:${escI(e.title)}`);
                if (e.allDay) {
                    lines.push(`DTSTART;VALUE=DATE:${dt(e.start)}`, `DTEND;VALUE=DATE:${dt(addDays(e.end || e.start, 1))}`);
                } else {
                    lines.push(`DTSTART:${dt(e.start)}`, `DTEND:${dt(e.end || e.start)}`);
                }
                if (e.notes) lines.push(`DESCRIPTION:${escI(e.notes)}`);
                lines.push('END:VEVENT');
            });
            this.bills.forEach(b => {
                const rule = { weekly: 'FREQ=WEEKLY', biweekly: 'FREQ=WEEKLY;INTERVAL=2', monthly: 'FREQ=MONTHLY', quarterly: 'FREQ=MONTHLY;INTERVAL=3', yearly: 'FREQ=YEARLY' }[b.freq];
                lines.push('BEGIN:VEVENT', `UID:bill-${b.id}@webdesks.app`, `DTSTAMP:${stamp}`, `SUMMARY:${escI(`💲 ${b.name} ${money(b.amount)}`)}`,
                    `DTSTART;VALUE=DATE:${dt(b.due)}`, `DTEND;VALUE=DATE:${dt(addDays(b.due, 1))}`);
                if (rule) lines.push(`RRULE:${rule}`);
                lines.push('END:VEVENT');
            });
            lines.push('END:VCALENDAR');
            const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'webdesks-calendar.ics';
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 1000);
            this.showToast('Calendar exported (.ics)');
        },

        // ═══════════════════════════════════════════════════════════
        // CHORES — ADHD-friendly premade library + auto-scheduler
        // ═══════════════════════════════════════════════════════════
        _saveChores() {
            save('wd_chores', this.chores);
            save('wd_chore_prefs', this.chorePrefs);
        },

        // Spread every adopted chore across the coming days so no single
        // day goes over the daily minute budget, chore-free days stay
        // free, and weekly chores land on their preferred weekday.
        _choreSchedule(start, days) {
            const today = todayStr();
            const end = addDays(start, days);
            const prefs = this.chorePrefs;
            const loadByDay = {};
            const out = {};
            const place = (c, d, overdue) => {
                loadByDay[d] = (loadByDay[d] || 0) + c.mins;
                if (d >= start && d < end) {
                    (out[d] = out[d] || []).push({ chore: c, overdue, doneToday: d === today && c.lastDone === today });
                }
            };
            const bestDay = (c, ideal) => {
                const slack = c.day != null ? 3 : Math.min(3, Math.floor(c.every / 3));
                let best = ideal, bestScore = Infinity;
                for (let off = -slack; off <= slack; off++) {
                    const d = addDays(ideal, off);
                    if (d < today) continue;
                    const dow = parse(d).getDay();
                    const used = loadByDay[d] || 0;
                    const score = Math.abs(off) * 3
                        + (prefs.offDays.includes(dow) ? 200 : 0)
                        + (c.day != null && c.day !== dow ? 80 : 0)
                        + Math.max(0, used + c.mins - prefs.budget) * 2
                        + used / 10;
                    if (score < bestScore) { bestScore = score; best = d; }
                }
                return best;
            };
            [...this.chores].filter(c => !c.paused).sort((a, b) => a.every - b.every || a.mins - b.mins).forEach(c => {
                // Done today: show it as done today, then plan the next one.
                if (c.lastDone === today) place(c, today, false);
                let next = c.nextDue || (c.lastDone ? addDays(c.lastDone, c.every) : (c.start || today));
                if (c.lastDone === today && next <= today) next = addDays(today, c.every);
                if (c.snooze && c.snooze > next) next = c.snooze;
                let overdue = next < today;
                if (overdue) next = today;
                let guard = 0;
                while (next < end && guard++ < 500) {
                    const target = (c.every > 1 && !overdue) ? bestDay(c, next) : next;
                    place(c, target, overdue);
                    next = addDays(target, c.every);
                    overdue = false;
                }
            });
            return out;
        },

        _choreStreak() {
            const days = new Set();
            this.chores.forEach(c => (c.history || []).forEach(d => days.add(d)));
            let n = 0, d = todayStr();
            if (!days.has(d)) d = addDays(d, -1);
            while (days.has(d)) { n++; d = addDays(d, -1); }
            return n;
        },

        _choreRow(x, date, compact) {
            const c = x.chore;
            const done = x.doneToday;
            const e = ENERGY[c.energy];
            return `
                <div class="flex items-center gap-3 py-2 group">
                    <button onclick="app.completeChore('${c.id}')" ${date !== todayStr() ? 'disabled' : ''} class="w-6 h-6 shrink-0 rounded-lg border-2 ${done ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 dark:border-slate-600 hover:border-emerald-500'} flex items-center justify-center disabled:opacity-40" aria-label="Mark ${esc(c.name)} done">${done ? '<i data-lucide="check" class="w-4 h-4 text-white"></i>' : ''}</button>
                    <button onclick="app.openChoreDetail('${c.id}')" class="flex-1 text-left min-w-0">
                        <span class="block truncate ${done ? 'line-through text-slate-400' : ''}">${esc(c.name)}</span>
                        ${compact ? '' : `<span class="text-[11px] text-slate-400">${esc(c.cat || 'Custom')} · every ${c.every === 1 ? 'day' : c.every + ' days'}</span>`}
                    </button>
                    ${x.overdue && !done ? '<span class="text-[10px] font-bold text-rose-500 uppercase">Overdue</span>' : ''}
                    <span class="text-[10px] font-bold px-2 py-1 rounded-full ${e.cls}" title="${e.label} energy">${e.icon} ${c.mins}m</span>
                    ${!done && date === todayStr() && !compact ? `<button onclick="app.snoozeChore('${c.id}')" class="opacity-0 group-hover:opacity-100 text-[10px] font-bold uppercase text-slate-400 hover:text-indigo-500" title="Not today">Skip</button>` : ''}
                </div>`;
        },

        completeChore(id) {
            const c = this.chores.find(x => x.id === id);
            if (!c) return;
            const today = todayStr();
            c.history = c.history || [];
            if (c.lastDone === today) {
                // Undo today's completion.
                c.history = c.history.filter(d => d !== today);
                c.lastDone = c.history.length ? c.history[c.history.length - 1] : '';
                c.nextDue = c.prevNextDue || '';
                this.chorePrefs.points = Math.max(0, (this.chorePrefs.points || 0) - c.mins);
            } else {
                c.prevDone = c.lastDone || '';
                c.prevNextDue = c.nextDue || '';
                c.lastDone = today;
                c.snooze = '';
                c.nextDue = '';
                if (!c.history.includes(today)) c.history.push(today);
                c.history = c.history.slice(-120);
                this.chorePrefs.points = (this.chorePrefs.points || 0) + c.mins;
                const left = (this._choreSchedule(today, 1)[today] || []).filter(x => !x.doneToday).length;
                this._celebrate(left ? `+${c.mins} spark points ✨ ${left} to go` : 'All chores done for today! 🎉');
            }
            this._saveChores();
            this.closeLifeModal();
            this.lifeRefresh();
        },

        snoozeChore(id) {
            const c = this.chores.find(x => x.id === id);
            if (!c) return;
            c.snooze = addDays(todayStr(), 1);
            this._saveChores();
            this.lifeRefresh();
            this.renderChores();
            this.showToast('Moved to tomorrow. Rest is productive too.');
        },

        adoptChore(libId, silent) {
            const lib = CHORE_INDEX[libId];
            if (!lib || this.chores.some(c => c.libId === libId)) return false;
            this.chores.push({ id: uid(), libId, name: lib.name, cat: lib.cat, mins: lib.mins, energy: lib.energy, every: lib.every, steps: [...lib.steps], day: null, lastDone: '', history: [], start: todayStr() });
            if (!silent) { this._saveChores(); this.lifeRefresh(); this.renderChores(); this.showToast(`Added "${lib.name}"`); }
            return true;
        },

        adoptPack(packId) {
            const pack = ROUTINE_PACKS.find(p => p.id === packId);
            if (!pack) return;
            const n = pack.ids.filter(id => this.adoptChore(id, true)).length;
            this._saveChores();
            this.lifeRefresh();
            this.renderChores();
            this.showToast(n ? `Added ${n} chores from "${pack.name}"` : 'You already have all of these');
        },

        removeChore(id) {
            this.chores = this.chores.filter(c => c.id !== id);
            this._saveChores();
            this.closeLifeModal();
            this.lifeRefresh();
            this.renderChores();
        },

        setChoreFilter(f) {
            this._choreFilter = f;
            this.renderChores();
        },

        setChorePref(key, value) {
            if (key === 'offDay') {
                const d = Number(value);
                const s = new Set(this.chorePrefs.offDays);
                s.has(d) ? s.delete(d) : s.add(d);
                this.chorePrefs.offDays = [...s];
            } else {
                this.chorePrefs[key] = key === 'budget' ? Number(value) : value;
            }
            this._saveChores();
            this.renderChores();
            this.lifeRefresh();
        },

        // "Just one thing": the smallest, lowest-energy chore still due today.
        pickOneChore() {
            const today = todayStr();
            const energy = this._checkin().energy || 3;
            const left = (this._choreSchedule(today, 1)[today] || []).filter(x => !x.doneToday);
            if (!left.length) { this.showToast(this.chores.length ? 'Nothing left today — you\'re done! 🎉' : 'Add some chores first'); return; }
            left.sort((a, b) => (a.chore.energy > energy) - (b.chore.energy > energy) || a.chore.mins - b.chore.mins);
            this.openChoreDetail(left[0].chore.id, true);
        },

        openChoreDetail(id, focusMode) {
            const c = this.chores.find(x => x.id === id);
            if (!c) return;
            const isToday = (this._choreSchedule(todayStr(), 1)[todayStr()] || []).some(x => x.chore.id === id);
            const doneToday = c.lastDone === todayStr();
            const next = c.nextDue || (c.lastDone ? addDays(c.lastDone, c.every) : (c.start || todayStr()));
            this.lifeModal(focusMode ? 'Just this one thing' : esc(c.name), `
                ${focusMode ? `<div class="text-2xl font-black mb-2">${esc(c.name)}</div>` : ''}
                <div class="flex flex-wrap gap-2 mb-4 text-xs font-bold">
                    <span class="px-2 py-1 rounded-full ${ENERGY[c.energy].cls}">${ENERGY[c.energy].icon} ${ENERGY[c.energy].label} energy</span>
                    <span class="px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800">⏱ ${c.mins} min</span>
                    <span class="px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800">🔁 every ${c.every === 1 ? 'day' : c.every + ' days'}</span>
                    <span class="px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800">${c.lastDone ? 'Last done ' + fmtDay(c.lastDone) : 'Never done yet'}</span>
                </div>
                ${c.steps && c.steps.length ? `<div class="mb-4"><div class="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">Tiny steps</div>
                    ${c.steps.map((s, i) => `<label class="flex items-center gap-2 py-1"><input type="checkbox" class="w-4 h-4 accent-emerald-500"> <span>${i + 1}. ${esc(s)}</span></label>`).join('')}</div>` : ''}
                <div class="glass rounded-2xl p-4 mb-4 flex items-center gap-4">
                    <div id="chore-timer" class="text-4xl font-black timer-font tabular-nums">${pad(Math.min(c.mins, 99))}:00</div>
                    <div class="flex-1 text-xs text-slate-500">Body-double yourself: start the timer and just begin. You can stop when it rings.</div>
                    <button id="chore-timer-btn" class="${this._btnCls}">Start</button>
                </div>
                ${!focusMode ? `<details class="mb-4"><summary class="cursor-pointer text-sm font-bold text-slate-500">Edit schedule</summary>
                    <div class="grid grid-cols-2 gap-3 mt-3">
                        ${this._field('Name', `<input id="ch-name" class="${this._inputCls}" value="${esc(c.name)}">`)}
                        ${this._field('Minutes', `<input id="ch-mins" type="number" min="1" max="240" class="${this._inputCls}" value="${c.mins}">`)}
                        ${this._field('Repeat every (days)', `<input id="ch-every" type="number" min="1" max="365" class="${this._inputCls}" value="${c.every}">`)}
                        ${this._field('Energy', `<select id="ch-energy" class="${this._inputCls}">${[1, 2, 3].map(l => `<option value="${l}" ${c.energy === l ? 'selected' : ''}>${ENERGY[l].icon} ${ENERGY[l].label}</option>`).join('')}</select>`)}
                        ${this._field('Preferred day', `<select id="ch-day" class="${this._inputCls}"><option value="">Any (auto-balance)</option>${DOW.map((d, i) => `<option value="${i}" ${c.day === i ? 'selected' : ''}>${d}</option>`).join('')}</select>`)}
                        ${this._field('Next due', `<input id="ch-next" type="date" class="${this._inputCls}" value="${next}">`)}
                    </div>
                    <div class="flex justify-between mt-2"><button onclick="app.removeChore('${c.id}')" class="text-red-500 font-bold text-sm">Remove chore</button><button id="ch-save" class="${this._ghostBtnCls}">Save changes</button></div>
                </details>` : ''}
                <div class="flex gap-2 justify-end">
                    ${isToday && !doneToday ? `<button onclick="app.snoozeChore('${c.id}'); app.closeLifeModal()" class="${this._ghostBtnCls}">Not today</button>` : ''}
                    <button onclick="app.completeChore('${c.id}')" class="${doneToday ? this._ghostBtnCls : 'bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold'}">${doneToday ? 'Undo done' : '✓ I did it!'}</button>
                </div>`, wrap => {
                let remaining = c.mins * 60;
                clearInterval(this._choreTimer);
                const out = wrap.querySelector('#chore-timer');
                const btn = wrap.querySelector('#chore-timer-btn');
                btn.onclick = () => {
                    if (this._choreTimer) { clearInterval(this._choreTimer); this._choreTimer = null; btn.textContent = 'Resume'; return; }
                    btn.textContent = 'Pause';
                    this._choreTimer = setInterval(() => {
                        if (!document.body.contains(out) || wrap.classList.contains('hidden')) { clearInterval(this._choreTimer); this._choreTimer = null; return; }
                        remaining = Math.max(0, remaining - 1);
                        out.textContent = `${pad(Math.floor(remaining / 60))}:${pad(remaining % 60)}`;
                        if (!remaining) { clearInterval(this._choreTimer); this._choreTimer = null; btn.textContent = 'Done'; this.showToast('Time! Did you finish? Either way, you started. 💪'); this.vibrate?.([200, 100, 200]); }
                    }, 1000);
                };
                const saveBtn = wrap.querySelector('#ch-save');
                if (saveBtn) saveBtn.onclick = () => {
                    c.name = wrap.querySelector('#ch-name').value.trim() || c.name;
                    c.mins = Math.max(1, Number(wrap.querySelector('#ch-mins').value) || c.mins);
                    c.every = Math.max(1, Number(wrap.querySelector('#ch-every').value) || c.every);
                    c.energy = Number(wrap.querySelector('#ch-energy').value);
                    const day = wrap.querySelector('#ch-day').value;
                    c.day = day === '' ? null : Number(day);
                    const nd = wrap.querySelector('#ch-next').value;
                    if (nd && nd !== next) {
                        // Pin the next occurrence; completing the chore clears the pin.
                        c.nextDue = nd;
                        c.snooze = '';
                    }
                    this._saveChores();
                    this.closeLifeModal();
                    this.lifeRefresh();
                    this.renderChores();
                    this.showToast('Chore updated');
                };
            });
        },

        openChoreDay(date) {
            const list = this._choreSchedule(date, 1)[date] || [];
            const mins = list.reduce((n, x) => n + x.chore.mins, 0);
            this.lifeModal(`Chores · ${date === todayStr() ? 'Today' : fmtDay(date)}`, `
                <p class="text-sm text-slate-500 mb-2">${list.length} chore${list.length === 1 ? '' : 's'} · about ${mins} min${date !== todayStr() ? ' — you can tick them off on the day' : ''}</p>
                <div class="divide-y divide-slate-200/60 dark:divide-slate-700/60">${list.map(x => this._choreRow(x, date)).join('') || '<p class="text-sm text-slate-400 py-2">Nothing scheduled.</p>'}</div>
                <div class="flex justify-end mt-4"><button onclick="app.closeLifeModal(); app.switchTab('chores')" class="${this._ghostBtnCls}">Open Chores</button></div>`);
        },

        openCustomChore() {
            this.lifeModal('Add your own chore', `
                ${this._field('Chore', `<input id="cc-name" class="${this._inputCls}" placeholder="Water the fern, call grandma…">`)}
                <div class="grid grid-cols-3 gap-3">
                    ${this._field('Minutes', `<input id="cc-mins" type="number" min="1" value="10" class="${this._inputCls}">`)}
                    ${this._field('Every (days)', `<input id="cc-every" type="number" min="1" value="7" class="${this._inputCls}">`)}
                    ${this._field('Energy', `<select id="cc-energy" class="${this._inputCls}">${[1, 2, 3].map(l => `<option value="${l}">${ENERGY[l].icon} ${ENERGY[l].label}</option>`).join('')}</select>`)}
                </div>
                ${this._field('Tiny steps (one per line, optional)', `<textarea id="cc-steps" rows="3" class="${this._inputCls}"></textarea>`)}
                <div class="flex justify-end gap-2 mt-2"><button onclick="app.closeLifeModal()" class="${this._ghostBtnCls}">Cancel</button><button id="cc-save" class="${this._btnCls}">Add chore</button></div>`, wrap => {
                wrap.querySelector('#cc-save').onclick = () => {
                    const name = wrap.querySelector('#cc-name').value.trim();
                    if (!name) return wrap.querySelector('#cc-name').focus();
                    this.chores.push({
                        id: uid(), name, cat: 'Custom',
                        mins: Math.max(1, Number(wrap.querySelector('#cc-mins').value) || 10),
                        every: Math.max(1, Number(wrap.querySelector('#cc-every').value) || 7),
                        energy: Number(wrap.querySelector('#cc-energy').value),
                        steps: wrap.querySelector('#cc-steps').value.split('\n').map(s => s.trim()).filter(Boolean),
                        day: null, lastDone: '', history: [], start: todayStr()
                    });
                    this._saveChores();
                    this.closeLifeModal();
                    this.lifeRefresh();
                    this.renderChores();
                };
            });
        },

        renderChores() {
            const root = document.getElementById('chores-root');
            if (!root || !this._lifeReady) return;
            const today = todayStr();
            const f = this._choreFilter;
            const sched = this._choreSchedule(today, 7);
            const todayList = sched[today] || [];
            const energy = this._checkin().energy;
            const left = todayList.filter(x => !x.doneToday);
            const minsLeft = left.reduce((s, x) => s + x.chore.mins, 0);
            const adopted = new Set(this.chores.map(c => c.libId).filter(Boolean));
            const prefs = this.chorePrefs;
            const tab = (id, label) => `<button onclick="app.setChoreFilter('${id}')" class="px-4 py-2 rounded-full text-xs font-bold uppercase whitespace-nowrap ${f === id ? 'bg-indigo-600 text-white' : 'glass hover:bg-white/50'}">${label}</button>`;

            let body = '';
            if (f === 'today') {
                const sorted = [...todayList].sort((a, b) => a.doneToday - b.doneToday || (energy ? (a.chore.energy > energy) - (b.chore.energy > energy) : 0) || a.chore.mins - b.chore.mins);
                body = !this.chores.length ? this._choreEmpty() : `
                    <div class="glass p-5 rounded-2xl">
                        <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
                            <div class="font-bold">${left.length ? `${left.length} chore${left.length > 1 ? 's' : ''} · about ${minsLeft} min` : 'All clear for today 🎉'}</div>
                            ${left.length ? `<button onclick="app.pickOneChore()" class="${this._btnCls} text-sm">🎯 Just pick one for me</button>` : ''}
                        </div>
                        ${energy === 1 ? '<p class="text-xs text-slate-500 mb-2">You said energy is low — 🔋 low-effort chores are listed first. Skipping is allowed.</p>' : ''}
                        <div class="divide-y divide-slate-200/60 dark:divide-slate-700/60">${sorted.map(x => this._choreRow(x, today)).join('') || '<p class="text-sm text-slate-400 py-2">Nothing scheduled today.</p>'}</div>
                    </div>`;
            } else if (f === 'week') {
                const days = [];
                for (let i = 0; i < 7; i++) {
                    const d = addDays(today, i);
                    const list = sched[d] || [];
                    const mins = list.reduce((s, x) => s + x.chore.mins, 0);
                    const off = prefs.offDays.includes(parse(d).getDay());
                    days.push(`
                        <div class="glass p-4 rounded-2xl ${d === today ? 'ring-2 ring-indigo-400' : ''}">
                            <div class="flex justify-between items-center mb-2">
                                <div class="font-black">${i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : fmtDay(d)}</div>
                                <div class="text-[11px] font-bold ${mins > prefs.budget ? 'text-rose-500' : 'text-slate-400'}">${off ? '🌴 chore-free · ' : ''}${mins} / ${prefs.budget} min</div>
                            </div>
                            <div class="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 mb-2 overflow-hidden"><div class="h-full ${mins > prefs.budget ? 'bg-rose-500' : 'bg-emerald-500'}" style="width:${Math.min(100, mins / prefs.budget * 100)}%"></div></div>
                            <div class="divide-y divide-slate-200/60 dark:divide-slate-700/60">${list.map(x => this._choreRow(x, d, true)).join('') || '<p class="text-xs text-slate-400 py-1">Nothing — rest day.</p>'}</div>
                        </div>`);
                }
                body = this.chores.length ? `<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">${days.join('')}</div>` : this._choreEmpty();
            } else if (f === 'mine') {
                body = !this.chores.length ? this._choreEmpty() : `
                    <div class="glass p-5 rounded-2xl divide-y divide-slate-200/60 dark:divide-slate-700/60">
                        ${[...this.chores].sort((a, b) => a.every - b.every || a.name.localeCompare(b.name)).map(c => this._choreRow({ chore: c, doneToday: c.lastDone === today }, '')).join('')}
                    </div>`;
            } else {
                body = `
                    <div class="glass p-5 rounded-2xl mb-6">
                        <div class="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">One-click routine packs</div>
                        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            ${ROUTINE_PACKS.map(p => `
                                <button onclick="app.adoptPack('${p.id}')" class="text-left glass p-4 rounded-xl hover:ring-2 hover:ring-indigo-400 transition-all">
                                    <div class="flex items-center gap-2 font-bold"><i data-lucide="${p.icon}" class="w-4 h-4 text-indigo-500"></i>${p.name}</div>
                                    <div class="text-[11px] text-slate-400 mt-1">${p.ids.map(id => CHORE_INDEX[id].name).join(' · ')}</div>
                                </button>`).join('')}
                        </div>
                    </div>
                    ${Object.entries(CHORE_LIBRARY).map(([cat, items]) => `
                        <div class="mb-6">
                            <div class="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2 px-1">${cat}</div>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                                ${items.map(([id]) => {
                                    const l = CHORE_INDEX[id];
                                    const has = adopted.has(id);
                                    return `<div class="glass p-3 rounded-xl flex items-center gap-3">
                                        <div class="flex-1 min-w-0">
                                            <div class="font-medium truncate">${esc(l.name)}</div>
                                            <div class="text-[11px] text-slate-400">${ENERGY[l.energy].icon} ${l.mins} min · every ${l.every === 1 ? 'day' : l.every + ' days'}</div>
                                        </div>
                                        <button onclick="app.adoptChore('${id}')" ${has ? 'disabled' : ''} class="px-3 py-1.5 rounded-lg text-xs font-bold ${has ? 'text-emerald-600' : 'bg-indigo-600 text-white hover:bg-indigo-700'}">${has ? '✓ Added' : '+ Add'}</button>
                                    </div>`;
                                }).join('')}
                            </div>
                        </div>`).join('')}`;
            }

            root.innerHTML = `
            <div class="max-w-5xl mx-auto pb-24 md:pb-10">
                <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
                    <div>
                        <h2 class="text-3xl font-black">Chores</h2>
                        <p class="text-sm text-slate-500">ADHD-friendly: tiny steps, time boxes, and a schedule that balances itself.</p>
                    </div>
                    <div class="flex items-center gap-3 text-sm font-bold">
                        <span class="glass px-3 py-2 rounded-xl" title="Days in a row with at least one chore done">🔥 ${this._choreStreak()} day streak</span>
                        <span class="glass px-3 py-2 rounded-xl" title="One point per minute of chores">✨ ${prefs.points || 0} pts</span>
                    </div>
                </div>
                <details class="glass p-4 rounded-2xl mb-6" ${this.chores.length ? '' : 'open'}>
                    <summary class="cursor-pointer font-bold flex items-center gap-2"><i data-lucide="sliders-horizontal" class="w-4 h-4"></i> My scheduling needs</summary>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                        <label class="block"><span class="block text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1">Max chore time per day: <b id="chore-budget-out">${prefs.budget}</b> min</span>
                            <input type="range" min="10" max="180" step="5" value="${prefs.budget}" oninput="document.getElementById('chore-budget-out').textContent=this.value" onchange="app.setChorePref('budget', this.value)" class="w-full accent-indigo-500"></label>
                        <div><span class="block text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1">Chore-free days (busy days)</span>
                            <div class="flex gap-1">${DOW.map((d, i) => `<button onclick="app.setChorePref('offDay', ${i})" class="flex-1 py-1.5 rounded-lg text-xs font-bold ${prefs.offDays.includes(i) ? 'bg-rose-500 text-white' : 'glass'}">${d[0]}</button>`).join('')}</div></div>
                        <label class="block"><span class="block text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1">Best time for chores</span>
                            <select onchange="app.setChorePref('window', this.value)" class="${this._inputCls}">
                                ${['morning', 'afternoon', 'evening'].map(w => `<option value="${w}" ${prefs.window === w ? 'selected' : ''}>${w[0].toUpperCase() + w.slice(1)} (${fmtTime(pad(WINDOW_HOUR[w]) + ':00')})</option>`).join('')}
                            </select></label>
                    </div>
                    <p class="text-xs text-slate-400 mt-3">Chores are spread so no day goes over your limit, skip your chore-free days (daily basics excepted) and appear on the calendar at your best time.</p>
                </details>
                <div class="flex gap-2 mb-6 overflow-x-auto pb-1">
                    ${tab('today', 'Today')}${tab('week', 'This week')}${tab('mine', `My chores (${this.chores.length})`)}${tab('library', 'Premade library')}
                    <button onclick="app.openCustomChore()" class="ml-auto px-4 py-2 rounded-full text-xs font-bold uppercase glass hover:bg-white/50 whitespace-nowrap">+ Custom</button>
                </div>
                ${body}
            </div>`;
            this._rebuildIcons();
        },

        _choreEmpty() {
            return `<div class="glass p-8 rounded-2xl text-center">
                <div class="text-4xl mb-3">🧺</div>
                <div class="font-black text-xl mb-1">Let's build your routine</div>
                <p class="text-slate-500 mb-5">Pick a pack to start — you can tweak or remove anything later.</p>
                <div class="flex flex-wrap justify-center gap-2">
                    ${ROUTINE_PACKS.map(p => `<button onclick="app.adoptPack('${p.id}')" class="${p.id === 'starter' ? this._btnCls : this._ghostBtnCls} text-sm">${p.name}</button>`).join('')}
                    <button onclick="app.setChoreFilter('library')" class="${this._ghostBtnCls} text-sm">Browse 70+ chores</button>
                </div>
            </div>`;
        },

        // ═══════════════════════════════════════════════════════════
        // BILLS — recurring due dates, paid tracking, calendar feed
        // ═══════════════════════════════════════════════════════════
        _saveBills() { save('wd_bills', this.bills); },

        _billOccurrences(b, from, to) {
            const out = [];
            if (!b.due) return out;
            if (b.freq === 'once') return (b.due >= from && b.due <= to) ? [b.due] : out;
            const a = parse(b.due);
            const dom = a.getDate();
            const monthStep = { monthly: 1, quarterly: 3, yearly: 12 }[b.freq];
            const dayStep = { weekly: 7, biweekly: 14 }[b.freq];
            for (let k = 0, guard = 0; guard < 2000; k++, guard++) {
                let d;
                if (monthStep) {
                    const m = a.getMonth() + k * monthStep;
                    const y = a.getFullYear() + Math.floor(m / 12);
                    const mm = ((m % 12) + 12) % 12;
                    d = ymd(new Date(y, mm, Math.min(dom, new Date(y, mm + 1, 0).getDate())));
                } else {
                    d = addDays(b.due, k * dayStep);
                }
                if (d > to) break;
                if (d >= from) out.push(d);
            }
            return out;
        },

        _billsBetween(from, to) {
            const out = [];
            this.bills.forEach(bill => this._billOccurrences(bill, from, to).forEach(date => {
                out.push({ bill, date, paid: (bill.paid || []).includes(date) || (bill.autopay && date < todayStr()) });
            }));
            return out.sort((a, b) => a.date.localeCompare(b.date));
        },

        _billRow(o, compact) {
            const today = todayStr();
            const days = diffDays(today, o.date);
            const when = days < 0 ? `${-days}d overdue` : days === 0 ? 'Due today' : days === 1 ? 'Tomorrow' : fmtDay(o.date);
            return `
                <div class="flex items-center gap-3 py-2">
                    <button onclick="app.toggleBillPaid('${o.bill.id}', '${o.date}')" class="w-6 h-6 shrink-0 rounded-lg border-2 ${o.paid ? 'bg-amber-500 border-amber-500' : 'border-slate-300 dark:border-slate-600 hover:border-amber-500'} flex items-center justify-center" aria-label="Mark ${esc(o.bill.name)} paid">${o.paid ? '<i data-lucide="check" class="w-4 h-4 text-white"></i>' : ''}</button>
                    <button onclick="app.openBillModal('${o.bill.id}')" class="flex-1 text-left min-w-0">
                        <span class="block truncate font-medium ${o.paid ? 'line-through text-slate-400' : ''}">${esc(o.bill.name)}</span>
                        ${compact ? '' : `<span class="text-[11px] text-slate-400">${esc(o.bill.cat || 'Other')} · ${FREQS[o.bill.freq]}${o.bill.autopay ? ' · autopay' : ''}</span>`}
                    </button>
                    <span class="text-[11px] font-bold ${days < 0 && !o.paid ? 'text-rose-500' : days <= 2 && !o.paid ? 'text-amber-500' : 'text-slate-400'}">${o.paid ? 'Paid' : when}</span>
                    <span class="font-bold tabular-nums">${money(o.bill.amount)}</span>
                </div>`;
        },

        toggleBillPaid(id, date) {
            const b = this.bills.find(x => x.id === id);
            if (!b) return;
            b.paid = b.paid || [];
            if (b.paid.includes(date)) {
                b.paid = b.paid.filter(d => d !== date);
                this.showToast(`${b.name} marked unpaid`);
            } else {
                b.paid.push(date);
                b.paid = b.paid.sort().slice(-60);
                this._celebrate(`${b.name} paid 💸`);
            }
            this._saveBills();
            this.lifeRefresh();
            this.renderBills();
        },

        openBillModal(id) {
            const b = this.bills.find(x => x.id === id) || { name: '', amount: '', due: todayStr(), freq: 'monthly', cat: 'Utilities', autopay: false, notes: '' };
            const isEdit = !!b.id;
            this.lifeModal(isEdit ? 'Edit bill' : 'Add a bill', `
                ${this._field('Name', `<input id="bl-name" class="${this._inputCls}" value="${esc(b.name)}" placeholder="Rent, electric, Netflix…">`)}
                <div class="grid grid-cols-2 gap-3">
                    ${this._field('Amount ($)', `<input id="bl-amount" type="number" step="0.01" min="0" class="${this._inputCls}" value="${esc(b.amount)}">`)}
                    ${this._field(isEdit ? 'First due date' : 'Next due date', `<input id="bl-due" type="date" class="${this._inputCls}" value="${b.due}">`)}
                    ${this._field('Repeats', `<select id="bl-freq" class="${this._inputCls}">${Object.entries(FREQS).map(([k, v]) => `<option value="${k}" ${b.freq === k ? 'selected' : ''}>${v}</option>`).join('')}</select>`)}
                    ${this._field('Category', `<select id="bl-cat" class="${this._inputCls}">${BILL_CATS.map(c => `<option ${b.cat === c ? 'selected' : ''}>${c}</option>`).join('')}</select>`)}
                </div>
                <label class="flex items-center gap-2 mb-3 text-sm font-medium"><input id="bl-auto" type="checkbox" ${b.autopay ? 'checked' : ''} class="w-4 h-4 accent-amber-500"> On autopay (past due dates count as paid)</label>
                ${this._field('Notes / where to pay', `<input id="bl-notes" class="${this._inputCls}" value="${esc(b.notes)}" placeholder="Account #, website, who to call…">`)}
                <div class="flex justify-between gap-2 mt-4">
                    ${isEdit ? `<button onclick="app.deleteBill('${b.id}')" class="text-red-500 font-bold text-sm px-3">Delete</button>` : '<span></span>'}
                    <div class="flex gap-2"><button onclick="app.closeLifeModal()" class="${this._ghostBtnCls}">Cancel</button><button id="bl-save" class="${this._btnCls}">Save</button></div>
                </div>`, wrap => {
                wrap.querySelector('#bl-save').onclick = () => {
                    const name = wrap.querySelector('#bl-name').value.trim();
                    if (!name) return wrap.querySelector('#bl-name').focus();
                    const rec = isEdit ? b : { id: uid(), paid: [] };
                    rec.name = name;
                    rec.amount = Math.max(0, parseFloat(wrap.querySelector('#bl-amount').value) || 0);
                    rec.due = wrap.querySelector('#bl-due').value || todayStr();
                    rec.freq = wrap.querySelector('#bl-freq').value;
                    rec.cat = wrap.querySelector('#bl-cat').value;
                    rec.autopay = wrap.querySelector('#bl-auto').checked;
                    rec.notes = wrap.querySelector('#bl-notes').value;
                    if (!isEdit) this.bills.push(rec);
                    this._saveBills();
                    this.closeLifeModal();
                    this.lifeRefresh();
                    this.renderBills();
                    this.showToast(isEdit ? 'Bill updated' : 'Bill added — it\'s on your calendar now');
                };
            });
        },

        deleteBill(id) {
            this.bills = this.bills.filter(b => b.id !== id);
            this._saveBills();
            this.closeLifeModal();
            this.lifeRefresh();
            this.renderBills();
        },

        renderBills() {
            const root = document.getElementById('bills-root');
            if (!root || !this._lifeReady) return;
            const today = todayStr();
            const now = parse(today);
            const monthStart = ymd(new Date(now.getFullYear(), now.getMonth(), 1));
            const monthEnd = ymd(new Date(now.getFullYear(), now.getMonth() + 1, 0));
            const overdue = this._billsBetween(addDays(today, -60), addDays(today, -1)).filter(o => !o.paid);
            const upcoming = this._billsBetween(today, addDays(today, 30));
            const thisMonth = this._billsBetween(monthStart, monthEnd);
            const monthTotal = thisMonth.reduce((s, o) => s + Number(o.bill.amount), 0);
            const monthPaid = thisMonth.filter(o => o.paid).reduce((s, o) => s + Number(o.bill.amount), 0);
            const avgMonthly = this.bills.reduce((s, b) => s + Number(b.amount) * PER_MONTH[b.freq], 0);
            const byCat = {};
            this.bills.forEach(b => { byCat[b.cat || 'Other'] = (byCat[b.cat || 'Other'] || 0) + Number(b.amount) * PER_MONTH[b.freq]; });
            const nextUnpaid = upcoming.find(o => !o.paid);
            const stat = (label, value, sub) => `<div class="glass p-4 rounded-2xl"><div class="text-[11px] font-bold uppercase tracking-widest text-slate-400">${label}</div><div class="text-2xl font-black mt-1 tabular-nums">${value}</div>${sub ? `<div class="text-xs text-slate-400 mt-0.5">${sub}</div>` : ''}</div>`;

            root.innerHTML = `
            <div class="max-w-5xl mx-auto pb-24 md:pb-10">
                <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
                    <div>
                        <h2 class="text-3xl font-black">Bills</h2>
                        <p class="text-sm text-slate-500">Every due date lands on your calendar and your morning check-in.</p>
                    </div>
                    <button onclick="app.openBillModal()" class="${this._btnCls} flex items-center gap-2"><i data-lucide="plus" class="w-4 h-4"></i> Add bill</button>
                </div>
                ${!this.bills.length ? `
                    <div class="glass p-8 rounded-2xl text-center">
                        <div class="text-4xl mb-3">💸</div>
                        <div class="font-black text-xl mb-1">Add your bills once</div>
                        <p class="text-slate-500 mb-5">Rent, utilities, phone, cards, subscriptions — set the due date and how often it repeats. We'll remind you every morning.</p>
                        <button onclick="app.openBillModal()" class="${this._btnCls}">Add your first bill</button>
                    </div>` : `
                <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    ${stat('This month', money(monthTotal), `${money(monthPaid)} paid`)}
                    ${stat('Still to pay', money(monthTotal - monthPaid), `${thisMonth.filter(o => !o.paid).length} bill(s)`)}
                    ${stat('Avg / month', money(avgMonthly), `${this.bills.length} bill(s) tracked`)}
                    ${stat('Next up', nextUnpaid ? esc(nextUnpaid.bill.name) : '—', nextUnpaid ? `${fmtDay(nextUnpaid.date)} · ${money(nextUnpaid.bill.amount)}` : 'All caught up')}
                </div>
                ${overdue.length ? `<div class="glass p-5 rounded-2xl mb-6 ring-2 ring-rose-400/60"><div class="text-xs font-bold uppercase tracking-widest text-rose-500 mb-2">Overdue</div>${overdue.map(o => this._billRow(o)).join('')}</div>` : ''}
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div class="glass p-5 rounded-2xl lg:col-span-2">
                        <div class="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Next 30 days</div>
                        <div class="divide-y divide-slate-200/60 dark:divide-slate-700/60">${upcoming.map(o => this._billRow(o)).join('') || '<p class="text-sm text-slate-400 py-2">Nothing due in the next 30 days.</p>'}</div>
                    </div>
                    <div class="space-y-6">
                        <div class="glass p-5 rounded-2xl">
                            <div class="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Monthly by category</div>
                            ${Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([cat, v]) => `
                                <div class="mb-2">
                                    <div class="flex justify-between text-sm"><span>${esc(cat)}</span><span class="font-bold tabular-nums">${money(v)}</span></div>
                                    <div class="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden"><div class="h-full bg-amber-500" style="width:${avgMonthly ? v / avgMonthly * 100 : 0}%"></div></div>
                                </div>`).join('')}
                        </div>
                        <div class="glass p-5 rounded-2xl">
                            <div class="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">All bills</div>
                            ${[...this.bills].sort((a, b) => a.name.localeCompare(b.name)).map(b => `
                                <button onclick="app.openBillModal('${b.id}')" class="w-full flex justify-between items-center py-1.5 text-sm hover:text-indigo-500">
                                    <span class="truncate">${esc(b.name)}${b.autopay ? ' <span class="text-[10px] text-emerald-500 font-bold">AUTO</span>' : ''}</span><span class="text-slate-400 shrink-0 ml-2">${money(b.amount)} · ${FREQS[b.freq].toLowerCase()}</span>
                                </button>`).join('')}
                        </div>
                    </div>
                </div>`}
            </div>`;
            this._rebuildIcons();
        },

        // ═══════════════════════════════════════════════════════════
        // PAGES — Notion-style block editor (Editor.js)
        // ═══════════════════════════════════════════════════════════
        _savePages() { save('wd_pages', this.pages); },

        renderPagesList() {
            const list = document.getElementById('pages-list');
            if (!list || !this._lifeReady) return;
            const q = (document.getElementById('pages-search')?.value || '').toLowerCase();
            const active = localStorage.getItem('wd_pages_active');
            const items = [...this.pages]
                .filter(p => !q || p.title.toLowerCase().includes(q) || JSON.stringify(p.data || {}).toLowerCase().includes(q))
                .sort((a, b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0) || b.updated - a.updated);
            list.innerHTML = items.map(p => `
                <button onclick="app.openPage('${p.id}')" class="w-full text-left flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors ${p.id === active ? 'bg-indigo-600 text-white' : 'hover:bg-white/50 dark:hover:bg-slate-800/60'}">
                    <span>${p.icon || '📝'}</span><span class="flex-1 truncate font-medium">${esc(p.title || 'Untitled')}</span>${p.fav ? '<span class="text-[10px]">★</span>' : ''}
                </button>`).join('') || `<p class="text-xs text-slate-400 px-3 py-2">${q ? 'No matches.' : 'No pages yet.'}</p>`;
        },

        async initPages() {
            const holder = document.getElementById('page-editor');
            if (!holder) return;
            if (!this.pages.length) {
                this.newPage('moodboard', true);
                this.newPage('journal', true);
            }
            if (!this._editorLibs) {
                holder.innerHTML = '<p class="text-slate-400">Loading editor…</p>';
                try {
                    // Editor.js core first; the tool plugins register as globals after it.
                    await this._loadScript(CDN.editor[0]);
                    await Promise.all(CDN.editor.slice(1).map(src => this._loadScript(src)));
                    this._editorLibs = true;
                } catch (e) {
                    holder.innerHTML = '<p class="text-slate-400">Couldn\'t load the editor. Check your connection and reopen this tab.</p>';
                    return;
                }
            }
            const active = localStorage.getItem('wd_pages_active');
            const page = this.pages.find(p => p.id === active) || [...this.pages].sort((a, b) => b.updated - a.updated)[0];
            if (!this._editor || this._editorPage !== page.id) this.openPage(page.id);
        },

        newPage(template = 'blank', silent) {
            const t = PAGE_TEMPLATES[template] || PAGE_TEMPLATES.blank;
            const page = {
                id: uid(), icon: t.icon, fav: false, updated: Date.now(),
                title: typeof t.title === 'function' ? t.title() : t.title,
                data: { time: Date.now(), blocks: JSON.parse(JSON.stringify(t.blocks)) }
            };
            this.pages.push(page);
            this._savePages();
            if (!silent) { this.closeLifeModal(); this.openPage(page.id); }
            return page;
        },

        openNewPageModal() {
            this.lifeModal('New page', `
                <div class="grid grid-cols-2 gap-2">
                    ${Object.entries(TEMPLATE_LABELS).map(([k, v]) => `
                        <button onclick="app.newPage('${k}')" class="glass p-4 rounded-xl text-left hover:ring-2 hover:ring-indigo-400 transition-all">
                            <div class="text-2xl mb-1">${PAGE_TEMPLATES[k].icon}</div><div class="font-bold text-sm">${v}</div>
                        </button>`).join('')}
                </div>`);
        },

        async openPage(id) {
            const page = this.pages.find(p => p.id === id);
            if (!page || !this._editorLibs) {
                if (page) localStorage.setItem('wd_pages_active', id);
                return;
            }
            await this._flushPage();
            localStorage.setItem('wd_pages_active', id);
            this._editorPage = id;
            document.getElementById('page-title').value = page.title;
            document.getElementById('page-icon').textContent = page.icon || '📝';
            document.getElementById('page-fav').classList.toggle('text-amber-500', !!page.fav);
            this._pageMeta(page);
            this.renderPagesList();
            if (this._editor) { try { this._editor.destroy(); } catch (e) {} this._editor = null; }
            const holder = document.getElementById('page-editor');
            holder.innerHTML = '';
            this._editor = new EditorJS({
                holder: 'page-editor',
                data: page.data && page.data.blocks ? page.data : { blocks: [] },
                autofocus: !page.data?.blocks?.length,
                placeholder: 'Type \'/\' for commands, or just start writing…',
                inlineToolbar: ['bold', 'italic', 'link', 'marker', 'inlineCode'],
                tools: {
                    header: { class: window.Header, inlineToolbar: true, config: { levels: [1, 2, 3], defaultLevel: 2 }, shortcut: 'CMD+SHIFT+H' },
                    list: { class: window.EditorjsList, inlineToolbar: true, config: { defaultStyle: 'unordered' } },
                    checklist: { class: window.Checklist, inlineToolbar: true },
                    quote: { class: window.Quote, inlineToolbar: true },
                    table: { class: window.Table, inlineToolbar: true },
                    delimiter: window.Delimiter,
                    marker: { class: window.Marker, shortcut: 'CMD+SHIFT+M' },
                    inlineCode: { class: window.InlineCode, shortcut: 'CMD+SHIFT+C' }
                },
                onChange: () => {
                    clearTimeout(this._pageSaveTimer);
                    this._pageSaveTimer = setTimeout(() => this._flushPage(), 600);
                }
            });
        },

        async _flushPage() {
            clearTimeout(this._pageSaveTimer);
            if (!this._editor || !this._editorPage) return;
            const page = this.pages.find(p => p.id === this._editorPage);
            if (!page) return;
            try {
                await this._editor.isReady;
                page.data = await this._editor.save();
                page.updated = Date.now();
                this._savePages();
                this._pageMeta(page);
            } catch (e) { /* editor torn down mid-save */ }
        },

        _pageMeta(page) {
            const el = document.getElementById('page-meta');
            if (el) el.textContent = 'Saved · edited ' + new Date(page.updated).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
        },

        renamePage(value) {
            const page = this.pages.find(p => p.id === this._editorPage);
            if (!page) return;
            page.title = value;
            page.updated = Date.now();
            this._savePages();
            this.renderPagesList();
        },

        cyclePageIcon() {
            const page = this.pages.find(p => p.id === this._editorPage);
            if (!page) return;
            page.icon = PAGE_ICONS[(PAGE_ICONS.indexOf(page.icon) + 1) % PAGE_ICONS.length];
            document.getElementById('page-icon').textContent = page.icon;
            this._savePages();
            this.renderPagesList();
        },

        togglePageFav() {
            const page = this.pages.find(p => p.id === this._editorPage);
            if (!page) return;
            page.fav = !page.fav;
            document.getElementById('page-fav').classList.toggle('text-amber-500', page.fav);
            this._savePages();
            this.renderPagesList();
        },

        deletePage() {
            const page = this.pages.find(p => p.id === this._editorPage);
            if (!page || !confirm(`Delete "${page.title || 'Untitled'}"? This can't be undone.`)) return;
            this.pages = this.pages.filter(p => p.id !== page.id);
            this._savePages();
            this._editorPage = null;
            if (!this.pages.length) this.newPage('blank', true);
            this.openPage([...this.pages].sort((a, b) => b.updated - a.updated)[0].id);
        },

        async exportPageMarkdown() {
            await this._flushPage();
            const page = this.pages.find(p => p.id === this._editorPage);
            if (!page) return;
            const strip = s => String(s || '').replace(/<br\s*\/?>/g, '\n').replace(/<b>|<\/b>|<strong>|<\/strong>/g, '**').replace(/<i>|<\/i>|<em>|<\/em>/g, '_')
                .replace(/<code[^>]*>|<\/code>/g, '`').replace(/<a href="([^"]*)"[^>]*>(.*?)<\/a>/g, '[$2]($1)').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
            const listMd = (items, style, depth = 0) => items.map((it, i) => {
                const text = typeof it === 'string' ? it : it.content;
                const mark = style === 'ordered' ? `${i + 1}.` : style === 'checklist' ? (it.meta?.checked ? '- [x]' : '- [ ]') : '-';
                const kids = it.items && it.items.length ? '\n' + listMd(it.items, style, depth + 1) : '';
                return `${'  '.repeat(depth)}${mark} ${strip(text)}${kids}`;
            }).join('\n');
            const md = [`# ${page.icon || ''} ${page.title}`.trim(), ''];
            (page.data.blocks || []).forEach(b => {
                const d = b.data;
                if (b.type === 'header') md.push('#'.repeat(d.level || 2) + ' ' + strip(d.text));
                else if (b.type === 'paragraph') md.push(strip(d.text));
                else if (b.type === 'list') md.push(listMd(d.items, d.style));
                else if (b.type === 'checklist') md.push(d.items.map(i => `- [${i.checked ? 'x' : ' '}] ${strip(i.text)}`).join('\n'));
                else if (b.type === 'quote') md.push('> ' + strip(d.text) + (d.caption ? `\n> — ${strip(d.caption)}` : ''));
                else if (b.type === 'delimiter') md.push('---');
                else if (b.type === 'table') {
                    const rows = d.content.map(r => '| ' + r.map(strip).join(' | ') + ' |');
                    if (rows.length) rows.splice(1, 0, '| ' + d.content[0].map(() => '---').join(' | ') + ' |');
                    md.push(rows.join('\n'));
                }
                md.push('');
            });
            const blob = new Blob([md.join('\n')], { type: 'text/markdown' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = (page.title || 'page').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() + '.md';
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 1000);
            this.showToast('Page exported as Markdown');
        },

        // Back up / restore everything the planner stores.
        exportLife() {
            const data = {};
            ['wd_tasks', 'wd_cal_events', 'wd_bills', 'wd_chores', 'wd_chore_prefs', 'wd_pages', 'wd_checkins', 'wd_mood_history'].forEach(k => { data[k] = load(k, null); });
            const blob = new Blob([JSON.stringify({ app: 'webdesks-life', version: 1, exported: new Date().toISOString(), data }, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `webdesks-planner-backup-${todayStr()}.json`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 1000);
            this.showToast('Backup downloaded');
        },

        importLife(input) {
            const file = input.files && input.files[0];
            if (!file) return;
            file.text().then(text => {
                const json = JSON.parse(text);
                if (json.app !== 'webdesks-life' || !json.data) throw new Error('Not a WebDesks planner backup');
                if (!confirm('Replace your planner data with this backup?')) return;
                Object.entries(json.data).forEach(([k, v]) => { if (v != null && k.startsWith('wd_')) localStorage.setItem(k, JSON.stringify(v)); });
                location.reload();
            }).catch(e => this.showToast('Import failed: ' + e.message));
            input.value = '';
        }
    });
})();

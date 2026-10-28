// ═══════════════════════════════════════════════════════════════
// ACCOUNTS & DESK SYNC (Supabase)
//
// WebDesks stays local-first: every tool keeps reading and writing
// localStorage exactly as before. When someone signs in, this file
// mirrors their WebDesks keys into one row of `public.desks` so the
// same Desk follows them to any browser.
//
// - Every localStorage write to a WebDesks key is time-stamped.
// - A sync reads the cloud row, keeps the newest value of each key
//   from either side, and writes back with optimistic concurrency
//   (`version`), retrying if another device saved in between.
// - When newer data arrives from the cloud the page reloads so the
//   tools pick it up (or offers to, if you're typing).
// - Signing out saves first, then clears this browser's copy, so a
//   shared computer doesn't keep your Desk.
//
// Schema and row-level security: supabase/migrations/.
// Settings: supabase-config.js (public URL + anon key only).
// ═══════════════════════════════════════════════════════════════

(() => {
    const CFG = window.WEBDESKS_SUPABASE || {};
    const ENABLED = !!(CFG.url && CFG.anonKey);
    const SDK = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/dist/umd/supabase.js';
    const AUTH_KEY = 'sb-webdesks-auth';
    const META_KEY = 'wd_sync_meta';
    const STATE_KEY = 'wd_sync_state';
    const PUSH_DELAY = 2000;
    const PULL_EVERY = 5 * 60 * 1000;

    // Per-device keys that shouldn't follow you around.
    const LOCAL_ONLY = new Set([META_KEY, STATE_KEY, 'webdesks_last_tab', 'wd_today_opened', 'wd_pwa_dismissed', 'wd_quote', 'wd_cmdk_recent', 'wd_pages_active', 'wd_cal_view']);
    const syncable = k => typeof k === 'string' && (k.startsWith('wd_') || k.startsWith('webdesks_')) && !LOCAL_ONLY.has(k);

    const ls = window.localStorage;
    const rawSet = Storage.prototype.setItem;
    const rawRemove = Storage.prototype.removeItem;
    const readJSON = (k, fb) => { try { return JSON.parse(ls.getItem(k)) ?? fb; } catch (e) { return fb; } };
    const writeRaw = (k, v) => { try { rawSet.call(ls, k, v); } catch (e) { /* quota */ } };

    const meta = readJSON(META_KEY, {});
    let state = readJSON(STATE_KEY, {});
    const saveState = () => writeRaw(STATE_KEY, JSON.stringify(state));
    let metaTimer = null;
    // Other tabs of this browser share the stored copy, so merge (newest per key) rather than overwrite.
    const flushMeta = () => {
        clearTimeout(metaTimer);
        metaTimer = null;
        const stored = readJSON(META_KEY, {});
        Object.entries(stored).forEach(([k, t]) => { if (!(k in meta) || t > meta[k]) meta[k] = t; });
        writeRaw(META_KEY, JSON.stringify(meta));
    };
    // For deliberate rewinds/overrides (the merge choice) — no max-merge.
    const replaceMeta = () => { clearTimeout(metaTimer); metaTimer = null; writeRaw(META_KEY, JSON.stringify(meta)); };

    // Set while cloud data is being applied and the page is about to reload,
    // so stale in-memory app state can't write over what just arrived.
    let frozen = false;
    let onDirty = () => {};

    // Values the tools write as empty defaults on a fresh start, plus date-only
    // housekeeping keys. These never count as real data.
    const NOISE = new Set(['webdesks_theme', 'wd_water_date', 'wd_mood_date', 'wd_ft_lastdate']);
    const isTrivial = (k, v) => NOISE.has(k) || /^(\[\]|\{\}|0|null|false|true|)$/.test(String(v ?? '').trim());

    // A key appearing with only a default value is stamped as oldest, so a
    // freshly started (or just signed-out) browser can never overwrite real
    // data in the cloud with empty lists.
    const stamp = (k, asDefault) => {
        meta[k] = asDefault ? 0 : Date.now();
        if (!metaTimer) metaTimer = setTimeout(flushMeta, 400);
        onDirty();
    };

    // Intercept writes so every change to a WebDesks key gets a timestamp.
    Storage.prototype.setItem = function (k, v) {
        if (this === ls && syncable(k)) {
            if (frozen) return;
            const prev = ls.getItem(k);
            const changed = prev !== String(v);
            rawSet.call(this, k, v);
            if (changed) stamp(k, prev === null && isTrivial(k, v));
            return;
        }
        return rawSet.call(this, k, v);
    };
    Storage.prototype.removeItem = function (k) {
        if (this === ls && syncable(k)) {
            if (frozen) return;
            const had = ls.getItem(k) !== null;
            rawRemove.call(this, k);
            if (had) stamp(k);
            return;
        }
        return rawRemove.call(this, k);
    };
    window.addEventListener('pagehide', flushMeta);

    const localKeys = () => {
        const out = [];
        for (let i = 0; i < ls.length; i++) {
            const k = ls.key(i);
            if (syncable(k)) out.push(k);
        }
        return out;
    };

    const clearLocalDesk = () => {
        localKeys().forEach(k => rawRemove.call(ls, k));
        Object.keys(meta).forEach(k => delete meta[k]);
        clearTimeout(metaTimer);
        rawRemove.call(ls, META_KEY);
        state = {};
        rawRemove.call(ls, STATE_KEY);
    };

    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const ago = t => {
        if (!t) return 'never';
        const s = Math.round((Date.now() - t) / 1000);
        if (s < 10) return 'just now';
        if (s < 60) return `${s}s ago`;
        if (s < 3600) return `${Math.round(s / 60)} min ago`;
        if (s < 86400) return `${Math.round(s / 3600)} h ago`;
        return new Date(t).toLocaleDateString();
    };
    const AVATARS = ['🙂', '😎', '🦊', '🐼', '🐸', '🦉', '🐙', '🌻', '🌈', '🚀', '⚡', '🎧', '📚', '🧠', '🌙', '🔥'];
    const loginUrl = extra => '/login' + (extra ? '?' + extra : '');

    Object.assign(app, {
        accountEnabled: ENABLED,
        account: null,        // { id, email, provider }
        profile: null,        // { display_name, avatar_emoji }
        _sb: null,
        _syncStatus: 'idle',  // idle | syncing | offline | error
        _syncError: '',
        _syncRunning: null,
        _syncAgain: false,
        _pushTimer: null,

        async _supabase() {
            if (this._sb) return this._sb;
            await this._loadScript(SDK);
            this._sb = window.supabase.createClient(CFG.url, CFG.anonKey, {
                auth: { storageKey: AUTH_KEY, flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
            });
            this._sb.auth.onAuthStateChange((event, session) => {
                if (event === 'SIGNED_OUT' && this.account) {
                    // Session ended elsewhere (revoked, expired). Keep the local copy.
                    this.account = null;
                    this.renderAccountButton();
                }
                if (session && this.account && event === 'USER_UPDATED') {
                    this.account.email = session.user.email;
                }
            });
            return this._sb;
        },

        async initAccount() {
            this.renderAccountButton();
            if (!ENABLED) return;
            const params = new URLSearchParams(location.search);
            // "Use a different account" on /login hands off here so the Desk is saved first.
            const wantsSignOut = params.has('signout');
            params.delete('signout');
            ['signedin', 'deleted', 'signedout'].forEach(flag => {
                if (params.has(flag)) {
                    params.delete(flag);
                    const msg = { signedin: 'Signed in — syncing your Desk…', deleted: 'Your account and cloud Desk were deleted.', signedout: 'Signed out. This browser\'s copy of your Desk was cleared.' }[flag];
                    setTimeout(() => this.showToast(msg), 400);
                }
            });
            const qs = params.toString();
            if (qs !== location.search.replace(/^\?/, '')) history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
            if (sessionStorage.getItem('wd_sync_reloaded')) {
                sessionStorage.setItem('wd_sync_reloaded_at', sessionStorage.getItem('wd_sync_reloaded'));
                sessionStorage.removeItem('wd_sync_reloaded');
                setTimeout(() => this.showToast('Desk updated from your account ☁️'), 600);
            }

            // Only fetch the SDK when there's a session to restore.
            if (!ls.getItem(AUTH_KEY)) return;
            try {
                const sb = await this._supabase();
                const { data } = await sb.auth.getSession();
                if (!data.session) { this.renderAccountButton(); return; }
                await this._startSession(data.session.user);
                if (wantsSignOut) await this.signOut('/login');
            } catch (e) {
                this._syncStatus = 'offline';
                this.renderAccountButton();
            }
        },

        async _startSession(user) {
            this.account = { id: user.id, email: user.email, provider: user.app_metadata?.provider || 'email' };
            this.renderAccountButton();
            this._loadProfile(user);

            // A different account's Desk is still in this browser (its session
            // lapsed without signing out). Don't mix them.
            if (state.owner && state.owner !== user.id) {
                // Restart with an empty browser so the previous account's data,
                // still loaded in the page, can't be saved into this one.
                clearLocalDesk();
                state.owner = user.id;
                saveState();
                frozen = true;
                location.reload();
                return;
            }
            if (!state.owner) {
                const remote = await this._fetchDesk().catch(() => undefined);
                if (remote === undefined) { this._syncStatus = 'offline'; this.renderAccountButton(); return; }
                const remoteKeys = Object.keys(remote?.data?.keys || {});
                // Empty defaults the tools write on a fresh start don't count as data worth asking about.
                const hasLocal = localKeys().some(k => !isTrivial(k, ls.getItem(k)));
                if (remoteKeys.length && hasLocal) {
                    const choice = await this._askMerge(remoteKeys.length);
                    if (choice === 'cloud') {
                        // Cloud wins everywhere; drop what only this browser had.
                        localKeys().forEach(k => {
                            if (remoteKeys.includes(k)) meta[k] = 0;
                            else { rawRemove.call(ls, k); delete meta[k]; }
                        });
                        replaceMeta();
                    } else if (choice === 'local') {
                        const now = Date.now();
                        localKeys().forEach(k => { meta[k] = now; });
                        replaceMeta();
                    } else {
                        // Combine: the cloud keeps any tool both sides have.
                        localKeys().forEach(k => { if (remoteKeys.includes(k)) meta[k] = 0; });
                        replaceMeta();
                    }
                } else if (remoteKeys.length) {
                    // Nothing real here: the cloud Desk wins outright.
                    localKeys().forEach(k => { if (remoteKeys.includes(k)) meta[k] = 0; });
                    replaceMeta();
                }
                state.owner = user.id;
                saveState();
            }
            onDirty = () => this._schedulePush();
            await this.sync({ initial: true });

            document.addEventListener('visibilitychange', () => {
                if (!this.account) return;
                if (document.hidden) this.sync();
                else if (Date.now() - (state.lastSync || 0) > 30000) this.sync();
            });
            window.addEventListener('online', () => this.account && this.sync());
            setInterval(() => { if (this.account && !document.hidden) this.sync(); }, PULL_EVERY);
        },

        async _loadProfile(user) {
            try {
                const sb = await this._supabase();
                const { data } = await sb.from('profiles').select('display_name, avatar_emoji').eq('id', user.id).maybeSingle();
                this.profile = data || { display_name: user.user_metadata?.display_name || user.email.split('@')[0], avatar_emoji: '' };
            } catch (e) {
                this.profile = { display_name: user.email.split('@')[0], avatar_emoji: '' };
            }
            this.renderAccountButton();
        },

        async _fetchDesk() {
            const sb = await this._supabase();
            const { data, error } = await sb.from('desks').select('data, version').eq('user_id', this.account.id).maybeSingle();
            if (error) throw error;
            return data; // null when the account has no Desk yet
        },

        _schedulePush() {
            if (!this.account) return;
            clearTimeout(this._pushTimer);
            this._pushTimer = setTimeout(() => this.sync(), PUSH_DELAY);
        },

        // Pull + merge + push in one pass. Safe to call any time.
        async sync(opts = {}) {
            if (!this.account || frozen) return;
            if (this._syncRunning) { this._syncAgain = true; return this._syncRunning; }
            clearTimeout(this._pushTimer);
            this._syncStatus = 'syncing';
            this.renderAccountButton();
            this._syncRunning = (async () => {
                const sb = await this._supabase();
                let changed = [];
                for (let attempt = 0; attempt < 4; attempt++) {
                    const row = await this._fetchDesk();
                    const remote = row?.data?.keys || {};
                    const merged = { ...remote };
                    changed = [];
                    // Cloud values newer than ours come down…
                    Object.entries(remote).forEach(([k, r]) => {
                        if (!syncable(k) || !r || typeof r.t !== 'number') return;
                        if (r.t > (meta[k] || 0)) {
                            const cur = ls.getItem(k);
                            if (r.v === null ? cur !== null : cur !== r.v) changed.push(k);
                        }
                    });
                    // …and ours that are newer go up (null marks a deletion).
                    const keys = new Set([...localKeys(), ...Object.keys(meta)]);
                    keys.forEach(k => {
                        if (!syncable(k)) return;
                        const t = meta[k] || 0;
                        const r = remote[k];
                        if (!r || t > r.t) merged[k] = { v: ls.getItem(k), t: t || 1 };
                    });
                    const upToDate = row && Object.keys(merged).every(k => remote[k] && remote[k].t === merged[k].t);
                    let version = row?.version || 0;
                    if (!upToDate) {
                        const body = { keys: merged };
                        if (row) {
                            const { data, error } = await sb.from('desks')
                                .update({ data: body, version: version + 1 })
                                .eq('user_id', this.account.id).eq('version', version)
                                .select('version');
                            if (error) throw error;
                            if (!data.length) continue; // another device saved first — merge again
                            version = data[0].version;
                        } else {
                            const { error } = await sb.from('desks').insert({ user_id: this.account.id, data: body, version: 1 });
                            if (error) {
                                if (error.code === '23505') continue; // created concurrently
                                throw error;
                            }
                            version = 1;
                        }
                    }
                    // Keys that came down are applied at reload time (see _applyRemote),
                    // so their timestamps stay old until then.
                    Object.keys(merged).forEach(k => { if ((meta[k] || 0) < merged[k].t && !changed.includes(k)) meta[k] = merged[k].t; });
                    flushMeta();
                    state.version = version;
                    state.lastSync = Date.now();
                    saveState();
                    this._syncStatus = 'idle';
                    this._syncError = '';
                    return changed.map(k => [k, remote[k]]);
                }
                throw new Error('Too many devices saving at once — will retry');
            })();
            try {
                const incoming = await this._syncRunning;
                // Signing out clears this browser anyway; don't reload over the redirect.
                if (incoming && incoming.length && !this._leaving) this._applyRemote(incoming, opts.initial);
            } catch (e) {
                this._syncStatus = navigator.onLine === false || /fetch|network/i.test(e.message || '') ? 'offline' : 'error';
                this._syncError = e.message || String(e);
                if (/JWT|session|auth/i.test(this._syncError)) this._syncStatus = 'signedout';
            } finally {
                this._syncRunning = null;
                this.renderAccountButton();
                if (this._syncAgain && !frozen) { this._syncAgain = false; this.sync(); }
            }
        },

        _applyRemote(incoming, initial) {
            const apply = () => {
                // Freeze first: the tools' in-memory state is now stale and must
                // not write over what's arriving before the reload finishes.
                frozen = true;
                incoming.forEach(([k, r]) => {
                    if (r.t <= (meta[k] || 0)) return; // changed here since — keep ours
                    if (r.v === null) rawRemove.call(ls, k); else writeRaw(k, r.v);
                    meta[k] = r.t;
                });
                flushMeta();
                sessionStorage.setItem('wd_sync_reloaded', String(Date.now()));
                location.reload();
            };
            const el = document.activeElement;
            const typing = el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
            // Never reload twice in a row on our own (protects against a loop if a write keeps failing).
            const reloadedRecently = Date.now() - Number(sessionStorage.getItem('wd_sync_reloaded_at') || 0) < 15000;
            if ((initial || !typing) && !reloadedRecently) { apply(); return; }
            let bar = document.getElementById('sync-reload-bar');
            if (!bar) {
                bar = document.createElement('div');
                bar.id = 'sync-reload-bar';
                bar.className = 'fixed top-20 left-1/2 -translate-x-1/2 z-[380] glass bg-white/95 dark:bg-slate-900/95 shadow-2xl rounded-2xl px-5 py-3 flex items-center gap-3 text-sm';
                bar.setAttribute('role', 'status');
                bar.innerHTML = '<span>☁️ Your Desk was updated on another device.</span><button class="bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-bold">Load it</button>';
                document.body.appendChild(bar);
            }
            bar.querySelector('button').onclick = apply;
        },

        // Wait until every pending change has been saved (or a sync fails).
        async flushSync() {
            clearTimeout(this._pushTimer);
            await this.sync();
            while (this._syncRunning) await this._syncRunning.catch(() => {});
        },

        _askMerge(remoteCount) {
            return new Promise(resolve => {
                const opt = (id, title, desc, primary) => `
                    <button data-choice="${id}" class="w-full text-left p-4 rounded-2xl mb-2 transition-all ${primary ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'glass hover:ring-2 hover:ring-indigo-400'}">
                        <div class="font-bold">${title}</div><div class="text-xs ${primary ? 'text-indigo-100' : 'text-slate-500'} mt-0.5">${desc}</div>
                    </button>`;
                this.lifeModal('Combine with your cloud Desk?', `
                    <p class="text-sm text-slate-500 mb-4">This browser already has WebDesks data, and your account has a saved Desk (${remoteCount} tool${remoteCount === 1 ? '' : 's'} of data). What should happen?</p>
                    ${opt('combine', 'Combine them (recommended)', 'Keep your cloud Desk, and add tools you only used in this browser.', true)}
                    ${opt('cloud', 'Use my cloud Desk only', 'Replace this browser\'s data with your account\'s Desk.')}
                    ${opt('local', 'Use this browser\'s data', 'Overwrite your cloud Desk with what\'s in this browser.')}`, wrap => {
                    wrap.querySelectorAll('[data-choice]').forEach(b => b.onclick = () => { this.closeLifeModal(); resolve(b.dataset.choice); });
                    // Closing without choosing is the safe default.
                    const close = wrap.querySelector('[aria-label="Close"]');
                    if (close) close.onclick = () => { this.closeLifeModal(); resolve('combine'); };
                });
            });
        },

        renderAccountButton() {
            const slot = document.getElementById('account-slot');
            if (!slot) return;
            if (!ENABLED) { slot.innerHTML = ''; return; }
            if (!this.account) {
                const lapsed = state.owner && ls.getItem(AUTH_KEY) === null;
                slot.innerHTML = `
                    <a href="${loginUrl('next=' + encodeURIComponent('/' + location.hash))}" class="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors" title="${lapsed ? 'Your session ended — sign in to keep syncing' : 'Sign in to save your Desk to an account'}">
                        <i data-lucide="${lapsed ? 'cloud-off' : 'log-in'}" class="w-4 h-4" aria-hidden="true"></i><span class="hidden sm:inline">${lapsed ? 'Sign in again' : 'Sign in'}</span>
                    </a>`;
                this._rebuildIcons();
                return;
            }
            const p = this.profile || {};
            const name = p.display_name || this.account.email.split('@')[0];
            const dot = { idle: 'bg-emerald-500', syncing: 'bg-amber-400 animate-pulse', offline: 'bg-slate-400', error: 'bg-rose-500', signedout: 'bg-rose-500' }[this._syncStatus] || 'bg-emerald-500';
            slot.innerHTML = `
                <button onclick="app.openAccount()" class="relative flex items-center gap-2 pl-1 pr-1 sm:pr-3 py-1 rounded-xl glass hover:ring-2 hover:ring-indigo-400 transition-all" aria-label="Account: ${esc(name)}" title="${esc(this._syncLabel())}">
                    <span class="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-black text-sm">${p.avatar_emoji ? esc(p.avatar_emoji) : esc(name[0].toUpperCase())}</span>
                    <span class="hidden sm:inline text-xs font-bold max-w-[8rem] truncate">${esc(name)}</span>
                    <span class="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-slate-900 ${dot}"></span>
                </button>`;
        },

        _syncLabel() {
            return {
                idle: `Synced ${ago(state.lastSync)}`,
                syncing: 'Syncing…',
                offline: 'Offline — changes are saved in this browser and will sync when you\'re back online',
                error: 'Sync problem: ' + this._syncError,
                signedout: 'Your session expired — sign in again to keep syncing'
            }[this._syncStatus] || '';
        },

        openAccount() {
            if (!this.account) { location.href = loginUrl(); return; }
            const p = this.profile || {};
            const name = p.display_name || '';
            const providerLabel = { email: 'Email & password', google: 'Google', github: 'GitHub', apple: 'Apple', azure: 'Microsoft' }[this.account.provider] || this.account.provider;
            const bytes = localKeys().reduce((n, k) => n + (ls.getItem(k) || '').length, 0);
            this.lifeModal('Your account', `
                <div class="flex items-center gap-4 mb-5">
                    <button id="acct-avatar" class="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-3xl text-white font-black hover:scale-105 transition-transform" title="Change avatar">${p.avatar_emoji ? esc(p.avatar_emoji) : esc((name || this.account.email)[0].toUpperCase())}</button>
                    <div class="min-w-0">
                        <div class="font-black text-lg truncate">${esc(name || this.account.email)}</div>
                        <div class="text-sm text-slate-500 truncate">${esc(this.account.email)}</div>
                        <div class="text-[11px] text-slate-400">Signed in with ${esc(providerLabel)}</div>
                    </div>
                </div>
                ${this._field('Display name', `<input id="acct-name" maxlength="60" class="${this._inputCls}" value="${esc(name)}">`)}
                <div class="glass rounded-2xl p-4 mb-4">
                    <div class="flex items-center justify-between gap-3">
                        <div>
                            <div class="font-bold text-sm">☁️ My Desk</div>
                            <div id="acct-sync" class="text-xs text-slate-500">${esc(this._syncLabel())} · ${bytes < 1024 ? '<1' : Math.round(bytes / 1024)} KB</div>
                        </div>
                        <button id="acct-sync-now" class="${this._ghostBtnCls} text-sm">Sync now</button>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-2 mb-4">
                    <button id="acct-export" class="${this._ghostBtnCls} text-sm">Download my data</button>
                    ${this.account.provider === 'email' ? `<a href="${loginUrl('mode=update')}" class="${this._ghostBtnCls} text-sm text-center">Change password</a>` : '<span></span>'}
                </div>
                <div class="flex justify-between items-center gap-2 pt-4 border-t border-slate-200/60 dark:border-slate-700/60">
                    <button id="acct-delete" class="text-red-500 font-bold text-sm">Delete account</button>
                    <div class="flex gap-2">
                        <button id="acct-signout" class="${this._ghostBtnCls} text-sm">Sign out</button>
                        <button id="acct-save" class="${this._btnCls} text-sm">Save</button>
                    </div>
                </div>`, wrap => {
                let avatar = p.avatar_emoji || '';
                wrap.querySelector('#acct-avatar').onclick = e => {
                    avatar = AVATARS[(AVATARS.indexOf(avatar) + 1) % AVATARS.length];
                    e.currentTarget.textContent = avatar;
                };
                wrap.querySelector('#acct-save').onclick = () => this.saveProfile(wrap.querySelector('#acct-name').value.trim().slice(0, 60), avatar);
                wrap.querySelector('#acct-sync-now').onclick = async () => {
                    wrap.querySelector('#acct-sync').textContent = 'Syncing…';
                    await this.sync();
                    const el = wrap.querySelector('#acct-sync');
                    if (el) el.textContent = this._syncLabel();
                };
                wrap.querySelector('#acct-export').onclick = () => this.exportDesk();
                wrap.querySelector('#acct-signout').onclick = () => this.signOut();
                wrap.querySelector('#acct-delete').onclick = () => this.confirmDeleteAccount();
            });
        },

        async saveProfile(display_name, avatar_emoji) {
            try {
                const sb = await this._supabase();
                const { error } = await sb.from('profiles').upsert({ id: this.account.id, display_name: display_name || null, avatar_emoji: avatar_emoji || null });
                if (error) throw error;
                this.profile = { display_name, avatar_emoji };
                this.closeLifeModal();
                this.renderAccountButton();
                this.showToast('Profile saved');
            } catch (e) {
                this.showToast('Couldn\'t save profile: ' + e.message);
            }
        },

        exportDesk() {
            const data = {};
            localKeys().forEach(k => { data[k] = ls.getItem(k); });
            const blob = new Blob([JSON.stringify({
                app: 'webdesks-desk', exported: new Date().toISOString(),
                account: { id: this.account?.id, email: this.account?.email, profile: this.profile },
                data
            }, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `webdesks-desk-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 1000);
            this.showToast('Your Desk was downloaded');
        },

        async signOut(to) {
            this._leaving = true;
            await this.flushSync();
            if (this._syncStatus !== 'idle' && !confirm('Your latest changes couldn\'t be saved to your account. Sign out anyway and lose them?')) { this._leaving = false; return; }
            frozen = true;
            try {
                const sb = await this._supabase();
                await sb.auth.signOut({ scope: 'local' });
            } catch (e) { /* offline — the local session is removed below regardless */ }
            rawRemove.call(ls, AUTH_KEY);
            clearLocalDesk();
            location.href = to || '/?signedout';
        },

        confirmDeleteAccount() {
            this.lifeModal('Delete your account?', `
                <p class="text-sm text-slate-500 mb-3">This permanently deletes your account, your profile and your cloud Desk. It can't be undone. Download your data first if you want a copy.</p>
                ${this._field('Type DELETE to confirm', `<input id="del-confirm" class="${this._inputCls}" autocomplete="off">`)}
                <div class="flex justify-end gap-2 mt-2">
                    <button onclick="app.closeLifeModal()" class="${this._ghostBtnCls}">Cancel</button>
                    <button id="del-go" class="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl font-bold disabled:opacity-40" disabled>Delete forever</button>
                </div>`, wrap => {
                const input = wrap.querySelector('#del-confirm');
                const go = wrap.querySelector('#del-go');
                input.oninput = () => { go.disabled = input.value.trim() !== 'DELETE'; };
                go.onclick = async () => {
                    go.disabled = true;
                    go.textContent = 'Deleting…';
                    try {
                        const sb = await this._supabase();
                        const { error } = await sb.rpc('delete_my_account');
                        if (error) throw error;
                        frozen = true;
                        await sb.auth.signOut({ scope: 'local' }).catch(() => {});
                        rawRemove.call(ls, AUTH_KEY);
                        clearLocalDesk();
                        location.href = '/?deleted';
                    } catch (e) {
                        go.disabled = false;
                        go.textContent = 'Delete forever';
                        this.showToast('Couldn\'t delete the account: ' + e.message);
                    }
                };
            });
        }
    });
})();

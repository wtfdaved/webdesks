// ═══════════════════════════════════════════════════════════════
// MINI TOOLS — working WebDesks tools embedded at the top of blog posts.
//
//   <div class="wd-mini" data-tool="pomodoro"></div>
//   <script src="/embed/mini-tools.js" defer></script>
//
// Tools: pomodoro, todo (data-target="board" saves to the Kanban board),
// notepad, worldclock, status, breathing, noise, color, stopwatch,
// calculator, converter, alarm.
//
// "Save to My WebDesk" writes what the reader made into the same
// localStorage keys the app uses (same origin), stamps them for Desk sync
// so a signed-in member's cloud copy picks them up, then offers a free
// account (Supabase sign-up) or opens the tool. No dependencies.
// ═══════════════════════════════════════════════════════════════
(function () {
    'use strict';
    var ls = window.localStorage;
    var member = false;
    try { member = !!ls.getItem('sb-webdesks-auth'); } catch (e) {}

    function readJSON(k, fb) { try { var v = JSON.parse(ls.getItem(k)); return v == null ? fb : v; } catch (e) { return fb; } }
    // Write like the app does: value + a Desk-sync timestamp so it wins the next sync.
    function put(k, v) {
        try {
            ls.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
            var meta = readJSON('wd_sync_meta', {});
            meta[k] = Date.now();
            ls.setItem('wd_sync_meta', JSON.stringify(meta));
        } catch (e) {}
    }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function el(html) { var d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }
    function pad(n) { return String(n).padStart(2, '0'); }
    function mmss(s) { s = Math.max(0, Math.round(s)); return pad(Math.floor(s / 60)) + ':' + pad(s % 60); }
    var actx = null;
    function audio() { if (!actx) { var C = window.AudioContext || window.webkitAudioContext; if (C) actx = new C(); } if (actx && actx.state === 'suspended') actx.resume(); return actx; }
    function chime() {
        var c = audio(); if (!c) return;
        [0, 0.25, 0.5].forEach(function (t, i) {
            var o = c.createOscillator(), g = c.createGain();
            o.frequency.value = [660, 880, 990][i]; o.type = 'sine';
            g.gain.setValueAtTime(0.0001, c.currentTime + t); g.gain.exponentialRampToValueAtTime(0.25, c.currentTime + t + 0.02);
            g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + t + 0.6);
            o.connect(g).connect(c.destination); o.start(c.currentTime + t); o.stop(c.currentTime + t + 0.65);
        });
    }

    // ── Tool definitions ─────────────────────────────────────────
    // Each: { title, slug (/tools/<slug>), kind (?saved=), render(body, api) }
    // api.setSave(fn) — fn() returns a short "what was saved" string, or '' if nothing to save.
    var TOOLS = {
        pomodoro: {
            title: 'Pomodoro timer', slug: 'pomodoro-timer', kind: 'timer',
            render: function (b, api) {
                var mode = 25, left = 25 * 60, timer = null, done = 0, focusedSec = 0;
                b.innerHTML = '<div class="wdm-modes">' + [25, 45, 5].map(function (m) { return '<button data-m="' + m + '" class="' + (m === 25 ? 'on' : '') + '">' + (m === 5 ? '5m break' : m + 'm') + '</button>'; }).join('') + '</div>' +
                    '<div class="wdm-big" aria-live="polite">25:00</div><div class="wdm-row"><button class="wdm-primary" data-a="go">Start</button><button data-a="reset">Reset</button></div><div class="wdm-note"></div>';
                var big = b.querySelector('.wdm-big'), go = b.querySelector('[data-a=go]'), note = b.querySelector('.wdm-note');
                function draw() { big.textContent = mmss(left); go.textContent = timer ? 'Pause' : (left < mode * 60 ? 'Resume' : 'Start'); }
                function stop() { clearInterval(timer); timer = null; draw(); }
                b.querySelector('.wdm-modes').onclick = function (e) {
                    var m = e.target.getAttribute('data-m'); if (!m) return;
                    stop(); mode = +m; left = mode * 60; draw();
                    [].forEach.call(b.querySelectorAll('.wdm-modes button'), function (x) { x.classList.toggle('on', x === e.target); });
                };
                go.onclick = function () {
                    audio();
                    if (timer) return stop();
                    var last = Date.now();
                    timer = setInterval(function () {
                        var now = Date.now(), dt = (now - last) / 1000; last = now;
                        left -= dt; if (mode !== 5) focusedSec += dt;
                        if (left <= 0) { stop(); left = 0; chime(); if (mode !== 5) { done++; note.textContent = '🍅 ' + done + ' Pomodoro' + (done > 1 ? 's' : '') + ' done — save it to your streak!'; } left = mode * 60; }
                        draw();
                    }, 250);
                    draw();
                };
                b.querySelector('[data-a=reset]').onclick = function () { stop(); left = mode * 60; draw(); };
                api.setSave(function () {
                    var mins = Math.floor(focusedSec / 60);
                    if (!mins && !done) return '';
                    put('wd_sessions', String((parseInt(ls.getItem('wd_sessions') || '0', 10) || 0) + done));
                    put('wd_total_min', String((parseInt(ls.getItem('wd_total_min') || '0', 10) || 0) + mins));
                    return mins + ' focused minute' + (mins === 1 ? '' : 's') + (done ? ' and ' + done + ' Pomodoro' + (done > 1 ? 's' : '') : '');
                });
            }
        },

        todo: {
            title: 'To-do list', slug: 'todo-list', kind: 'tasks',
            render: function (b, api, host) {
                var board = host.getAttribute('data-target') === 'board';
                if (board) { api.meta.title = 'Kanban board'; api.meta.slug = 'kanban-board'; }
                var items = [];
                b.innerHTML = '<form class="wdm-add"><input maxlength="120" placeholder="' + (board ? 'Add a card…' : 'Add a task, e.g. “email the client”') + '" aria-label="New item"><button class="wdm-primary">Add</button></form><ul class="wdm-list"></ul>';
                var list = b.querySelector('.wdm-list'), input = b.querySelector('input');
                function draw() {
                    list.innerHTML = items.length ? items.map(function (t, i) {
                        return '<li class="' + (t.done ? 'done' : '') + '"><label><input type="checkbox" data-i="' + i + '"' + (t.done ? ' checked' : '') + '> <span>' + esc(t.text) + '</span></label><button data-x="' + i + '" aria-label="Remove">×</button></li>';
                    }).join('') : '<li class="wdm-empty">Add your first ' + (board ? 'card' : 'task') + ' ↑</li>';
                }
                b.querySelector('form').onsubmit = function (e) { e.preventDefault(); var v = input.value.trim(); if (v) { items.push({ text: v, done: false }); input.value = ''; draw(); } };
                list.onclick = function (e) {
                    var i = e.target.getAttribute('data-i'), x = e.target.getAttribute('data-x');
                    if (i !== null) { items[i].done = e.target.checked; draw(); }
                    if (x !== null) { items.splice(+x, 1); draw(); }
                };
                draw();
                api.setSave(function () {
                    var open = items.filter(function (t) { return !t.done; });
                    if (!items.length) return '';
                    if (board) {
                        var data = readJSON('wd_board', { todo: [], doing: [], done: [] });
                        data.todo = (data.todo || []).concat(open.map(function (t) { return t.text; }));
                        data.done = (data.done || []).concat(items.filter(function (t) { return t.done; }).map(function (t) { return t.text; }));
                        put('wd_board', data);
                        return items.length + ' card' + (items.length > 1 ? 's' : '');
                    }
                    var tasks = readJSON('wd_tasks', []), id = Date.now();
                    if (!Array.isArray(tasks)) tasks = [];
                    items.forEach(function (t) { tasks.push({ text: t.text, time: '', date: '', done: t.done, id: id++ }); });
                    put('wd_tasks', tasks);
                    return items.length + ' task' + (items.length > 1 ? 's' : '');
                });
            }
        },

        notepad: {
            title: 'Notepad', slug: 'notepad', kind: 'notes',
            render: function (b, api) {
                b.innerHTML = '<textarea class="wdm-text" rows="6" placeholder="Start typing — Markdown works (# heading, - list, **bold**)" aria-label="Note"></textarea><div class="wdm-note"><span class="wdm-count">0 words</span></div>';
                var t = b.querySelector('textarea'), c = b.querySelector('.wdm-count');
                t.oninput = function () { var n = (t.value.trim().match(/\S+/g) || []).length; c.textContent = n + ' word' + (n === 1 ? '' : 's'); };
                api.setSave(function () {
                    var v = t.value.trim(); if (!v) return '';
                    var cur = ls.getItem('wd_scratch') || '';
                    put('wd_scratch', cur ? cur.replace(/\s+$/, '') + '\n\n---\n\n' + v : v);
                    return 'your note';
                });
            }
        },

        worldclock: {
            title: 'World clock', slug: 'world-clock', kind: 'zones',
            render: function (b, api) {
                var ALL = [['New York', 'America/New_York', '🇺🇸'], ['San Francisco', 'America/Los_Angeles', '🇺🇸'], ['Chicago', 'America/Chicago', '🇺🇸'], ['Toronto', 'America/Toronto', '🇨🇦'], ['São Paulo', 'America/Sao_Paulo', '🇧🇷'], ['London', 'Europe/London', '🇬🇧'], ['Berlin', 'Europe/Berlin', '🇩🇪'], ['Paris', 'Europe/Paris', '🇫🇷'], ['Lagos', 'Africa/Lagos', '🇳🇬'], ['Dubai', 'Asia/Dubai', '🇦🇪'], ['Mumbai', 'Asia/Kolkata', '🇮🇳'], ['Singapore', 'Asia/Singapore', '🇸🇬'], ['Manila', 'Asia/Manila', '🇵🇭'], ['Tokyo', 'Asia/Tokyo', '🇯🇵'], ['Sydney', 'Australia/Sydney', '🇦🇺'], ['Auckland', 'Pacific/Auckland', '🇳🇿']];
                var picked = ['America/New_York', 'Europe/London', 'Asia/Kolkata'];
                b.innerHTML = '<div class="wdm-zones"></div><div class="wdm-row"><select aria-label="Add a city"><option value="">+ Add a city</option>' + ALL.map(function (c) { return '<option value="' + c[1] + '">' + c[2] + ' ' + c[0] + '</option>'; }).join('') + '</select></div>';
                var box = b.querySelector('.wdm-zones'), sel = b.querySelector('select');
                function hour(z) { return +new Intl.DateTimeFormat('en-US', { timeZone: z, hour: 'numeric', hourCycle: 'h23' }).format(new Date()); }
                function draw() {
                    var rows = [['Your time', null, '📍']].concat(picked.map(function (z) { return ALL.filter(function (c) { return c[1] === z; })[0]; }));
                    box.innerHTML = rows.map(function (c) {
                        var opt = { hour: 'numeric', minute: '2-digit' }; if (c[1]) opt.timeZone = c[1];
                        var h = c[1] ? hour(c[1]) : new Date().getHours();
                        var work = h >= 9 && h < 18;
                        return '<div class="wdm-zone"><span>' + c[2] + ' ' + esc(c[0]) + '</span><b>' + new Date().toLocaleTimeString([], opt) + '</b><em class="' + (work ? 'in' : 'out') + '">' + (work ? 'working hours' : h < 9 && h >= 6 ? 'early' : 'off hours') + '</em>' + (c[1] ? '<button data-z="' + c[1] + '" aria-label="Remove">×</button>' : '') + '</div>';
                    }).join('');
                }
                sel.onchange = function () { if (sel.value && picked.indexOf(sel.value) < 0) picked.push(sel.value); sel.value = ''; draw(); };
                box.onclick = function (e) { var z = e.target.getAttribute('data-z'); if (z) { picked = picked.filter(function (x) { return x !== z; }); draw(); } };
                draw(); setInterval(draw, 30000);
                api.setSave(function () {
                    if (!picked.length) return '';
                    var zones = readJSON('webdesks_zones', null);
                    if (!Array.isArray(zones)) zones = [{ label: 'Local', zone: null, flag: '📍' }];
                    picked.forEach(function (z) {
                        if (zones.some(function (x) { return x.zone === z; })) return;
                        var c = ALL.filter(function (x) { return x[1] === z; })[0];
                        zones.push({ label: c[0], zone: c[1], flag: c[2] });
                    });
                    put('webdesks_zones', zones);
                    return picked.length + ' cit' + (picked.length > 1 ? 'ies' : 'y');
                });
            }
        },

        status: {
            title: 'On Air sign', slug: 'on-air-sign', kind: 'status',
            render: function (b, api) {
                var S = { busy: ['🔴', 'On a call', '#dc2626'], focus: ['🎧', 'Deep focus', '#4f46e5'], free: ['🟢', 'Come on in', '#16a34a'] };
                b.innerHTML = '<div class="wdm-modes">' + Object.keys(S).map(function (k, i) { return '<button data-s="' + k + '" class="' + (i ? '' : 'on') + '">' + S[k][0] + ' ' + S[k][1] + '</button>'; }).join('') + '</div><div class="wdm-sign" role="status"></div><div class="wdm-row"><button data-a="full">⛶ Full screen</button></div>';
                var sign = b.querySelector('.wdm-sign');
                function show(k) { sign.style.background = S[k][2]; sign.innerHTML = '<span>' + S[k][0] + '</span>' + esc(S[k][1]); [].forEach.call(b.querySelectorAll('[data-s]'), function (x) { x.classList.toggle('on', x.getAttribute('data-s') === k); }); }
                b.querySelector('.wdm-modes').onclick = function (e) { var k = e.target.getAttribute('data-s'); if (k) show(k); };
                b.querySelector('[data-a=full]').onclick = function () { if (sign.requestFullscreen) sign.requestFullscreen(); };
                show('busy');
                api.setSave(null);
            }
        },

        breathing: {
            title: 'Box breathing guide', slug: 'breathing-exercise', kind: 'breathing',
            render: function (b, api) {
                b.innerHTML = '<div class="wdm-breath"><div class="wdm-orb"></div><div class="wdm-phase">Ready</div></div><div class="wdm-row"><button class="wdm-primary" data-a="go">Start</button></div><div class="wdm-note">Inhale 4 · hold 4 · exhale 4 · hold 4</div>';
                var orb = b.querySelector('.wdm-orb'), ph = b.querySelector('.wdm-phase'), go = b.querySelector('[data-a=go]'), t = null, cycles = 0;
                var P = [['Breathe in', 1.35], ['Hold', 1.35], ['Breathe out', 0.75], ['Hold', 0.75]];
                function step(i) { ph.textContent = P[i][0]; orb.style.transform = 'scale(' + P[i][1] + ')'; if (i === 3) cycles++; t = setTimeout(function () { step((i + 1) % 4); }, 4000); }
                go.onclick = function () { if (t) { clearTimeout(t); t = null; go.textContent = 'Start'; ph.textContent = cycles ? cycles + ' rounds — nice' : 'Ready'; orb.style.transform = 'scale(.75)'; } else { go.textContent = 'Stop'; step(0); } };
                api.setSave(null);
            }
        },

        noise: {
            title: 'Noise generator', slug: 'ambient-sounds', kind: 'sounds',
            render: function (b, api) {
                var kind = 'pink', vol = 0.5, src = null, gain = null;
                b.innerHTML = '<div class="wdm-modes">' + ['white', 'pink', 'brown'].map(function (k) { return '<button data-k="' + k + '" class="' + (k === kind ? 'on' : '') + '">' + k[0].toUpperCase() + k.slice(1) + '</button>'; }).join('') + '</div><div class="wdm-row"><button class="wdm-primary" data-a="go">▶ Play</button><input type="range" min="0" max="1" step="0.01" value="0.5" aria-label="Volume"></div><div class="wdm-note">Pink noise is softer than white; brown is deep, like a waterfall.</div>';
                var go = b.querySelector('[data-a=go]');
                function buffer(c, k) {
                    var n = c.sampleRate * 4, buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0), b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
                    for (var i = 0; i < n; i++) {
                        var w = Math.random() * 2 - 1;
                        if (k === 'white') d[i] = w * 0.5;
                        else if (k === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
                        else { b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898; d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926; }
                    }
                    return buf;
                }
                function stop() { if (src) { try { src.stop(); } catch (e) {} src = null; } go.textContent = '▶ Play'; }
                function play() {
                    var c = audio(); if (!c) return;
                    stop(); gain = c.createGain(); gain.gain.value = vol * 0.6; gain.connect(c.destination);
                    src = c.createBufferSource(); src.buffer = buffer(c, kind); src.loop = true; src.connect(gain); src.start(); go.textContent = '❚❚ Pause';
                }
                go.onclick = function () { src ? stop() : play(); };
                b.querySelector('input').oninput = function (e) { vol = +e.target.value; if (gain) gain.gain.value = vol * 0.6; };
                b.querySelector('.wdm-modes').onclick = function (e) {
                    var k = e.target.getAttribute('data-k'); if (!k) return; kind = k;
                    [].forEach.call(b.querySelectorAll('[data-k]'), function (x) { x.classList.toggle('on', x === e.target); });
                    if (src) play();
                };
                api.setSave(function () {
                    var mixes = readJSON('wd_mixes', []); if (!Array.isArray(mixes)) mixes = [];
                    var name = kind[0].toUpperCase() + kind.slice(1) + ' noise';
                    var mix = {}; mix[kind] = Math.round(vol * 100) / 100 || 0.4;
                    mixes = [{ id: 'm' + Date.now().toString(36), name: name, mix: mix }].concat(mixes.filter(function (m) { return m.name !== name; })).slice(0, 12);
                    put('wd_mixes', mixes);
                    return 'a “' + name + '” mix';
                });
            }
        },

        color: {
            title: 'Colour picker', slug: 'color-picker', kind: 'color',
            render: function (b, api) {
                var saved = [];
                b.innerHTML = '<div class="wdm-color"><input type="color" value="#4f46e5" aria-label="Pick a colour"><div class="wdm-vals"></div></div><div class="wdm-row"><button data-a="keep">+ Keep this colour</button></div><div class="wdm-swatches"></div>';
                var inp = b.querySelector('input'), vals = b.querySelector('.wdm-vals'), sw = b.querySelector('.wdm-swatches');
                function hsl(hex) {
                    var r = parseInt(hex.substr(1, 2), 16) / 255, g = parseInt(hex.substr(3, 2), 16) / 255, bl = parseInt(hex.substr(5, 2), 16) / 255;
                    var mx = Math.max(r, g, bl), mn = Math.min(r, g, bl), h = 0, s = 0, l = (mx + mn) / 2, d = mx - mn;
                    if (d) { s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - bl) / d + (g < bl ? 6 : 0) : mx === g ? (bl - r) / d + 2 : (r - g) / d + 4; h *= 60; }
                    return { rgb: 'rgb(' + Math.round(r * 255) + ', ' + Math.round(g * 255) + ', ' + Math.round(bl * 255) + ')', hsl: 'hsl(' + Math.round(h) + ', ' + Math.round(s * 100) + '%, ' + Math.round(l * 100) + '%)' };
                }
                function draw() {
                    var v = inp.value, x = hsl(v);
                    vals.innerHTML = [v.toUpperCase(), x.rgb, x.hsl].map(function (t) { return '<button class="wdm-copy" data-c="' + t + '">' + t + '</button>'; }).join('');
                    sw.innerHTML = saved.map(function (h) { return '<span style="background:' + h + '" title="' + h + '"></span>'; }).join('');
                }
                inp.oninput = draw;
                vals.onclick = function (e) { var c = e.target.getAttribute('data-c'); if (c && navigator.clipboard) navigator.clipboard.writeText(c).then(function () { e.target.textContent = 'Copied!'; setTimeout(draw, 900); }); };
                b.querySelector('[data-a=keep]').onclick = function () { if (saved.indexOf(inp.value) < 0) saved.push(inp.value); draw(); };
                draw();
                api.setSave(function () {
                    var list = saved.length ? saved : [inp.value];
                    var cur = readJSON('wd_color_swatches', []); if (!Array.isArray(cur)) cur = [];
                    list.forEach(function (h) { if (cur.indexOf(h) < 0) cur.push(h); });
                    put('wd_color_swatches', cur);
                    return list.length + ' colour' + (list.length > 1 ? 's' : '');
                });
            }
        },

        stopwatch: {
            title: 'Stopwatch', slug: 'stopwatch', kind: 'stopwatch',
            render: function (b, api) {
                var start = 0, acc = 0, t = null, laps = [];
                b.innerHTML = '<div class="wdm-big">00:00.0</div><div class="wdm-row"><button class="wdm-primary" data-a="go">Start</button><button data-a="lap">Lap</button><button data-a="reset">Reset</button></div><ol class="wdm-laps"></ol>';
                var big = b.querySelector('.wdm-big'), go = b.querySelector('[data-a=go]'), lapsEl = b.querySelector('.wdm-laps');
                function el2() { return acc + (t ? Date.now() - start : 0); }
                function fmt(ms) { return mmss(Math.floor(ms / 1000)).replace(/^00:/, '00:') + '.' + Math.floor(ms % 1000 / 100); }
                function draw() { big.textContent = fmt(el2()); }
                go.onclick = function () { if (t) { acc = el2(); clearInterval(t); t = null; go.textContent = 'Resume'; } else { start = Date.now(); t = setInterval(draw, 100); go.textContent = 'Pause'; } };
                b.querySelector('[data-a=lap]').onclick = function () { if (!el2()) return; laps.unshift(el2()); lapsEl.innerHTML = laps.map(function (l, i) { return '<li>Lap ' + (laps.length - i) + ' · ' + fmt(l) + '</li>'; }).join(''); };
                b.querySelector('[data-a=reset]').onclick = function () { clearInterval(t); t = null; acc = 0; laps = []; lapsEl.innerHTML = ''; go.textContent = 'Start'; draw(); };
                api.setSave(null);
            }
        },

        calculator: {
            title: 'Calculator', slug: 'calculator', kind: 'calculator',
            render: function (b, api) {
                var keys = ['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', '0', '.', '=', '+'];
                b.innerHTML = '<input class="wdm-display" value="0" aria-label="Expression"><div class="wdm-keys">' + keys.map(function (k) { return '<button data-k="' + k + '" class="' + (/[÷×−+=]/.test(k) ? 'op' : '') + '">' + k + '</button>'; }).join('') + '<button data-k="C" class="wide">Clear</button></div>';
                var d = b.querySelector('.wdm-display');
                function calc() {
                    var expr = d.value.replace(/÷/g, '/').replace(/×/g, '*').replace(/−/g, '-');
                    if (!/^[\d+\-*/.() %]+$/.test(expr)) { d.value = 'Error'; return; }
                    try { var r = Function('"use strict";return (' + expr + ')')(); d.value = isFinite(r) ? String(Math.round(r * 1e10) / 1e10) : 'Error'; } catch (e) { d.value = 'Error'; }
                }
                b.querySelector('.wdm-keys').onclick = function (e) {
                    var k = e.target.getAttribute('data-k'); if (!k) return;
                    if (k === 'C') d.value = '0'; else if (k === '=') calc(); else d.value = (d.value === '0' || d.value === 'Error') && /[\d.]/.test(k) ? k : d.value + k;
                };
                d.onkeydown = function (e) { if (e.key === 'Enter') calc(); };
                api.setSave(null);
            }
        },

        converter: {
            title: 'Unit converter', slug: 'unit-converter', kind: 'converter',
            render: function (b, api) {
                var U = {
                    Length: { m: 1, km: 1000, cm: 0.01, mm: 0.001, mi: 1609.344, yd: 0.9144, ft: 0.3048, 'in': 0.0254 },
                    Weight: { kg: 1, g: 0.001, lb: 0.45359237, oz: 0.028349523, st: 6.35029318 },
                    Temperature: { '°C': 'c', '°F': 'f', K: 'k' },
                    Volume: { L: 1, mL: 0.001, 'US gal': 3.785411784, 'US cup': 0.2365882365, 'fl oz': 0.0295735296 }
                };
                b.innerHTML = '<div class="wdm-modes">' + Object.keys(U).map(function (k, i) { return '<button data-c="' + k + '" class="' + (i ? '' : 'on') + '">' + k + '</button>'; }).join('') + '</div><div class="wdm-conv"><input type="number" value="1" aria-label="Value"><select aria-label="From"></select><span>=</span><output></output><select aria-label="To"></select></div>';
                var cat = 'Length', inp = b.querySelector('input'), sels = b.querySelectorAll('select'), out = b.querySelector('output');
                function temp(v, f, t) { var c = f === 'c' ? v : f === 'f' ? (v - 32) * 5 / 9 : v - 273.15; return t === 'c' ? c : t === 'f' ? c * 9 / 5 + 32 : c + 273.15; }
                function fill() { var ks = Object.keys(U[cat]); [0, 1].forEach(function (i) { sels[i].innerHTML = ks.map(function (k) { return '<option>' + k + '</option>'; }).join(''); }); sels[1].selectedIndex = 1; run(); }
                function run() {
                    var v = parseFloat(inp.value) || 0, f = U[cat][sels[0].value], t = U[cat][sels[1].value];
                    var r = cat === 'Temperature' ? temp(v, f, t) : v * f / t;
                    out.textContent = (Math.round(r * 10000) / 10000).toLocaleString();
                }
                b.querySelector('.wdm-modes').onclick = function (e) { var c = e.target.getAttribute('data-c'); if (!c) return; cat = c; [].forEach.call(b.querySelectorAll('[data-c]'), function (x) { x.classList.toggle('on', x === e.target); }); fill(); };
                inp.oninput = run; sels[0].onchange = run; sels[1].onchange = run;
                fill();
                api.setSave(null);
            }
        },

        alarm: {
            title: 'Alarm clock', slug: 'alarm-clock', kind: 'alarm',
            render: function (b, api) {
                var at = null, iv = null;
                b.innerHTML = '<div class="wdm-big wdm-now"></div><div class="wdm-row"><input type="time" aria-label="Alarm time"><button class="wdm-primary" data-a="set">Set alarm</button></div><div class="wdm-note">Keep this tab open — it rings with a chime.</div>';
                var now = b.querySelector('.wdm-now'), t = b.querySelector('input'), note = b.querySelector('.wdm-note');
                var d0 = new Date(Date.now() + 30 * 60000); t.value = pad(d0.getHours()) + ':' + pad(d0.getMinutes());
                function tick() {
                    var d = new Date(); now.textContent = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
                    if (at && pad(d.getHours()) + ':' + pad(d.getMinutes()) === at) { at = null; chime(); setTimeout(chime, 1200); note.textContent = '⏰ Ring ring! Alarm done.'; }
                }
                b.querySelector('[data-a=set]').onclick = function () { audio(); at = t.value; note.textContent = at ? 'Alarm set for ' + at + ' — keep this tab open.' : ''; };
                tick(); iv = setInterval(tick, 1000);
                api.setSave(function () { var v = at || t.value; if (!/^\d\d:\d\d$/.test(v)) return ''; put('wd_alarm', v); return 'your ' + v + ' alarm'; });
            }
        }
    };

    // ── Shell: card, CTA, sign-up prompt ─────────────────────────
    function mount(host) {
        var key = host.getAttribute('data-tool'), tool = TOOLS[key];
        if (!tool || host.getAttribute('data-ready')) return;
        host.setAttribute('data-ready', '1');
        var save = null, meta = { title: tool.title, slug: tool.slug };
        var card = el('<section class="wdm-card" aria-label="Try it: ' + esc(tool.title) + '">' +
            '<div class="wdm-head"><span class="wdm-badge">▶ Try it here</span><span class="wdm-title"></span></div>' +
            '<div class="wdm-body"></div>' +
            '<div class="wdm-foot"><button class="wdm-save">💾 Save to My WebDesk</button><span class="wdm-free">Free · works right here, no sign-up to try</span></div>' +
            '<div class="wdm-after" hidden></div></section>');
        host.appendChild(card);
        var body = card.querySelector('.wdm-body');
        tool.render(body, { setSave: function (fn) { save = fn; }, meta: meta }, host);
        card.querySelector('.wdm-title').textContent = 'WebDesks ' + meta.title;
        card.setAttribute('aria-label', 'Try it: ' + meta.title);
        var btn = card.querySelector('.wdm-save'), after = card.querySelector('.wdm-after');
        if (!save) btn.textContent = '↗ Open in My WebDesk';
        btn.onclick = function () {
            var what = save ? save() : '';
            var dest = '/tools/' + meta.slug + (what ? '?saved=' + tool.kind : '');
            if (save && !what) { after.hidden = false; after.innerHTML = '<p>Add something first — then save it to your Desk.</p>'; return; }
            if (member) { location.href = dest; return; }
            after.hidden = false;
            after.innerHTML = (what ? '<p class="wdm-ok">✓ Saved ' + esc(what) + ' on this device.</p>' : '') +
                '<p><b>Keep it on every device</b> — create a free WebDesks account. Your Desk syncs to your phone and laptop, and members browse ad-free.</p>' +
                '<div class="wdm-row"><a class="wdm-primary" href="/login?mode=signup&amp;next=' + encodeURIComponent(dest) + '">Create free account</a><a href="' + dest + '">Open WebDesk without signing up</a></div>';
            after.querySelector('a').focus();
        };
    }

    var css = document.createElement('style');
    css.textContent = [
        '.wd-mini{margin:.5rem 0 2rem}',
        '.wdm-card p{margin:.2rem 0 .4rem;line-height:1.5;font-size:.9rem;color:inherit}.wdm-card .wdm-list li{list-style:none;margin:0;font-size:.95rem;line-height:1.5}.wdm-card .wdm-list,.wdm-card .wdm-laps{margin-bottom:0}.wdm-card .wdm-list{padding-left:0}',
        '.wdm-card{font-family:Inter,system-ui,sans-serif;background:#fff;border:1px solid #e0e7ff;border-radius:1.4rem;box-shadow:0 18px 40px -24px rgba(79,70,229,.45);overflow:hidden;color:#0f172a;text-align:left}',
        '.wdm-head{display:flex;align-items:center;gap:.6rem;padding:.8rem 1.1rem;background:linear-gradient(135deg,#4338ca,#7c3aed);color:#fff}',
        '.wdm-badge{font-size:.68rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;background:rgba(255,255,255,.18);padding:.2rem .55rem;border-radius:999px}',
        '.wdm-title{font-weight:800}',
        '.wdm-body{padding:1.1rem}',
        '.wdm-card button,.wdm-card select,.wdm-card input{font:inherit}',
        '.wdm-card button,.wdm-card a.wdm-btn{cursor:pointer;border:1px solid #e2e8f0;background:#f8fafc;color:#0f172a;border-radius:.8rem;padding:.5rem .9rem;font-weight:700;font-size:.88rem}',
        '.wdm-card button:hover{border-color:#6366f1}',
        '.wdm-card .wdm-primary{background:#4f46e5;border-color:#4f46e5;color:#fff;text-decoration:none;display:inline-block;border-radius:.8rem;padding:.55rem 1rem;font-weight:800}',
        '.wdm-row{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;margin-top:.75rem}',
        '.wdm-modes{display:flex;flex-wrap:wrap;gap:.4rem;margin-bottom:.6rem}',
        '.wdm-modes button.on{background:#eef2ff;border-color:#6366f1;color:#4338ca}',
        '.wdm-big{font-size:3.2rem;font-weight:900;letter-spacing:-.02em;font-variant-numeric:tabular-nums;color:#4338ca;line-height:1.1}',
        '.wdm-note{font-size:.82rem;color:#64748b;margin-top:.5rem;min-height:1em}',
        '.wdm-add{display:flex;gap:.5rem}.wdm-add input{flex:1;min-width:0;border:1px solid #e2e8f0;border-radius:.8rem;padding:.55rem .8rem}',
        '.wdm-list{list-style:none;padding:0;margin:.75rem 0 0;display:grid;gap:.3rem}.wdm-list li{display:flex;justify-content:space-between;align-items:center;padding:.45rem .6rem;border-radius:.7rem;background:#f8fafc}',
        '.wdm-list li.done span{text-decoration:line-through;color:#94a3b8}.wdm-list li button{border:0;background:none;padding:0 .3rem;color:#94a3b8}.wdm-empty{color:#94a3b8;font-size:.85rem}',
        '.wdm-text{width:100%;box-sizing:border-box;border:1px solid #e2e8f0;border-radius:.9rem;padding:.75rem;resize:vertical;font:inherit}',
        '.wdm-zones{display:grid;gap:.35rem}.wdm-zone{display:grid;grid-template-columns:1fr auto auto auto;gap:.6rem;align-items:center;padding:.5rem .7rem;border-radius:.8rem;background:#f8fafc}',
        '.wdm-zone b{font-variant-numeric:tabular-nums}.wdm-zone em{font-style:normal;font-size:.7rem;font-weight:700;padding:.1rem .45rem;border-radius:999px}.wdm-zone em.in{background:#dcfce7;color:#166534}.wdm-zone em.out{background:#f1f5f9;color:#64748b}',
        '.wdm-zone button{border:0!important;background:none!important;padding:0 .2rem!important;color:#94a3b8}',
        '.wdm-card select{border:1px solid #e2e8f0;border-radius:.8rem;padding:.5rem;background:#fff}',
        '.wdm-sign{border-radius:1rem;color:#fff;font-weight:900;font-size:1.8rem;text-align:center;padding:1.6rem 1rem;display:flex;flex-direction:column;align-items:center;gap:.3rem}.wdm-sign:fullscreen{justify-content:center;font-size:8vw}',
        '.wdm-breath{display:flex;flex-direction:column;align-items:center;gap:.8rem;padding:1rem}.wdm-orb{width:6rem;height:6rem;border-radius:50%;background:radial-gradient(circle at 35% 35%,#a5b4fc,#4f46e5);transform:scale(.75);transition:transform 4s ease-in-out}.wdm-phase{font-weight:800;font-size:1.1rem}',
        '.wdm-color{display:flex;gap:1rem;align-items:center}.wdm-color input[type=color]{width:5rem;height:5rem;border:0;border-radius:1rem;padding:0;background:none}.wdm-vals{display:grid;gap:.3rem}.wdm-copy{font-family:ui-monospace,monospace!important;font-size:.8rem!important}',
        '.wdm-swatches{display:flex;gap:.35rem;margin-top:.6rem}.wdm-swatches span{width:1.6rem;height:1.6rem;border-radius:.5rem;border:1px solid #e2e8f0}',
        '.wdm-laps{margin:.6rem 0 0;padding-left:1.2rem;font-size:.85rem;color:#475569;max-height:8rem;overflow:auto}',
        '.wdm-display{width:100%;box-sizing:border-box;text-align:right;font-size:1.8rem;font-weight:800;border:1px solid #e2e8f0;border-radius:.9rem;padding:.5rem .8rem;margin-bottom:.6rem}',
        '.wdm-keys{display:grid;grid-template-columns:repeat(4,1fr);gap:.4rem;max-width:20rem}.wdm-keys button{padding:.7rem 0!important;font-size:1.05rem!important}.wdm-keys .op{background:#eef2ff!important;color:#4338ca!important}.wdm-keys .wide{grid-column:span 4}',
        '.wdm-conv{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center}.wdm-conv input{width:7rem;border:1px solid #e2e8f0;border-radius:.8rem;padding:.5rem .7rem}.wdm-conv output{font-weight:900;font-size:1.3rem;color:#4338ca;min-width:5rem}',
        '.wdm-foot{display:flex;flex-wrap:wrap;align-items:center;gap:.75rem;padding:.85rem 1.1rem;border-top:1px solid #eef2ff;background:#fafaff}',
        '.wdm-card .wdm-save{background:#16a34a;border-color:#16a34a;color:#fff;font-weight:800}.wdm-card .wdm-save:hover{background:#15803d;border-color:#15803d}',
        '.wdm-free{font-size:.75rem;color:#64748b}',
        '.wdm-after{padding:.9rem 1.1rem 1.1rem;border-top:1px solid #eef2ff;background:#f5f3ff;font-size:.9rem}.wdm-after p{margin:.2rem 0 .4rem}.wdm-after a:not(.wdm-primary){color:#4f46e5;font-weight:700}.wdm-ok{color:#15803d;font-weight:800}'
    ].join('');
    document.head.appendChild(css);

    function boot() { [].forEach.call(document.querySelectorAll('.wd-mini[data-tool]'), mount); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

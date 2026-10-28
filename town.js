// ═══════════════════════════════════════════════════════════════
// FOCUS TOWN — a cozy isometric village that grows while WebDesks is open.
//
// The loop: the town earns coins every minute it's open (×4 while a focus
// session runs), farms and bakeries make food, villagers move in when
// there's a free home and enough food, decorations keep them happy.
// Spend coins on cottages, fields, a bakery, a market, a windmill…
// Closed tabs still earn, but only at 25% and for up to 12 hours, so
// the town does best when you leave it running beside your work.
//
// Terrain is generated with jwagner/simplex-noise (MIT); everything else
// is drawn procedurally on a <canvas> — no image assets.
// ═══════════════════════════════════════════════════════════════

(() => {
    const SAVE_KEY = 'wd_town';
    const NOISE = 'https://cdn.jsdelivr.net/npm/simplex-noise@4.0.3/dist/esm/simplex-noise.js';
    const N = 19;                       // full map size; the playable area grows with the town's level
    const LEVELS = [
        { name: 'Campsite', pop: 0, size: 9 },
        { name: 'Hamlet', pop: 4, size: 11 },
        { name: 'Village', pop: 10, size: 13 },
        { name: 'Town', pop: 20, size: 15 },
        { name: 'City', pop: 35, size: 17 },
        { name: 'Capital', pop: 55, size: 19 }
    ];
    const OFFLINE_RATE = 0.25, OFFLINE_CAP_MIN = 12 * 60, FOCUS_MULT = 4;

    // ── Buildings ────────────────────────────────────────────────────
    const B = {
        campfire: { name: 'Campfire', cost: 0, level: 0, happy: 3, desc: 'Where it all began.', fixed: true },
        house:    { name: 'Cottage', cost: 25, level: 0, housing: 2, desc: 'Home for 2 villagers.' },
        farm:     { name: 'Wheat field', cost: 30, level: 0, food: 1.2, desc: '+1.2 food / min.' },
        tree:     { name: 'Tree', cost: 8, level: 0, happy: 1, desc: 'Shade and a little joy.' },
        flowers:  { name: 'Flower bed', cost: 6, level: 0, happy: 1, desc: 'Villagers love color.' },
        lantern:  { name: 'Lantern', cost: 12, level: 0, happy: 1, desc: 'Glows warmly at night.' },
        well:     { name: 'Well', cost: 45, level: 1, happy: 5, desc: 'Fresh water: +5 happiness.' },
        bakery:   { name: 'Bakery', cost: 90, level: 1, food: 4, desc: '+4 food / min.' },
        market:   { name: 'Market stall', cost: 140, level: 2, coins: 1.5, desc: '+1.5 coins / min.' },
        windmill: { name: 'Windmill', cost: 160, level: 2, farmBoost: 0.25, desc: 'Fields make 25% more food.' },
        fountain: { name: 'Fountain', cost: 180, level: 2, happy: 8, desc: '+8 happiness.' },
        library:  { name: 'Library', cost: 220, level: 3, focusBoost: 0.1, desc: '+10% coins from everything.' },
        manor:    { name: 'Manor', cost: 300, level: 3, housing: 6, desc: 'Home for 6 villagers.' },
        townhall: { name: 'Town hall', cost: 600, level: 4, happy: 10, coins: 4, unique: true, desc: '+4 coins / min, +10 happiness.' }
    };
    const BUILD_ORDER = ['house', 'farm', 'tree', 'flowers', 'lantern', 'well', 'bakery', 'market', 'windmill', 'fountain', 'library', 'manor', 'townhall'];

    const QUESTS = [
        { text: 'Build a second cottage', test: s => count(s, 'house') >= 2, reward: 20 },
        { text: 'Plant a second wheat field', test: s => count(s, 'farm') >= 2, reward: 20 },
        { text: 'Welcome 4 villagers', test: s => s.pop >= 4, reward: 30 },
        { text: 'Finish a focus session', test: s => s.stats.sessions >= 1, reward: 50 },
        { text: 'Plant 5 trees or flower beds', test: s => count(s, 'tree') + count(s, 'flowers') >= 5, reward: 25 },
        { text: 'Dig a well', test: s => count(s, 'well') >= 1, reward: 30 },
        { text: 'Open a bakery', test: s => count(s, 'bakery') >= 1, reward: 40 },
        { text: 'Grow to 10 villagers', test: s => s.pop >= 10, reward: 60 },
        { text: 'Focus for 2 hours in total', test: s => s.stats.focusMin >= 120, reward: 100 },
        { text: 'Set up a market stall', test: s => count(s, 'market') >= 1, reward: 60 },
        { text: 'Build a windmill', test: s => count(s, 'windmill') >= 1, reward: 60 },
        { text: 'Grow to 20 villagers', test: s => s.pop >= 20, reward: 120 },
        { text: 'Open a library', test: s => count(s, 'library') >= 1, reward: 100 },
        { text: 'Grow to 35 villagers', test: s => s.pop >= 35, reward: 200 },
        { text: 'Build the town hall', test: s => count(s, 'townhall') >= 1, reward: 300 },
        { text: 'Reach 55 villagers — a capital!', test: s => s.pop >= 55, reward: 500 }
    ];
    const NAMES = ['Mila', 'Otto', 'Juno', 'Ivy', 'Bram', 'Nell', 'Theo', 'Rosa', 'Finn', 'Maple', 'Hugo', 'Wren', 'Iris', 'Leo', 'Pip', 'Clara', 'Ezra', 'Fern', 'Arlo', 'Hazel', 'Remy', 'Olive', 'Sol', 'Daisy', 'Kai', 'Lotte', 'Bea', 'Milo', 'Opal', 'Rowan'];
    const SHIRTS = ['#e76f51', '#2a9d8f', '#e9c46a', '#8ab17d', '#6d597a', '#f4a261', '#457b9d', '#ef476f', '#118ab2', '#ffb703'];
    const SKIN = ['#f5d0b5', '#e8b796', '#c98e6a', '#a26b4a', '#7a4d33'];

    const count = (s, t) => s.buildings.filter(b => b.t === t).length;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    const fmt = n => Math.floor(n).toLocaleString();
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const mulberry = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const hash = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

    // ── Colors & light ───────────────────────────────────────────────
    const hex = c => { const n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
    const rgb = (r, g, b, a = 1) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;
    let DARK = 0; // 0 = day, ~0.6 = deep night (set per frame from the clock)
    const NIGHT = [22, 30, 72];
    const tint = (c, k = 0) => {
        let [r, g, b] = hex(c);
        if (k) { const f = k > 0 ? 255 : 0, a = Math.abs(k); r += (f - r) * a; g += (f - g) * a; b += (f - b) * a; }
        r += (NIGHT[0] - r) * DARK; g += (NIGHT[1] - g) * DARK; b += (NIGHT[2] - b) * DARK;
        return rgb(r, g, b);
    };
    function daylight(date = new Date()) {
        const h = date.getHours() + date.getMinutes() / 60;
        if (h >= 7 && h < 18) return 0;
        if (h >= 18 && h < 20.5) return (h - 18) / 2.5 * 0.42;
        if (h >= 20.5 || h < 5) return 0.42;
        return (7 - h) / 2 * 0.42; // dawn 5–7
    }
    const isNight = () => DARK > 0.22;

    // ── Drawing primitives (isometric) ───────────────────────────────
    let S = 1, HW = 32, HH = 16; // scale and half-tile size in CSS px
    const P = (cx, cy, u, v, z = 0) => [cx + (u - v) * HW, cy + (u + v) * HH - z * S];
    const poly = (ctx, pts, fill, stroke) => {
        ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.closePath();
        if (fill) { ctx.fillStyle = fill; ctx.fill(); }
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = Math.max(1, S * 0.6); ctx.stroke(); }
    };
    // A box sitting on the tile: footprint w×d (tile units), height h (px at scale 1), lifted by z.
    function box(ctx, cx, cy, w, d, h, color, z = 0, opts = {}) {
        const a = w / 2, b = d / 2;
        const g = [P(cx, cy, -a, -b, z), P(cx, cy, a, -b, z), P(cx, cy, a, b, z), P(cx, cy, -a, b, z)];
        const t = g.map(([x, y]) => [x, y - h * S]);
        const left = [g[3], g[2], t[2], t[3]], right = [g[2], g[1], t[1], t[2]];
        poly(ctx, left, opts.left || tint(color, -0.12));
        poly(ctx, right, opts.right || tint(color, -0.28));
        if (!opts.noTop) poly(ctx, t, opts.top || tint(color, 0.08));
        return { left, right, top: t, g };
    }
    // Point inside a quad face (s along bottom edge, t up the face).
    const onFace = (q, s, t) => {
        const bx = q[0][0] + (q[1][0] - q[0][0]) * s, by = q[0][1] + (q[1][1] - q[0][1]) * s;
        const tx = q[3][0] + (q[2][0] - q[3][0]) * s, ty = q[3][1] + (q[2][1] - q[3][1]) * s;
        return [bx + (tx - bx) * t, by + (ty - by) * t];
    };
    const faceRect = (ctx, q, s0, s1, t0, t1, fill) => poly(ctx, [onFace(q, s0, t0), onFace(q, s1, t0), onFace(q, s1, t1), onFace(q, s0, t1)], fill);
    const lit = (on) => on ? '#ffd27a' : tint('#3b4a63');
    // Gable roof whose ridge runs along u.
    function gable(ctx, cx, cy, w, d, z, rise, color, over = 0.06) {
        const a = w / 2 + over, b = d / 2 + over;
        const e = [P(cx, cy, -a, -b, z), P(cx, cy, a, -b, z), P(cx, cy, a, b, z), P(cx, cy, -a, b, z)];
        const r1 = P(cx, cy, -a, 0, z + rise), r2 = P(cx, cy, a, 0, z + rise);
        poly(ctx, [e[0], e[1], r2, r1], tint(color, 0.05));          // back slope
        poly(ctx, [e[1], e[2], r2], tint(color, -0.35));              // gable end (right)
        poly(ctx, [e[3], e[2], r2, r1], tint(color, -0.08));          // front slope
        ctx.strokeStyle = tint(color, -0.45); ctx.lineWidth = Math.max(1, S); ctx.beginPath(); ctx.moveTo(r1[0], r1[1]); ctx.lineTo(r2[0], r2[1]); ctx.stroke();
    }
    function pyramid(ctx, cx, cy, w, z, rise, color) {
        const a = w / 2;
        const e = [P(cx, cy, -a, -a, z), P(cx, cy, a, -a, z), P(cx, cy, a, a, z), P(cx, cy, -a, a, z)];
        const apex = P(cx, cy, 0, 0, z + rise);
        poly(ctx, [e[3], e[2], apex], tint(color, -0.1));
        poly(ctx, [e[2], e[1], apex], tint(color, -0.32));
    }
    function shadow(ctx, cx, cy, rx, ry = rx) {
        ctx.fillStyle = `rgba(20,30,20,${0.18 - DARK * 0.1})`;
        ctx.beginPath(); ctx.ellipse(cx, cy + 2 * S, rx * HW, ry * HH, 0, 0, Math.PI * 2); ctx.fill();
    }
    function roundTree(ctx, cx, cy, sz = 1, hue = 0) {
        shadow(ctx, cx, cy, 0.34 * sz);
        box(ctx, cx, cy, 0.09 * sz, 0.09 * sz, 10 * sz, '#7a5230');
        const greens = [['#4f9d4a', '#6fbf5f', '#3d7f3a'], ['#c77d2b', '#e3a640', '#9e5d1f'], ['#6aa84f', '#93c47d', '#4c8a3a']][hue];
        const blobs = [[0, -22, 13], [-7, -15, 10], [7, -15, 10]];
        blobs.forEach(([dx, dy, r]) => {
            const x = cx + dx * S * sz, y = cy + dy * S * sz, rr = r * S * sz;
            const g = ctx.createRadialGradient(x - rr * 0.4, y - rr * 0.5, rr * 0.2, x, y, rr);
            g.addColorStop(0, tint(greens[1])); g.addColorStop(1, tint(greens[2]));
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.fill();
        });
    }
    function pineTree(ctx, cx, cy, sz = 1) {
        shadow(ctx, cx, cy, 0.3 * sz);
        box(ctx, cx, cy, 0.08, 0.08, 8 * sz, '#6b4527');
        [[0, 30, 12], [-6, 22, 10], [-12, 14, 8]].forEach(([dz, h, r], i) => {
            const base = cy - (8 + i * 7) * S * sz, top = base - h * 0.55 * S * sz;
            ctx.fillStyle = tint(i === 2 ? '#3f8f5a' : '#2f7a4c');
            ctx.beginPath(); ctx.moveTo(cx, top); ctx.lineTo(cx + r * S * sz, base); ctx.lineTo(cx - r * S * sz, base); ctx.closePath(); ctx.fill();
            ctx.fillStyle = tint('#235f3a'); ctx.beginPath(); ctx.moveTo(cx, top); ctx.lineTo(cx + r * S * sz, base); ctx.lineTo(cx + r * 0.2 * S * sz, base); ctx.closePath(); ctx.fill();
        });
    }

    // Each draw function paints one building centred on its tile and may
    // register live effects (smoke, glow, blades, water) for the fast layer.
    const DRAW = {
        campfire(ctx, cx, cy, fx) {
            for (let i = 0; i < 7; i++) {
                const a = i / 7 * Math.PI * 2, [x, y] = P(cx, cy, Math.cos(a) * 0.2, Math.sin(a) * 0.2);
                ctx.fillStyle = tint(i % 2 ? '#8d8d8d' : '#a7a7a7'); ctx.beginPath(); ctx.ellipse(x, y, 3.2 * S, 2.2 * S, 0, 0, Math.PI * 2); ctx.fill();
            }
            ctx.strokeStyle = tint('#6b4527'); ctx.lineWidth = 2.2 * S;
            ctx.beginPath(); ctx.moveTo(cx - 6 * S, cy + 1 * S); ctx.lineTo(cx + 6 * S, cy - 2 * S); ctx.moveTo(cx - 5 * S, cy - 2 * S); ctx.lineTo(cx + 5 * S, cy + 1 * S); ctx.stroke();
            fx.push({ k: 'fire', x: cx, y: cy - 2 * S }, { k: 'glow', x: cx, y: cy - 4 * S, r: 70, a: 0.55, always: true });
        },
        house(ctx, cx, cy, fx, b) {
            shadow(ctx, cx, cy, 0.42);
            const wall = ['#f2e3c6', '#f7d9c4', '#e9e2d0'][b.v % 3], roof = ['#c8553d', '#6b8f71', '#5c6f9e'][b.v % 3];
            const f = box(ctx, cx, cy, 0.62, 0.56, 20, wall);
            faceRect(ctx, f.left, 0.38, 0.62, 0, 0.62, tint('#7a4e2d'));                       // door
            faceRect(ctx, f.right, 0.3, 0.7, 0.35, 0.75, lit(isNight()));                      // window
            faceRect(ctx, f.left, 0.08, 0.28, 0.4, 0.75, lit(isNight()));
            const [chx, chy] = P(cx, cy, 0.14, -0.12, 20);
            box(ctx, chx, chy + 0 * S, 0.1, 0.1, 18, '#8c6a5a');
            gable(ctx, cx, cy, 0.62, 0.56, 20, 15, roof);
            fx.push({ k: 'smoke', x: chx, y: chy - 18 * S });
            if (isNight()) fx.push({ k: 'glow', x: cx, y: cy - 10 * S, r: 34, a: 0.35 });
        },
        farm(ctx, cx, cy) {
            const g = [P(cx, cy, -0.46, -0.46, 1), P(cx, cy, 0.46, -0.46, 1), P(cx, cy, 0.46, 0.46, 1), P(cx, cy, -0.46, 0.46, 1)];
            poly(ctx, g, tint('#8a6239'));
            for (let i = 0; i < 6; i++) {
                const t = -0.4 + i * 0.16;
                const a = P(cx, cy, -0.4, t, 1), c = P(cx, cy, 0.4, t, 1);
                ctx.strokeStyle = tint('#e7c35a'); ctx.lineWidth = 4.2 * S; ctx.lineCap = 'round';
                ctx.beginPath(); ctx.moveTo(a[0], a[1] - 3 * S); ctx.lineTo(c[0], c[1] - 3 * S); ctx.stroke();
                ctx.strokeStyle = tint('#f4d97e'); ctx.lineWidth = 1.6 * S;
                ctx.beginPath(); ctx.moveTo(a[0], a[1] - 5.5 * S); ctx.lineTo(c[0], c[1] - 5.5 * S); ctx.stroke();
            }
            ctx.lineCap = 'butt';
            [[-0.48, 0.48], [0.48, 0.48], [0.48, -0.48]].forEach(([u, v]) => box(ctx, ...P(cx, cy, u, v), 0.04, 0.04, 7, '#a77b4f'));
        },
        tree(ctx, cx, cy, fx, b) { (b.v % 3 === 2 ? pineTree : roundTree)(ctx, cx, cy, 1, new Date().getMonth() >= 8 && new Date().getMonth() <= 10 && b.v % 3 === 1 ? 1 : 0); },
        flowers(ctx, cx, cy, fx, b) {
            const cols = ['#ff7aa8', '#ffd166', '#c77dff', '#ff9f68', '#ffffff'];
            for (let i = 0; i < 14; i++) {
                const u = (hash(i, b.x, b.y) - 0.5) * 0.8, v = (hash(b.y, i, b.x) - 0.5) * 0.8, [x, y] = P(cx, cy, u, v);
                ctx.fillStyle = tint('#3f8a3d'); ctx.fillRect(x - 0.5 * S, y - 4 * S, 1 * S, 4 * S);
                ctx.fillStyle = tint(cols[(i + b.v) % cols.length]); ctx.beginPath(); ctx.arc(x, y - 4.5 * S, 2.1 * S, 0, Math.PI * 2); ctx.fill();
            }
        },
        lantern(ctx, cx, cy, fx) {
            shadow(ctx, cx, cy, 0.12);
            box(ctx, cx, cy, 0.05, 0.05, 26, '#3d3d46');
            box(ctx, cx, cy, 0.12, 0.12, 7, isNight() ? '#ffd27a' : '#cfd6df', 26);
            pyramid(ctx, cx, cy, 0.16, 33, 5, '#3d3d46');
            fx.push({ k: 'glow', x: cx, y: cy - 29 * S, r: 60, a: 0.6 });
        },
        well(ctx, cx, cy) {
            shadow(ctx, cx, cy, 0.34);
            box(ctx, cx, cy, 0.42, 0.42, 9, '#9aa0a6');
            poly(ctx, [P(cx, cy, -0.15, -0.15, 9), P(cx, cy, 0.15, -0.15, 9), P(cx, cy, 0.15, 0.15, 9), P(cx, cy, -0.15, 0.15, 9)], tint('#2c6e9b'));
            [[-0.17, 0.17], [0.17, -0.17]].forEach(([u, v]) => box(ctx, ...P(cx, cy, u, v), 0.04, 0.04, 26, '#7a5230', 9));
            gable(ctx, cx, cy, 0.5, 0.42, 30, 9, '#a0522d', 0.02);
        },
        bakery(ctx, cx, cy, fx) {
            shadow(ctx, cx, cy, 0.46);
            const f = box(ctx, cx, cy, 0.72, 0.62, 24, '#e8b4a0');
            faceRect(ctx, f.left, 0.4, 0.62, 0, 0.6, tint('#5a3a2a'));
            faceRect(ctx, f.left, 0.06, 0.3, 0.38, 0.72, lit(isNight()));
            faceRect(ctx, f.right, 0.15, 0.85, 0.35, 0.72, lit(isNight()));
            faceRect(ctx, f.left, 0.36, 0.66, 0.7, 0.86, tint('#f4e1b8'));                       // sign
            const [chx, chy] = P(cx, cy, -0.2, -0.15, 24);
            box(ctx, chx, chy, 0.13, 0.13, 22, '#7d5d50');
            gable(ctx, cx, cy, 0.72, 0.62, 24, 16, '#6e3b2b');
            fx.push({ k: 'smoke', x: chx, y: chy - 22 * S, big: true });
            if (isNight()) fx.push({ k: 'glow', x: cx, y: cy - 12 * S, r: 44, a: 0.4 });
        },
        market(ctx, cx, cy) {
            shadow(ctx, cx, cy, 0.46);
            box(ctx, cx, cy, 0.7, 0.5, 9, '#b98a5b');
            [[-0.33, 0.23], [0.33, 0.23], [0.33, -0.23], [-0.33, -0.23]].forEach(([u, v]) => box(ctx, ...P(cx, cy, u, v), 0.04, 0.04, 26, '#7a5230'));
            // striped awning
            for (let i = 0; i < 6; i++) {
                const u0 = -0.4 + i * (0.8 / 6), u1 = u0 + 0.8 / 6;
                poly(ctx, [P(cx, cy, u0, 0.32, 26), P(cx, cy, u1, 0.32, 26), P(cx, cy, u1, -0.3, 34), P(cx, cy, u0, -0.3, 34)], tint(i % 2 ? '#fdf0d5' : '#e63946'));
            }
            [['#e76f51', -0.18], ['#8ab17d', 0.02], ['#f4a261', 0.2]].forEach(([c, u]) => {
                const [x, y] = P(cx, cy, u, 0.1, 9); ctx.fillStyle = tint(c);
                ctx.beginPath(); ctx.arc(x, y - 2 * S, 3.2 * S, 0, Math.PI * 2); ctx.fill();
            });
        },
        windmill(ctx, cx, cy, fx) {
            shadow(ctx, cx, cy, 0.4);
            box(ctx, cx, cy, 0.46, 0.46, 18, '#e9e2d0');
            box(ctx, cx, cy, 0.36, 0.36, 22, '#ded6c3', 18);
            const f = box(ctx, cx, cy, 0.28, 0.28, 12, '#d4cbb6', 40);
            faceRect(ctx, f.left, 0.3, 0.7, 0.2, 0.7, lit(isNight()));
            pyramid(ctx, cx, cy, 0.36, 52, 16, '#8c4a3a');
            const [hx, hy] = P(cx, cy, -0.05, 0.2, 48);
            fx.push({ k: 'blades', x: hx, y: hy });
        },
        fountain(ctx, cx, cy, fx) {
            shadow(ctx, cx, cy, 0.44);
            box(ctx, cx, cy, 0.78, 0.78, 6, '#b8bec6');
            poly(ctx, [P(cx, cy, -0.3, -0.3, 6), P(cx, cy, 0.3, -0.3, 6), P(cx, cy, 0.3, 0.3, 6), P(cx, cy, -0.3, 0.3, 6)], tint('#4aa3d8'));
            box(ctx, cx, cy, 0.1, 0.1, 16, '#c5cbd3', 6);
            box(ctx, cx, cy, 0.24, 0.24, 3, '#c5cbd3', 22);
            fx.push({ k: 'water', x: cx, y: cy - 25 * S });
        },
        library(ctx, cx, cy) {
            shadow(ctx, cx, cy, 0.5);
            box(ctx, cx, cy, 0.84, 0.7, 4, '#c9c3b6');
            const f = box(ctx, cx, cy, 0.76, 0.62, 30, '#d9dfe7', 4);
            for (let i = 0; i < 4; i++) faceRect(ctx, f.left, 0.08 + i * 0.23, 0.18 + i * 0.23, 0.05, 0.95, tint('#f3f5f8'));
            faceRect(ctx, f.right, 0.15, 0.4, 0.3, 0.75, lit(isNight()));
            faceRect(ctx, f.right, 0.6, 0.85, 0.3, 0.75, lit(isNight()));
            gable(ctx, cx, cy, 0.76, 0.62, 34, 12, '#4a5568');
        },
        manor(ctx, cx, cy, fx) {
            shadow(ctx, cx, cy, 0.55);
            const f = box(ctx, cx, cy, 0.86, 0.72, 32, '#efe6d8');
            [0.1, 0.62].forEach(s => { faceRect(ctx, f.left, s, s + 0.2, 0.15, 0.42, lit(isNight())); faceRect(ctx, f.left, s, s + 0.2, 0.58, 0.85, lit(isNight())); });
            faceRect(ctx, f.left, 0.38, 0.56, 0, 0.42, tint('#4b3a2f'));
            [0.15, 0.6].forEach(s => { faceRect(ctx, f.right, s, s + 0.22, 0.15, 0.42, lit(isNight())); faceRect(ctx, f.right, s, s + 0.22, 0.58, 0.85, lit(isNight())); });
            const [chx, chy] = P(cx, cy, 0.25, -0.2, 32);
            box(ctx, chx, chy, 0.11, 0.11, 22, '#8c6a5a');
            gable(ctx, cx, cy, 0.86, 0.72, 32, 18, '#2f5d50');
            fx.push({ k: 'smoke', x: chx, y: chy - 22 * S });
            if (isNight()) fx.push({ k: 'glow', x: cx, y: cy - 16 * S, r: 56, a: 0.4 });
        },
        townhall(ctx, cx, cy, fx) {
            shadow(ctx, cx, cy, 0.6);
            box(ctx, cx, cy, 0.94, 0.86, 5, '#c9c3b6');
            const f = box(ctx, cx, cy, 0.86, 0.78, 34, '#f1e4cf', 5);
            for (let i = 0; i < 3; i++) faceRect(ctx, f.left, 0.1 + i * 0.3, 0.26 + i * 0.3, 0.45, 0.85, lit(isNight()));
            faceRect(ctx, f.left, 0.4, 0.58, 0, 0.38, tint('#5a3a2a'));
            for (let i = 0; i < 3; i++) faceRect(ctx, f.right, 0.1 + i * 0.3, 0.26 + i * 0.3, 0.45, 0.85, lit(isNight()));
            gable(ctx, cx, cy, 0.86, 0.78, 39, 14, '#8c3b3b');
            const t = box(ctx, cx, cy, 0.26, 0.26, 24, '#efe2c8', 50);
            const [kx, ky] = onFace(t.left, 0.5, 0.55);
            ctx.fillStyle = tint('#fffaf0'); ctx.beginPath(); ctx.arc(kx, ky, 4.2 * S, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = tint('#333'); ctx.lineWidth = S; ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(kx, ky - 3 * S); ctx.moveTo(kx, ky); ctx.lineTo(kx + 2 * S, ky); ctx.stroke();
            pyramid(ctx, cx, cy, 0.32, 74, 18, '#8c3b3b');
            const [fxp, fyp] = P(cx, cy, 0, 0, 92);
            fx.push({ k: 'flag', x: fxp, y: fyp });
            if (isNight()) fx.push({ k: 'glow', x: cx, y: cy - 20 * S, r: 70, a: 0.45 });
        }
    };

    // ── State ────────────────────────────────────────────────────────
    let st = null, terrain = null, noiseLib = null;
    let canvas, ctx, staticCanvas, staticKey = '', fx = [], villagers = [], particles = [];
    let raf = null, lastFrame = 0, tickTimer = null, saveTimer = null, view = { ox: 0, oy: 0 };
    let mode = { build: null, hover: null, selected: null, bubble: null };
    let zoom = 1, pan = { x: 0, y: 0 };
    let paletteDirty = true;

    const levelIndex = pop => LEVELS.reduce((i, l, k) => pop >= l.pop ? k : i, 0);
    // The town keeps the highest level it reached, so land never shrinks if villagers leave.
    const level = () => Math.max(st.maxLevel || 0, levelIndex(st.pop));
    const area = () => { const size = LEVELS[level()].size, o = (N - size) / 2; return { o, size }; };
    const inArea = (x, y) => { const { o, size } = area(); return x >= o && y >= o && x < o + size && y < o + size; };
    const tileAt = (x, y) => terrain[y * N + x];
    const buildingAt = (x, y) => st.buildings.find(b => b.x === x && b.y === y);
    const housing = () => st.buildings.reduce((n, b) => n + (B[b.t].housing || 0), 0);

    function rates() {
        const c = t => count(st, t);
        const happyF = 0.6 + 0.8 * (st.happy / 100);
        const focusing = !!app.timerRunning;
        const boost = 1 + 0.1 * c('library');
        const coins = (1 + 0.3 * st.pop + 1.5 * c('market') + 4 * c('townhall')) * (focusing ? FOCUS_MULT : 1) * boost * happyF;
        const foodMade = 1.2 * c('farm') * (1 + 0.25 * Math.min(4, c('windmill'))) + 4 * c('bakery');
        const eaten = 0.2 * st.pop;
        const decor = st.buildings.reduce((n, b) => n + (B[b.t].happy || 0), 0);
        return { coins, foodMade, eaten, food: foodMade - eaten, decor, focusing, foodCap: 40 + 30 * (c('farm') + c('bakery')) };
    }

    function newTown() {
        const seed = Math.floor(Math.random() * 1e9);
        const c = (N - 1) / 2;
        return {
            v: 1, seed, name: 'Hearthvale', coins: 60, food: 20, pop: 2, happy: 60, grow: 0, starve: 0,
            buildings: [{ t: 'campfire', x: c, y: c, v: 0 }, { t: 'house', x: c - 1, y: c - 1, v: 0 }, { t: 'farm', x: c + 1, y: c - 1, v: 0 }, { t: 'tree', x: c - 2, y: c + 1, v: 1 }],
            cleared: [], quest: 0, stats: { sessions: 0, focusMin: 0, built: 0, earned: 0 },
            lastTick: Date.now(), daily: { date: '', streak: 0 }, log: []
        };
    }

    function load() {
        try { st = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { st = null; }
        if (!st || st.v !== 1) {
            st = newTown();
            // Bring over progress from the old Focus Town.
            const oldMin = parseInt(localStorage.getItem('wd_ft_minutes') || '0', 10);
            const oldName = localStorage.getItem('wd_ft_townname');
            if (oldName) st.name = oldName.slice(0, 24);
            if (oldMin > 0) {
                const bonus = Math.min(2000, oldMin * 2);
                st.coins += bonus;
                st.stats.focusMin = oldMin;
                st.stats.sessions = parseInt(localStorage.getItem('wd_ft_sessions') || '0', 10);
                st._welcome = `Your old town's ${oldMin} focus minutes became 🪙 ${bonus} to rebuild with.`;
            }
            save();
        }
    }
    function save() { try { st.lastTick = st.lastTick || Date.now(); localStorage.setItem(SAVE_KEY, JSON.stringify(st)); } catch (e) {} }
    const saveSoon = () => { clearTimeout(saveTimer); saveTimer = setTimeout(save, 800); };

    async function makeTerrain() {
        if (!noiseLib) { try { noiseLib = await import(NOISE); } catch (e) { noiseLib = null; } }
        const rnd = mulberry(st.seed);
        const n2 = noiseLib ? noiseLib.createNoise2D(rnd) : (x, y) => Math.sin(x * 1.7 + st.seed) * Math.cos(y * 1.3 - st.seed) * 0.8;
        const m2 = noiseLib ? noiseLib.createNoise2D(rnd) : (x, y) => Math.sin(x * 2.3 - y) * 0.6;
        const c = (N - 1) / 2;
        terrain = [];
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
            const d = Math.hypot(x - c, y - c);
            const e = n2(x * 0.13, y * 0.13) + (d < 3 ? 0.6 : 0);
            const m = m2(x * 0.22 + 40, y * 0.22 - 40);
            let kind = 'grass';
            if (e < -0.42) kind = 'water';
            else if (e < -0.3) kind = 'sand';
            else if (m > 0.32 && d > 2.5 && hash(x, y, st.seed) < 0.75) kind = 'wild';
            else if (hash(y, x, st.seed) < 0.035 && d > 2.5) kind = 'rock';
            terrain.push({ kind, shade: hash(x * 7, y * 3, st.seed), m });
        }
        st.cleared.forEach(i => { if (terrain[i] && (terrain[i].kind === 'wild' || terrain[i].kind === 'rock')) terrain[i].kind = 'grass'; });
        st.buildings.forEach(b => { const t = tileAt(b.x, b.y); if (t.kind !== 'grass' && t.kind !== 'sand') t.kind = 'grass'; });
        staticKey = '';
    }

    // ── Simulation ───────────────────────────────────────────────────
    function simulate(minutes, offline) {
        const r = rates();
        const k = offline ? OFFLINE_RATE : 1;
        const coins = r.coins * minutes * k / (r.focusing && offline ? FOCUS_MULT : 1);
        st.coins += coins;
        st.stats.earned += coins;
        st.food = clamp(st.food + r.food * minutes * k, 0, r.foodCap);
        const target = clamp(40 + Math.min(50, r.decor) + (st.food > 0 ? 10 : -30) + (housing() >= st.pop ? 0 : -10), 0, 100);
        st.happy += clamp(target - st.happy, -2 * minutes, 2 * minutes);
        let arrived = 0, left = 0;
        if (!offline || minutes > 30) {
            st.grow += minutes * (st.happy / 100) * (offline ? 0.2 : 1);
            while (st.grow >= 3 && st.pop < housing() && st.food >= 3) { st.grow -= 3; st.pop++; arrived++; if (offline && arrived >= 3) break; }
            if (st.pop >= housing()) st.grow = Math.min(st.grow, 3);
        }
        if (st.food <= 0.01) {
            st.starve += minutes;
            while (st.starve >= 10 && st.pop > 1) { st.starve -= 10; st.pop--; left++; }
        } else st.starve = 0;
        return { coins, arrived, left };
    }

    function tick() {
        const now = Date.now();
        const mins = (now - st.lastTick) / 60000;
        if (mins <= 0) return;
        st.lastTick = now;
        if (mins > 5) return welcomeBack(mins); // throttled/asleep: treat as away time
        const lvl = level();
        const { arrived, left } = simulate(mins, false);
        if (app.timerRunning) st.stats.focusMin += mins;
        if (arrived) { const n = NAMES[(st.pop + st.seed) % NAMES.length]; note(`🏠 ${n} moved into town!`); syncVillagers(); }
        if (left) { note('😢 A hungry villager left. Build fields or a bakery!'); syncVillagers(); }
        if (levelIndex(st.pop) > (st.maxLevel || 0)) st.maxLevel = levelIndex(st.pop);
        if (level() > lvl) levelUp();
        checkQuest();
        renderHud();
        if (now - (st._saved || 0) > 60000) { st._saved = now; save(); }
    }

    function welcomeBack(mins) {
        const m = Math.min(OFFLINE_CAP_MIN, mins);
        const before = { coins: st.coins, food: st.food, pop: st.pop };
        simulate(m, true);
        syncVillagers();
        const h = Math.floor(m / 60), mm = Math.round(m % 60);
        const gained = st.coins - before.coins;
        if (gained >= 1) showCard(`
            <div class="text-3xl mb-1">🌅</div>
            <div class="font-black text-lg">Welcome back!</div>
            <p class="text-sm text-slate-500 mb-3">While you were away (${h ? h + ' h ' : ''}${mm} min) ${esc(st.name)} earned <b>🪙 ${fmt(gained)}</b>${st.food > before.food ? ` and stored <b>🍞 ${fmt(st.food - before.food)}</b>` : ''}${st.pop > before.pop ? `, and <b>${st.pop - before.pop} new villager${st.pop - before.pop > 1 ? 's' : ''}</b> moved in` : ''}.</p>
            <p class="text-xs text-slate-400 mb-4">Towns earn ${Math.round(OFFLINE_RATE * 100)}% while closed. Keep this tab open to earn 4× more, and focus for ×${FOCUS_MULT}.</p>
            <button class="town-btn primary w-full" data-close>Back to town</button>`);
        save();
    }

    function dailyGift() {
        const today = todayStr();
        if (st.daily.date === today) return;
        const y = new Date(); y.setDate(y.getDate() - 1);
        const yStr = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
        st.daily.streak = st.daily.date === yStr ? Math.min(7, st.daily.streak + 1) : 1;
        st.daily.date = today;
        const gift = 20 + 10 * st.daily.streak;
        st.coins += gift;
        note(`🎁 Daily gift: 🪙 ${gift} (day ${st.daily.streak} streak${st.daily.streak >= 7 ? ' — max!' : ''})`);
        save();
    }

    function levelUp() {
        const L = LEVELS[level()];
        staticKey = '';
        layout();
        app._celebrate ? app._celebrate(`🎉 ${st.name} is now a ${L.name}! The land grew.`) : note(`🎉 ${st.name} is now a ${L.name}!`);
        paletteDirty = true;
        renderSide();
    }

    function checkQuest() {
        const q = QUESTS[st.quest];
        if (q && q.test(st) && !st._questReady) { st._questReady = true; renderSide(); }
    }
    function claimQuest() {
        const q = QUESTS[st.quest];
        if (!q || !q.test(st)) return;
        st.coins += q.reward;
        st.quest++;
        st._questReady = false;
        app._celebrate ? app._celebrate(`Quest done! +🪙 ${q.reward}`) : note(`Quest done! +🪙 ${q.reward}`);
        save();
        renderHud(); renderSide();
        checkQuest();
    }

    // Rewards from the rest of WebDesks.
    function reward(coins, why) {
        if (!st) return;
        st.coins += coins;
        note(`${why} +🪙 ${coins} for ${st.name}`);
        saveSoon();
        renderHud();
    }

    // ── Villagers ────────────────────────────────────────────────────
    const walkable = (x, y) => x >= 0 && y >= 0 && x < N && y < N && inArea(x, y) && ['grass', 'sand'].includes(tileAt(x, y).kind) && !(buildingAt(x, y) && !['flowers', 'farm', 'campfire'].includes(buildingAt(x, y).t));
    function syncVillagers() {
        const want = Math.min(st.pop, 60);
        const c = (N - 1) / 2;
        while (villagers.length < want) {
            const i = villagers.length, rnd = mulberry(st.seed + i * 97);
            let x = c, y = c;
            for (let k = 0; k < 20; k++) { const tx = Math.round(c + (rnd() - 0.5) * 6), ty = Math.round(c + (rnd() - 0.5) * 6); if (walkable(tx, ty)) { x = tx; y = ty; break; } }
            villagers.push({ i, name: NAMES[(i + st.seed) % NAMES.length], shirt: SHIRTS[i % SHIRTS.length], skin: SKIN[(i * 3 + st.seed) % SKIN.length], x, y, fx: x, fy: y, tx: x, ty: y, t: 1, speed: 0.6 + rnd() * 0.5, wait: rnd() * 3, hearts: 0 });
        }
        villagers.length = want;
    }
    function stepVillagers(dt) {
        villagers.forEach(v => {
            if (v.t < 1) {
                v.t = Math.min(1, v.t + dt * v.speed);
                v.x = v.fx + (v.tx - v.fx) * v.t; v.y = v.fy + (v.ty - v.fy) * v.t;
                return;
            }
            v.wait -= dt;
            if (v.wait > 0) return;
            const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].sort(() => Math.random() - 0.5);
            const d = dirs.find(([dx, dy]) => walkable(v.tx + dx, v.ty + dy));
            if (!d) { v.wait = 1 + Math.random() * 2; return; }
            v.fx = v.tx; v.fy = v.ty; v.tx += d[0]; v.ty += d[1]; v.t = 0;
            v.wait = Math.random() < 0.3 ? 1 + Math.random() * 4 : 0;
        });
    }

    // ── Rendering ────────────────────────────────────────────────────
    function layout() {
        if (!canvas) return;
        const wrap = canvas.parentElement;
        const w = wrap.clientWidth, h = wrap.clientHeight;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
        canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const { size } = area();
        // Fit the playable diamond (plus building height) into the canvas.
        S = Math.max(0.2, Math.min(w / ((size + 0.6) * 64), (h - 30) / ((size + 1) * 32 + 70))) * zoom;
        HW = 32 * S; HH = 16 * S;
        const c = (N - 1) / 2;
        view.ox = w / 2 + pan.x;
        view.oy = h / 2 + 34 * S - (c + c) * HH + pan.y;
        view.w = w; view.h = h; view.dpr = dpr;
        staticCanvas = staticCanvas || document.createElement('canvas');
        staticCanvas.width = canvas.width; staticCanvas.height = canvas.height;
        staticKey = '';
    }
    const tileCenter = (x, y) => [view.ox + (x - y) * HW, view.oy + (x + y) * HH];

    function drawSky(c) {
        const g = c.createLinearGradient(0, 0, 0, view.h);
        const h = new Date().getHours();
        const sunset = h >= 17 && h < 21, dawn = h >= 5 && h < 8;
        if (DARK > 0.32) { g.addColorStop(0, '#0e1440'); g.addColorStop(1, '#34408a'); }
        else if (sunset) { g.addColorStop(0, '#5b5ea6'); g.addColorStop(0.6, '#f49b7a'); g.addColorStop(1, '#ffd6a5'); }
        else if (dawn) { g.addColorStop(0, '#8fb8ff'); g.addColorStop(1, '#ffdcc2'); }
        else { g.addColorStop(0, '#9fd3ff'); g.addColorStop(1, '#e8f6ff'); }
        c.fillStyle = g; c.fillRect(0, 0, view.w, view.h);
        if (DARK > 0.25) {
            const rnd = mulberry(7);
            for (let i = 0; i < 90; i++) { c.fillStyle = `rgba(255,255,255,${0.3 + rnd() * 0.6})`; c.fillRect(rnd() * view.w, rnd() * view.h * 0.6, 1.3, 1.3); }
        }
    }

    function drawTile(c, x, y) {
        const t = tileAt(x, y);
        const [cx, cy] = tileCenter(x, y);
        const g = [[cx, cy - HH], [cx + HW, cy], [cx, cy + HH], [cx - HW, cy]];
        const depth = 9 * S;
        const base = t.kind === 'water' ? '#4aa3d8' : t.kind === 'sand' ? '#e9d8a6' : ['#7cc46a', '#86cc72', '#74bb63'][Math.floor(t.shade * 3)];
        // earth sides (only visible on the island's edge, painter's order hides the rest)
        poly(c, [g[3], g[2], [g[2][0], g[2][1] + depth], [g[3][0], g[3][1] + depth]], tint('#8a6b4a', -0.05));
        poly(c, [g[2], g[1], [g[1][0], g[1][1] + depth], [g[2][0], g[2][1] + depth]], tint('#6e5338'));
        poly(c, [g[1], [g[1][0], g[1][1] + 3 * S], [g[2][0], g[2][1] + 3 * S], g[2]], tint(t.kind === 'water' ? '#3a86b5' : '#5d9b4f'));
        poly(c, g, tint(base));
        if (t.kind === 'grass' && t.m > 0.05 && t.m < 0.2 && !buildingAt(x, y)) {
            for (let i = 0; i < 3; i++) { const [px, py] = P(cx, cy, hash(i, x, y) - 0.5, hash(y, x, i) - 0.5); c.fillStyle = tint(['#fff7d6', '#ffd1e8', '#d9f0ff'][i]); c.fillRect(px, py, 1.6 * S, 1.6 * S); }
        }
        if (t.kind === 'water') { c.strokeStyle = tint('#9fd6f5'); c.lineWidth = S; c.beginPath(); c.moveTo(cx - HW * 0.3, cy); c.lineTo(cx + HW * 0.1, cy - HH * 0.2); c.stroke(); }
    }

    function drawStatic() {
        const key = `${st.buildings.length}|${JSON.stringify(st.buildings.map(b => b.t + b.x + ',' + b.y)).length}|${st.cleared.length}|${Math.round(DARK * 20)}|${level()}|${view.w}x${view.h}|${st._v || 0}`;
        if (key === staticKey) return;
        staticKey = key;
        const c = staticCanvas.getContext('2d');
        c.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
        drawSky(c);
        fx = [];
        const { o, size } = area();
        const items = [];
        for (let y = o; y < o + size; y++) for (let x = o; x < o + size; x++) items.push([x, y]);
        items.sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]) || a[0] - b[0]);
        items.forEach(([x, y]) => drawTile(c, x, y));
        items.forEach(([x, y]) => {
            const [cx, cy] = tileCenter(x, y);
            const t = tileAt(x, y), b = buildingAt(x, y);
            if (b) DRAW[b.t](c, cx, cy, fx, b);
            else if (t.kind === 'wild') (hash(x, y, 3) < 0.5 ? pineTree : roundTree)(c, cx, cy, 0.8 + hash(x, y, 9) * 0.35, (new Date().getMonth() >= 8 && new Date().getMonth() <= 10 && hash(x, y, 4) < 0.4) ? 1 : 2);
            else if (t.kind === 'rock') { shadow(c, cx, cy, 0.25); box(c, cx, cy, 0.3, 0.26, 7, '#9a9fa6'); box(c, cx - 5 * S, cy + 2 * S, 0.16, 0.14, 4, '#b3b8be'); }
        });
    }

    function drawFrame(ts) {
        raf = requestAnimationFrame(drawFrame);
        if (ts - lastFrame < 33) return; // ~30 fps is plenty for a town
        const dt = Math.min(0.1, (ts - lastFrame) / 1000);
        lastFrame = ts;
        DARK = daylight();
        drawStatic();
        ctx.clearRect(0, 0, view.w, view.h);
        ctx.drawImage(staticCanvas, 0, 0, view.w, view.h);
        const time = ts / 1000;
        // Fast layer: effects registered by buildings.
        fx.forEach(f => {
            if (f.k === 'smoke' && Math.random() < (f.big ? 0.35 : 0.2)) particles.push({ x: f.x, y: f.y, vx: (Math.random() - 0.3) * 4, vy: -10 - Math.random() * 6, life: 2.2, r: (f.big ? 3 : 2.2) * S, kind: 'smoke' });
            if (f.k === 'fire') {
                for (let i = 0; i < 3; i++) {
                    const h = (8 + Math.sin(time * 9 + i * 2) * 2.5) * S, w = (4 - i) * S;
                    ctx.fillStyle = ['#ff7b00', '#ffb000', '#fff3a0'][i];
                    ctx.beginPath(); ctx.moveTo(f.x - w, f.y); ctx.quadraticCurveTo(f.x, f.y - h * 1.6 + i * 2 * S, f.x + w, f.y); ctx.closePath(); ctx.fill();
                }
            }
            if (f.k === 'blades') {
                ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(time * 0.9);
                for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.fillStyle = tint('#f5efe0'); ctx.fillRect(-2 * S, 0, 4 * S, 24 * S); ctx.strokeStyle = tint('#8c6a5a'); ctx.lineWidth = S; ctx.strokeRect(-2 * S, 0, 4 * S, 24 * S); }
                ctx.fillStyle = tint('#6b4527'); ctx.beginPath(); ctx.arc(0, 0, 2.5 * S, 0, Math.PI * 2); ctx.fill();
                ctx.restore();
            }
            if (f.k === 'water' && Math.random() < 0.5) particles.push({ x: f.x, y: f.y, vx: (Math.random() - 0.5) * 18, vy: -14 - Math.random() * 6, g: 40, life: 0.7, r: 1.4 * S, kind: 'drop' });
            if (f.k === 'flag') {
                ctx.fillStyle = tint('#5a3a2a'); ctx.fillRect(f.x - 0.6 * S, f.y - 16 * S, 1.2 * S, 16 * S);
                ctx.fillStyle = '#e63946'; ctx.beginPath(); ctx.moveTo(f.x, f.y - 16 * S);
                for (let i = 0; i <= 4; i++) ctx.lineTo(f.x + i * 3 * S, f.y - 16 * S + Math.sin(time * 4 + i) * 1.2 * S);
                for (let i = 4; i >= 0; i--) ctx.lineTo(f.x + i * 3 * S, f.y - 9 * S + Math.sin(time * 4 + i) * 1.2 * S);
                ctx.closePath(); ctx.fill();
            }
        });
        // Villagers walk the paths (fewer are out at night).
        stepVillagers(dt);
        const out = DARK > 0.38 ? Math.ceil(villagers.length * 0.35) : villagers.length;
        villagers.slice(0, out).sort((a, b) => (a.x + a.y) - (b.x + b.y)).forEach(v => {
            const [cx, cy] = tileCenter(v.x, v.y);
            const bob = v.t < 1 ? Math.abs(Math.sin(v.t * Math.PI * 2)) * 2.4 * S : 0, k = 1.35 * S;
            ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(cx, cy, 4.5 * k, 2.2 * k, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = tint(v.shirt, -0.25); ctx.fillRect(cx - 2.2 * k, cy - 3 * k - bob, 1.6 * k, 3 * k); ctx.fillRect(cx + 0.6 * k, cy - 3 * k - bob, 1.6 * k, 3 * k);
            ctx.fillStyle = tint(v.shirt); ctx.beginPath(); ctx.ellipse(cx, cy - 6 * k - bob, 3.6 * k, 4.4 * k, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = tint(v.skin); ctx.beginPath(); ctx.arc(cx, cy - 12 * k - bob, 3 * k, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = tint(['#3b2a20', '#7a4b2a', '#d9a066', '#1f1f1f'][v.i % 4]); ctx.beginPath(); ctx.arc(cx, cy - 13 * k - bob, 3 * k, Math.PI, Math.PI * 2); ctx.fill();
            if (v.hearts > 0) { v.hearts -= dt; ctx.font = `${10 * S}px sans-serif`; ctx.fillText('❤️', cx - 5 * S, cy - (20 + (1.5 - v.hearts) * 10) * S); }
        });
        // Particles (smoke, fountain drops, sparkles).
        particles = particles.filter(p => (p.life -= dt) > 0);
        particles.forEach(p => {
            p.x += p.vx * dt * S; p.y += p.vy * dt * S; if (p.g) p.vy += p.g * dt;
            if (p.kind === 'smoke') { ctx.fillStyle = `rgba(${DARK > 0.3 ? '160,170,190' : '235,235,235'},${Math.min(0.5, p.life / 3)})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (2.6 - p.life * 0.6), 0, Math.PI * 2); ctx.fill(); }
            else if (p.kind === 'drop') { ctx.fillStyle = 'rgba(200,235,255,.9)'; ctx.fillRect(p.x, p.y, p.r, p.r); }
            else if (p.kind === 'spark') { ctx.fillStyle = `rgba(255,220,120,${p.life})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); }
        });
        if (particles.length > 400) particles.splice(0, particles.length - 400);
        // Night: warm light pools, then fireflies.
        if (DARK > 0.15) {
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            fx.filter(f => f.k === 'glow').forEach(f => {
                const r = f.r * S, g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
                g.addColorStop(0, `rgba(255,190,90,${f.a * DARK * 1.4})`); g.addColorStop(1, 'rgba(255,190,90,0)');
                ctx.fillStyle = g; ctx.fillRect(f.x - r, f.y - r, r * 2, r * 2);
            });
            if (DARK > 0.3) for (let i = 0; i < 18; i++) {
                const x = view.w / 2 + Math.sin(time * 0.3 + i * 7.1) * view.w * 0.35, y = view.h / 2 + Math.cos(time * 0.4 + i * 3.3) * view.h * 0.25;
                ctx.fillStyle = `rgba(220,255,140,${0.35 + 0.35 * Math.sin(time * 3 + i)})`; ctx.beginPath(); ctx.arc(x, y, 1.6 * S, 0, Math.PI * 2); ctx.fill();
            }
            ctx.restore();
        }
        // Build ghost / hover.
        if (mode.hover && inArea(mode.hover.x, mode.hover.y)) {
            const { x, y } = mode.hover, [cx, cy] = tileCenter(x, y);
            const ok = mode.build ? canPlace(mode.build, x, y) : true;
            poly(ctx, [[cx, cy - HH], [cx + HW, cy], [cx, cy + HH], [cx - HW, cy]], mode.build ? (ok ? 'rgba(80,220,120,.35)' : 'rgba(240,80,80,.35)') : 'rgba(255,255,255,.18)', mode.build ? (ok ? '#2fbf71' : '#e5484d') : 'rgba(255,255,255,.6)');
            if (mode.build && ok) { ctx.globalAlpha = 0.65; DRAW[mode.build](ctx, cx, cy, [], { x, y, v: 0, t: mode.build }); ctx.globalAlpha = 1; }
        }
        if (mode.selected) {
            const [cx, cy] = tileCenter(mode.selected.x, mode.selected.y);
            poly(ctx, [[cx, cy - HH], [cx + HW, cy], [cx, cy + HH], [cx - HW, cy]], null, '#ffd166');
        }
    }

    function start() {
        if (raf || !canvas) return;
        lastFrame = 0;
        raf = requestAnimationFrame(drawFrame);
    }
    function stop() { if (raf) cancelAnimationFrame(raf); raf = null; }

    // ── Input ────────────────────────────────────────────────────────
    function toTile(ev) {
        const r = canvas.getBoundingClientRect();
        const sx = ev.clientX - r.left - view.ox, sy = ev.clientY - r.top - view.oy;
        const u = (sx / HW + sy / HH) / 2, v = (sy / HH - sx / HW) / 2;
        return { x: Math.round(u), y: Math.round(v) };
    }
    function canPlace(type, x, y) {
        if (!inArea(x, y) || buildingAt(x, y)) return false;
        const k = tileAt(x, y).kind;
        if (k !== 'grass' && !(k === 'sand' && ['tree', 'flowers', 'lantern'].includes(type))) return false;
        if (B[type].unique && count(st, type)) return false;
        return true;
    }
    function place(type, x, y) {
        const def = B[type];
        if (st.coins < def.cost) return note(`Need 🪙 ${fmt(def.cost - st.coins)} more for a ${def.name}.`, true);
        if (!canPlace(type, x, y)) return note('Can\'t build there.', true);
        st.coins -= def.cost;
        st.buildings.push({ t: type, x, y, v: Math.floor(Math.random() * 9) });
        st.stats.built++;
        if (type === 'house' || type === 'manor') note(`${def.name} built — room for ${def.housing} more villagers.`);
        burst(x, y);
        staticKey = '';
        save(); renderHud(); paletteDirty = true; renderSide(); checkQuest();
        if (def.cost > 40 || st.coins < def.cost) setBuild(null);
    }
    function burst(x, y) {
        const [cx, cy] = tileCenter(x, y);
        for (let i = 0; i < 18; i++) particles.push({ x: cx, y: cy - 10 * S, vx: (Math.random() - 0.5) * 50, vy: -20 - Math.random() * 30, g: 60, life: 0.9, r: 1.8 * S, kind: 'spark' });
    }
    function onClick(ev) {
        const { x, y } = toTile(ev);
        mode.hover = { x, y };
        // Villager?
        const r = canvas.getBoundingClientRect(), px = ev.clientX - r.left, py = ev.clientY - r.top;
        const v = villagers.find(v => { const [cx, cy] = tileCenter(v.x, v.y); return Math.hypot(cx - px, cy - 8 * S - py) < 9 * S; });
        if (v && !mode.build) return villagerBubble(v, px, py);
        if (mode.build) return place(mode.build, x, y);
        if (!inArea(x, y)) { mode.selected = null; return hidePop(); }
        const b = buildingAt(x, y), t = tileAt(x, y);
        if (b) { mode.selected = b; return buildingPop(b, px, py); }
        if (t.kind === 'wild' || t.kind === 'rock') { mode.selected = { x, y }; return clearPop(x, y, px, py, t.kind); }
        mode.selected = null; hidePop();
    }

    // ── UI ───────────────────────────────────────────────────────────
    const $ = id => document.getElementById(id);
    function note(msg, warn) {
        const box = $('town-notes');
        if (!box) return;
        const el = document.createElement('div');
        el.className = `town-note ${warn ? 'warn' : ''}`;
        el.textContent = msg;
        box.prepend(el);
        while (box.children.length > 3) box.lastChild.remove();
        setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 400); }, 4200);
    }
    function showCard(html) {
        const c = $('town-card');
        c.innerHTML = `<div class="town-card-inner">${html}</div>`;
        c.hidden = false;
        c.querySelectorAll('[data-close]').forEach(b => b.onclick = () => { c.hidden = true; });
    }
    function popAt(px, py, html) {
        const p = $('town-pop');
        p.innerHTML = html;
        p.hidden = false;
        const w = p.offsetWidth, h = p.offsetHeight;
        p.style.left = clamp(px - w / 2, 8, view.w - w - 8) + 'px';
        p.style.top = clamp(py - h - 18, 8, view.h - h - 8) + 'px';
    }
    function hidePop() { const p = $('town-pop'); if (p) p.hidden = true; }
    function villagerBubble(v, px, py) {
        const moods = st.happy > 75 ? ['Life is good here! 😊', 'I love this town!', 'Smell that bread? 🍞'] : st.happy > 45 ? ['Nice day, isn\'t it?', 'Could use more flowers 🌸', 'Back to work!'] : ['I\'m a bit hungry… 😟', 'We need more food.', 'It\'s gloomy lately.'];
        popAt(px, py, `<div class="font-black">${esc(v.name)}</div><div class="text-xs text-slate-500 mb-2">${moods[v.i % moods.length]}</div>
            <button class="town-btn primary w-full" data-act="treat">Give a treat 🍞 <span class="opacity-70">(1 food)</span></button>`);
        $('town-pop').querySelector('[data-act=treat]').onclick = () => {
            if (st.food < 1) return note('No food to give — build a field.', true);
            st.food -= 1; st.happy = Math.min(100, st.happy + 1.5); v.hearts = 1.5;
            renderHud(); saveSoon(); hidePop();
        };
    }
    function buildingPop(b, px, py) {
        const d = B[b.t];
        popAt(px, py, `<div class="font-black">${d.name}</div><div class="text-xs text-slate-500 mb-2">${d.desc}</div>
            ${d.fixed ? '' : `<button class="town-btn w-full" data-act="sell">Demolish (+🪙 ${Math.floor(d.cost / 2)})</button>`}`);
        const sell = $('town-pop').querySelector('[data-act=sell]');
        if (sell) sell.onclick = () => {
            if ((d.housing || 0) && housing() - d.housing < st.pop) return note('Villagers live there! Build another home first.', true);
            st.buildings = st.buildings.filter(x => x !== b);
            st.coins += Math.floor(d.cost / 2);
            mode.selected = null; staticKey = ''; hidePop(); save(); renderHud(); paletteDirty = true; renderSide();
        };
    }
    function clearPop(x, y, px, py, kind) {
        const cost = kind === 'rock' ? 6 : 3;
        popAt(px, py, `<div class="font-black">${kind === 'rock' ? 'Boulder' : 'Wild tree'}</div><div class="text-xs text-slate-500 mb-2">Clear it to make room to build.</div>
            <button class="town-btn primary w-full" data-act="clear">Clear for 🪙 ${cost}</button>`);
        $('town-pop').querySelector('[data-act=clear]').onclick = () => {
            if (st.coins < cost) return note('Not enough coins yet.', true);
            st.coins -= cost; st.cleared.push(y * N + x); tileAt(x, y).kind = 'grass';
            mode.selected = null; staticKey = ''; burst(x, y); hidePop(); save(); renderHud();
        };
    }
    function setZoom(z) {
        zoom = clamp(z, 0.8, 3);
        if (zoom <= 1) pan = { x: 0, y: 0 };
        layout();
    }
    function setBuild(type) {
        mode.build = mode.build === type ? null : type;
        mode.selected = null; hidePop();
        document.querySelectorAll('[data-build]').forEach(b => b.classList.toggle('active', b.dataset.build === mode.build));
        $('town-build-hint').textContent = mode.build ? `Tap a green tile to place a ${B[mode.build].name}. Tap the card again to stop.` : 'Pick something to build, or tap villagers and buildings.';
    }

    function renderHud() {
        const hud = $('town-hud');
        if (!hud || !st) return;
        const r = rates(), L = LEVELS[level()], next = LEVELS[level() + 1];
        const happyCol = st.happy > 70 ? '#22c55e' : st.happy > 40 ? '#eab308' : '#ef4444';
        hud.innerHTML = `
            <div class="town-stat"><span>🪙</span><b>${fmt(st.coins)}</b><small>+${r.coins.toFixed(1)}/min</small></div>
            <div class="town-stat"><span>🍞</span><b>${fmt(st.food)}</b><small class="${r.food < 0 ? 'neg' : ''}">${r.food >= 0 ? '+' : ''}${r.food.toFixed(1)}/min</small></div>
            <div class="town-stat"><span>👥</span><b>${st.pop}<span class="opacity-50">/${housing()}</span></b><small>${st.pop >= housing() ? 'need homes' : 'homes free'}</small></div>
            <div class="town-stat wide"><span>😊</span><div class="flex-1"><div class="h-2 rounded-full bg-black/10 overflow-hidden"><div class="h-full rounded-full" style="width:${st.happy}%;background:${happyCol}"></div></div><small>${Math.round(st.happy)}% happy</small></div></div>
            <div class="town-stat wide"><span>🏅</span><div class="flex-1"><b class="text-sm">${L.name}</b>${next ? `<div class="h-1.5 rounded-full bg-black/10 overflow-hidden mt-1"><div class="h-full rounded-full bg-indigo-500" style="width:${(st.pop - L.pop) / (next.pop - L.pop) * 100}%"></div></div><small>${next.pop - st.pop} villagers to ${next.name}</small>` : '<small>Max level!</small>'}</div></div>`;
        const banner = $('town-focus-banner');
        if (banner) {
            banner.hidden = !r.focusing;
            if (r.focusing) { const m = Math.floor((app.timerTime || 0) / 60), s = (app.timerTime || 0) % 60; banner.innerHTML = `⚡ Focus boost ×${FOCUS_MULT} · ${m}:${String(s).padStart(2, '0')} left`; }
        }
        const fbtn = $('town-focus-btns');
        if (fbtn) fbtn.hidden = r.focusing;
        if (paletteDirty) renderPalette();
        else document.querySelectorAll('[data-build]').forEach(b => { const d = B[b.dataset.build]; b.classList.toggle('poor', st.coins < d.cost); });
    }

    const previews = {};
    function preview(type) {
        if (previews[type]) return previews[type];
        const c = document.createElement('canvas'), dpr = 2;
        c.width = 72 * dpr; c.height = 72 * dpr;
        const x = c.getContext('2d'); x.scale(dpr, dpr);
        const sv = [S, HW, HH, DARK]; S = 0.95; HW = 32 * S; HH = 16 * S; DARK = 0;
        poly(x, [[36, 52 - HH], [36 + HW, 52], [36, 52 + HH], [36 - HW, 52]], '#8fd07c');
        DRAW[type](x, 36, 52, [], { x: 3, y: 5, v: 0, t: type });
        [S, HW, HH, DARK] = sv;
        return (previews[type] = c.toDataURL());
    }
    function renderPalette() {
        paletteDirty = false;
        const el = $('town-palette');
        if (!el) return;
        const lv = level();
        el.innerHTML = BUILD_ORDER.map(t => {
            const d = B[t], locked = d.level > lv, owned = d.unique && count(st, t);
            return `<button data-build="${t}" class="town-item ${locked ? 'locked' : ''} ${st.coins < d.cost ? 'poor' : ''} ${mode.build === t ? 'active' : ''}" ${locked || owned ? 'disabled' : ''} title="${esc(d.desc)}">
                <img src="${preview(t)}" alt="" width="56" height="56">
                <span class="name">${d.name}</span>
                <span class="cost">${locked ? `🔒 ${LEVELS[d.level].name}` : owned ? 'Built' : '🪙 ' + d.cost}</span>
            </button>`;
        }).join('');
        el.querySelectorAll('[data-build]').forEach(b => b.onclick = () => setBuild(b.dataset.build));
    }
    function renderSide() {
        const q = $('town-quest');
        if (!q || !st) return;
        const cur = QUESTS[st.quest];
        q.innerHTML = cur ? `
            <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Quest ${st.quest + 1} of ${QUESTS.length}</div>
            <div class="font-bold mb-2">${esc(cur.text)}</div>
            ${cur.test(st) ? `<button class="town-btn primary w-full" data-act="claim">Claim 🪙 ${cur.reward}</button>` : `<div class="text-xs text-slate-500">Reward: 🪙 ${cur.reward}</div>`}`
            : '<div class="font-bold">All quests done — your town is legendary! 🏆</div>';
        const claim = q.querySelector('[data-act=claim]');
        if (claim) claim.onclick = claimQuest;
        renderPalette();
    }

    function mount() {
        const root = document.getElementById('focustown');
        if (!root || root.dataset.town) return;
        root.dataset.town = '1';
        root.innerHTML = `
            <div class="town max-w-7xl mx-auto pb-24 md:pb-8">
                <div class="flex flex-wrap items-end justify-between gap-3 mb-4">
                    <div>
                        <div class="text-[11px] font-bold uppercase tracking-[.16em] text-slate-400">Focus Town</div>
                        <input id="town-name" maxlength="24" class="town-name" aria-label="Town name">
                    </div>
                    <div class="flex gap-2">
                        <button class="town-btn" data-act="feed" title="Buy food for your villagers">🍞 Buy food <span class="opacity-60">🪙10</span></button>
                        <button class="town-btn" data-act="help">How it works</button>
                    </div>
                </div>
                <div id="town-hud" class="town-hud"></div>
                <div class="grid lg:grid-cols-[1fr_330px] gap-4 mt-4">
                    <div class="town-stage">
                        <canvas id="town-canvas" aria-label="Your town. Tap to build."></canvas>
                        <div id="town-focus-banner" class="town-banner" hidden></div>
                        <div id="town-notes" class="town-notes" aria-live="polite"></div>
                        <div id="town-pop" class="town-pop" hidden></div>
                        <div id="town-card" class="town-card" hidden></div>
                        <div class="town-zoom">
                            <button data-zoom="in" aria-label="Zoom in">＋</button>
                            <button data-zoom="out" aria-label="Zoom out">−</button>
                            <button data-zoom="reset" aria-label="Reset view">⤢</button>
                        </div>
                    </div>
                    <aside class="space-y-4">
                        <div class="town-panel">
                            <div class="font-black mb-1">Focus to grow faster</div>
                            <p class="text-xs text-slate-500 mb-3">Your town earns ×${FOCUS_MULT} coins while a focus session runs, and keeps earning while this tab stays open.</p>
                            <div id="town-focus-btns" class="flex gap-2">
                                <button class="town-btn primary flex-1" data-focus="25">▶ Focus 25 min</button>
                                <button class="town-btn flex-1" data-focus="50">50 min</button>
                            </div>
                        </div>
                        <div id="town-quest" class="town-panel"></div>
                        <div class="town-panel">
                            <div class="flex items-center justify-between mb-2"><div class="font-black">Build</div><button class="text-xs font-bold text-slate-400 hover:text-slate-600" data-act="cancel">Cancel</button></div>
                            <p id="town-build-hint" class="text-xs text-slate-500 mb-3"></p>
                            <div id="town-palette" class="town-palette"></div>
                        </div>
                    </aside>
                </div>
            </div>`;
        canvas = $('town-canvas');
        ctx = canvas.getContext('2d');
        const nameInput = $('town-name');
        nameInput.value = st.name;
        nameInput.onchange = () => { st.name = nameInput.value.trim().slice(0, 24) || 'Hearthvale'; nameInput.value = st.name; save(); };
        // Tap/click to act; drag to pan (useful when zoomed in on phones).
        let down = null;
        canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y, moved: false }; });
        canvas.addEventListener('pointermove', e => {
            if (down && (Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y) > 8)) {
                down.moved = true;
                pan.x = down.px + e.clientX - down.x; pan.y = down.py + e.clientY - down.y;
                layout();
                hidePop();
            } else if (e.pointerType === 'mouse') mode.hover = toTile(e);
        });
        canvas.addEventListener('pointerup', e => { const d = down; down = null; if (d && !d.moved) onClick(e); });
        canvas.addEventListener('pointercancel', () => { down = null; });
        canvas.addEventListener('mouseleave', () => { mode.hover = null; });
        canvas.addEventListener('wheel', e => { e.preventDefault(); setZoom(zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12)); }, { passive: false });
        root.querySelectorAll('[data-zoom]').forEach(b => b.onclick = () => {
            const z = b.dataset.zoom;
            if (z === 'reset') { pan = { x: 0, y: 0 }; setZoom(1); } else setZoom(zoom * (z === 'in' ? 1.25 : 0.8));
        });
        root.querySelectorAll('[data-focus]').forEach(b => b.onclick = () => {
            if (app.timerRunning) return note('A focus session is already running.');
            app.setTimerMode(Number(b.dataset.focus));
            app.startTimer();
            app.requestWakeLock && app.requestWakeLock();
            note(`⚡ Focus session started — ×${FOCUS_MULT} coins until it ends.`);
            renderHud();
        });
        root.querySelector('[data-act=feed]').onclick = () => {
            if (st.coins < 10) return note('Not enough coins.', true);
            const cap = rates().foodCap;
            if (st.food >= cap) return note('Granary is full! Build fields or a bakery for more storage.', true);
            st.coins -= 10; st.food = Math.min(cap, st.food + 15); renderHud(); saveSoon();
            note('🍞 Bought 15 food for the villagers.');
        };
        root.querySelector('[data-act=cancel]').onclick = () => setBuild(null);
        root.querySelector('[data-act=help]').onclick = () => {
            showCard(`
            <div class="font-black text-lg mb-2">How Focus Town works</div>
            <ul class="text-sm text-slate-600 space-y-1.5 mb-4 list-disc pl-5">
                <li><b>Coins</b> come in every minute this tab is open, more with more villagers, markets and happiness, and <b>×${FOCUS_MULT}</b> while you focus.</li>
                <li><b>Food</b> comes from wheat fields and bakeries. Each villager eats a little. Run out and villagers get sad, then leave.</li>
                <li><b>Villagers</b> move in when there's a free home, food in the granary and they're happy. Tap one to give a treat.</li>
                <li><b>Happiness</b> rises with trees, flowers, lanterns, a well and fountains.</li>
                <li><b>Grow</b> to unlock new buildings and more land. Clear wild trees and boulders to make room.</li>
                <li>Closed tabs earn ${Math.round(OFFLINE_RATE * 100)}% for up to 12 hours. Finishing tasks, chores and focus sessions anywhere in WebDesks also pays your town.</li>
            </ul>
            <div class="flex gap-2"><button class="town-btn primary flex-1" data-close>Got it</button><button class="town-btn" data-act="reset">Start over</button></div>`);
            $('town-card').querySelector('[data-act=reset]').onclick = async () => {
                if (!confirm('Start a brand-new town? Your current town will be gone.')) return;
                st = newTown(); save(); villagers = [];
                await makeTerrain();
                layout(); syncVillagers(); renderHud(); renderSide();
                $('town-card').hidden = true;
                $('town-name').value = st.name;
            };
        };
        new ResizeObserver(() => { if (app.currentTab === 'focustown') layout(); }).observe(canvas.parentElement);
        setBuild(null);
    }

    async function boot() {
        load();
        mount();
        $('town-name').value = st.name;
        villagers = [];
        await makeTerrain();
        syncVillagers();
        const away = (Date.now() - st.lastTick) / 60000;
        if (away > 5) welcomeBack(away); else st.lastTick = Date.now();
        dailyGift();
        paletteDirty = true;
        renderHud(); renderSide();
        if (st._welcome) { note(st._welcome); delete st._welcome; save(); }
        clearInterval(tickTimer);
        tickTimer = setInterval(tick, 5000);
        if (app.currentTab === 'focustown') { layout(); start(); }
    }

    // ── Wire into WebDesks ───────────────────────────────────────────
    const orig = { completeTimer: app.completeTimer, toggleTask: app.toggleTask, completeChore: app.completeChore };
    Object.assign(app, {
        async initFocusTown() {
            await boot();
            window.addEventListener('pagehide', save);
        },
        // Small seams for tests and future tooling.
        _townState: () => st,
        _townSaveNow: () => save(),
        _townReload: () => boot(),
        ftStartAnimLoop() { if (!st) return; layout(); start(); },
        ftStopAnimLoop() { stop(); hidePop(); },
        ftResizeCanvas() { layout(); },
        townReward: reward,
        completeTimer() {
            const mins = app.timerMode || 25;
            orig.completeTimer.call(this);
            if (!st) return;
            st.stats.sessions++;
            // Focus streak shown on the dashboard.
            const today = todayStr(), last = localStorage.getItem('wd_ft_lastdate');
            const y = new Date(); y.setDate(y.getDate() - 1);
            const yStr = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
            if (last !== today) {
                const streak = last === yStr ? parseInt(localStorage.getItem('wd_ft_streak') || '0', 10) + 1 : 1;
                localStorage.setItem('wd_ft_streak', String(streak));
                localStorage.setItem('wd_ft_lastdate', today);
                app.updateFocusStats && app.updateFocusStats();
            }
            reward(Math.round(mins * 2), `🎯 ${mins}-minute focus session done!`);
            checkQuest(); renderSide();
        },
        toggleTask(index) {
            const wasDone = this.tasks[index] && this.tasks[index].done;
            orig.toggleTask.call(this, index);
            if (!wasDone && this.tasks[index] && this.tasks[index].done && !this.tasks[index]._paid) {
                this.tasks[index]._paid = true;
                reward(3, '✅ Task done!');
            }
        }
    });
    if (orig.completeChore) app.completeChore = function (id) {
        const c = (this.chores || []).find(x => x.id === id);
        const was = c && c.lastDone === todayStr();
        orig.completeChore.call(this, id);
        if (c && !was && c.lastDone === todayStr()) reward(5, `🧹 ${c.name} done!`);
    };
    document.addEventListener('visibilitychange', () => { if (!document.hidden && st) tick(); });
})();

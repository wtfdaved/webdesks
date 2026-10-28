/* ═══════════════════════════════════════════════════════════════
   WebDesks Sound — ad-free music + ambience mixer.

   Music has two sources, neither of which plays ads:
     • WebDesks Lo-fi — music composed live in the browser with
       Tone.js (https://github.com/Tonejs/Tone.js). Endless, works
       offline once cached, and every track is new.
     • Radio — listener-supported SomaFM channels streamed with
       howler.js (https://github.com/goldfire/howler.js).

   The ambience mixer synthesises every sound procedurally with the
   Web Audio API (rain, thunder, waves, wind, a creek, a fireplace,
   café chatter, birds, crickets, a fan, noise colours and vinyl),
   so nothing is downloaded and no two minutes sound the same.

   Media Session gives lock-screen / keyboard media-key controls.
   ═══════════════════════════════════════════════════════════════ */
(() => {
    const TONE_URL = 'https://cdn.jsdelivr.net/npm/tone@15.1.22/build/Tone.js';
    const HOWLER_URL = 'https://cdn.jsdelivr.net/npm/howler@2.2.4/dist/howler.core.min.js';
    const STATE_KEY = 'wd_sound';
    const MIXES_KEY = 'wd_mixes';
    const SR = 32000; // offline-rendered buffers; the browser resamples on playback

    const STATIONS = [
        { id: 'lofi', kind: 'gen', gain: 1, name: 'Lo-fi Beats', desc: 'Dusty keys, lazy drums', c: ['#6d5dfc', '#f472b6'],
          bpm: [76, 86], swing: 0.3, sub: '16n', cutoff: 2400, bpc: 1, drums: 'boom', keys: 'comp', pad: false, lead: 0.6, bass: 'lofi', verb: 0.25, bars: 48 },
        { id: 'jazz', kind: 'gen', gain: 1.2, name: 'Jazzy Café', desc: 'Swing comping, brushes & ride', c: ['#f59e0b', '#ef4444'],
          bpm: [88, 98], swing: 0.5, sub: '8n', cutoff: 3400, bpc: 1, drums: 'jazz', keys: 'jazz', pad: false, lead: 0.45, bass: 'walk', verb: 0.3, bars: 48 },
        { id: 'night', kind: 'gen', gain: 1.7, name: 'Night Chill', desc: 'Slow, warm and spacious', c: ['#0ea5e9', '#6366f1'],
          bpm: [66, 74], swing: 0.25, sub: '16n', cutoff: 1700, bpc: 2, drums: 'half', keys: 'long', pad: true, lead: 0.35, bass: 'long', verb: 0.45, bars: 40 },
        { id: 'ambient', kind: 'gen', gain: 2.2, name: 'Deep Focus', desc: 'Beatless pads for flow', c: ['#10b981', '#0ea5e9'],
          bpm: [58, 62], swing: 0, sub: '8n', cutoff: 1300, bpc: 2, drums: null, keys: 'sparse', pad: true, lead: 0.2, bass: 'long', verb: 0.6, bars: 32 },
        { id: 'fluid', kind: 'radio', name: 'Fluid', desc: 'Instrumental hip-hop & future soul', c: ['#8b5cf6', '#06b6d4'] },
        { id: 'groovesalad', kind: 'radio', name: 'Groove Salad', desc: 'Ambient beats & grooves', c: ['#22c55e', '#84cc16'] },
        { id: 'lush', kind: 'radio', name: 'Lush', desc: 'Mellow vocals, chill electronica', c: ['#ec4899', '#f97316'] },
        { id: 'dronezone', kind: 'radio', name: 'Drone Zone', desc: 'Atmospheric textures, no beats', c: ['#334155', '#6366f1'] },
        { id: 'deepspaceone', kind: 'radio', name: 'Deep Space One', desc: 'Deep ambient & space music', c: ['#1e3a8a', '#7c3aed'] },
    ];
    const RADIO_HOSTS = ['ice2.somafm.com', 'ice1.somafm.com', 'ice4.somafm.com', 'ice6.somafm.com'];
    const station = id => STATIONS.find(s => s.id === id) || STATIONS[0];

    const CHANNELS = [
        { id: 'rain', name: 'Rain', icon: 'cloud-rain', group: 'Weather', level: 1.7, def: 0.5 },
        { id: 'thunder', name: 'Thunder', icon: 'cloud-lightning', group: 'Weather', level: 2.0, def: 0.4 },
        { id: 'wind', name: 'Wind', icon: 'wind', group: 'Weather', level: 3, def: 0.35 },
        { id: 'ocean', name: 'Waves', icon: 'waves', group: 'Nature', level: 1.5, def: 0.5 },
        { id: 'stream', name: 'Creek', icon: 'droplets', group: 'Nature', level: 2.8, def: 0.4 },
        { id: 'birds', name: 'Birds', icon: 'bird', group: 'Nature', level: 1.9, def: 0.4 },
        { id: 'crickets', name: 'Night', icon: 'moon-star', group: 'Nature', level: 2, def: 0.35 },
        { id: 'fire', name: 'Fireplace', icon: 'flame', group: 'Indoors', level: 1.6, def: 0.5 },
        { id: 'cafe', name: 'Café', icon: 'coffee', group: 'Indoors', level: 2.5, def: 0.4 },
        { id: 'fan', name: 'Fan', icon: 'fan', group: 'Indoors', level: 2.1, def: 0.4 },
        { id: 'vinyl', name: 'Vinyl', icon: 'disc-3', group: 'Indoors', level: 5, def: 0.35 },
        { id: 'white', name: 'White', icon: 'audio-lines', group: 'Noise', level: 3, def: 0.3 },
        { id: 'pink', name: 'Pink', icon: 'audio-lines', group: 'Noise', level: 2.5, def: 0.35 },
        { id: 'brown', name: 'Brown', icon: 'audio-lines', group: 'Noise', level: 1.5, def: 0.45 },
    ];
    const chan = id => CHANNELS.find(c => c.id === id);

    const PRESETS = [
        { id: 'focus', name: 'Deep Focus', emoji: '🎯', mix: { brown: 0.5, rain: 0.25 } },
        { id: 'rainycafe', name: 'Rainy Café', emoji: '☕', mix: { cafe: 0.45, rain: 0.4, thunder: 0.2 } },
        { id: 'storm', name: 'Thunderstorm', emoji: '⛈️', mix: { rain: 0.65, thunder: 0.6, wind: 0.3 } },
        { id: 'beach', name: 'Beach', emoji: '🏖️', mix: { ocean: 0.6, wind: 0.2, birds: 0.12 } },
        { id: 'forest', name: 'Forest Morning', emoji: '🌲', mix: { birds: 0.5, stream: 0.35, wind: 0.15 } },
        { id: 'cabin', name: 'Cozy Cabin', emoji: '🔥', mix: { fire: 0.6, rain: 0.3, wind: 0.15 } },
        { id: 'summer', name: 'Summer Night', emoji: '🌙', mix: { crickets: 0.5, stream: 0.2, wind: 0.1 } },
        { id: 'sleep', name: 'Sleep', emoji: '😴', mix: { brown: 0.4, ocean: 0.35, fan: 0.2 } },
    ];

    // ── State ─────────────────────────────────────────────────────
    const S = Object.assign({ station: 'lofi', musicVol: 0.7, master: 0.85, vols: {}, last: [] },
        readJSON(STATE_KEY, {}));
    CHANNELS.forEach(c => { if (typeof S.vols[c.id] !== 'number') S.vols[c.id] = c.def; });
    let mixes = readJSON(MIXES_KEY, []);

    function readJSON(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
    let saveT = 0;
    function save() {
        clearTimeout(saveT);
        saveT = setTimeout(() => { try { localStorage.setItem(STATE_KEY, JSON.stringify(S)); } catch (e) {} }, 300);
    }
    const toast = m => { try { app.showToast(m); } catch (e) {} };
    const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const rand = (a, b) => a + Math.random() * (b - a);
    const pick = a => a[Math.floor(Math.random() * a.length)];

    // ── Shared audio graph ───────────────────────────────────────
    // master → compressor → analyser → speakers; music and ambience
    // have their own buses so the volume sliders stay independent.
    let ctx = null, master, musicBus, ambBus, analyser, room;
    function ensureCtx() {
        if (!ctx) {
            ctx = app.audioCtx || new (window.AudioContext || window.webkitAudioContext)();
            app.audioCtx = ctx;
            master = ctx.createGain();
            master.gain.value = S.master;
            const comp = ctx.createDynamicsCompressor();
            comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 3;
            comp.attack.value = 0.01; comp.release.value = 0.3;
            analyser = ctx.createAnalyser();
            analyser.fftSize = 64;
            analyser.smoothingTimeConstant = 0.8;
            master.connect(comp); comp.connect(analyser); analyser.connect(ctx.destination);
            musicBus = ctx.createGain(); musicBus.gain.value = curve(S.musicVol); musicBus.connect(master);
            ambBus = ctx.createGain(); ambBus.connect(master);
            room = ctx.createConvolver(); room.buffer = roomIR(); room.connect(ambBus);
            app.mixerMasterGain = master;
        }
        if (ctx.state !== 'running') ctx.resume().catch(() => {});
        return ctx;
    }
    const curve = v => Math.pow(v, 1.5); // perceptual-ish volume

    // A looping silent <audio> keeps WebAudio alive in the background on
    // iOS (and lets it play with the ringer switch off) and gives the
    // Media Session something to attach lock-screen controls to.
    let keepAlive = null;
    function keepAliveOn(on) {
        try {
            if (on) {
                if (!keepAlive) {
                    keepAlive = new Audio(silentWav());
                    keepAlive.loop = true;
                    keepAlive.setAttribute('playsinline', '');
                    keepAlive.volume = 0.01;
                }
                if (keepAlive.paused) keepAlive.play().catch(() => {});
            } else if (keepAlive && !keepAlive.paused) keepAlive.pause();
        } catch (e) {}
    }
    function silentWav() {
        const n = 8000, b = new ArrayBuffer(44 + n * 2), v = new DataView(b);
        const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
        w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
        v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
        v.setUint32(24, 8000, true); v.setUint32(28, 16000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
        w(36, 'data'); v.setUint32(40, n * 2, true);
        return URL.createObjectURL(new Blob([b], { type: 'audio/wav' }));
    }

    // ═════════════════════════════════════════════════════════════
    // DSP helpers (offline buffer rendering)
    // ═════════════════════════════════════════════════════════════
    const white = () => Math.random() * 2 - 1;
    function pinkGen() {
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        return () => {
            const w = white();
            b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
            b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856;
            b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
            const o = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
            b6 = w * 0.115926;
            return o * 0.11;
        };
    }
    function brownGen() { let l = 0; return () => { l = (l + 0.02 * white()) / 1.02; return l * 3.5; }; }
    // one-pole lowpass with settable cutoff
    function lp1(f, sr) {
        let y = 0, a = 1 - Math.exp(-2 * Math.PI * f / sr);
        const run = x => (y += a * (x - y));
        run.set = nf => { a = 1 - Math.exp(-2 * Math.PI * nf / sr); };
        return run;
    }
    function hp1(f, sr) { const l = lp1(f, sr); const run = x => x - l(x); run.set = l.set; return run; }
    // RBJ biquad
    function biquad(type, f, q, sr) {
        let b0, b1, b2, a1, a2, x1 = 0, x2 = 0, y1 = 0, y2 = 0;
        const set = (nf, nq = q) => {
            const w = 2 * Math.PI * Math.min(nf, sr * 0.45) / sr, cs = Math.cos(w), al = Math.sin(w) / (2 * nq);
            let n0, n1, n2;
            if (type === 'bp') { n0 = al; n1 = 0; n2 = -al; }
            else if (type === 'hp') { n0 = (1 + cs) / 2; n1 = -(1 + cs); n2 = (1 + cs) / 2; }
            else { n0 = (1 - cs) / 2; n1 = 1 - cs; n2 = (1 - cs) / 2; }
            const a0 = 1 + al;
            b0 = n0 / a0; b1 = n1 / a0; b2 = n2 / a0; a1 = -2 * cs / a0; a2 = (1 - al) / a0;
        };
        set(f, q);
        const run = x => {
            const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
            x2 = x1; x1 = x; y2 = y1; y1 = y;
            return y;
        };
        run.set = set;
        return run;
    }
    // slowly wandering value in [lo, hi]
    function wander(lo, hi, minS, maxS, sr) {
        let v = rand(lo, hi), tgt = rand(lo, hi), left = 0;
        const k = 1 / (sr * 0.8);
        return () => {
            if (--left <= 0) { tgt = rand(lo, hi); left = Math.floor(rand(minS, maxS) * sr); }
            v += (tgt - v) * k * 3;
            return v;
        };
    }
    function rms(a) { let s = 0; for (let i = 0; i < a.length; i += 7) s += a[i] * a[i]; return Math.sqrt(s / (a.length / 7)) || 1; }
    function scaleTo(a, target) { const g = target / rms(a); for (let i = 0; i < a.length; i++) a[i] *= g; }

    // Render a stereo loop: fill() writes n + crossfade samples per
    // channel and the tail is blended into the head for a seamless loop.
    function bed(sec, fill, { xf = 1.5, target = 0.16, sr = SR } = {}) {
        const n = Math.floor(sec * sr), x = Math.floor(xf * sr);
        const b = ctx.createBuffer(2, n, sr);
        for (let c = 0; c < 2; c++) {
            const t = new Float32Array(n + x);
            fill(t, c, sr);
            if (target) scaleTo(t, target);
            const d = b.getChannelData(c);
            d.set(t.subarray(0, n));
            for (let i = 0; i < x; i++) { const a = i / x; d[i] = t[i] * Math.sqrt(a) + t[n + i] * Math.sqrt(1 - a); }
        }
        return b;
    }
    function oneShot(sec, fill, sr = SR) {
        const n = Math.max(1, Math.floor(sec * sr));
        const b = ctx.createBuffer(1, n, sr);
        fill(b.getChannelData(0), sr);
        return b;
    }
    function roomIR() {
        const sr = ctx.sampleRate, n = Math.floor(sr * 1.8), b = ctx.createBuffer(2, n, sr); // convolver needs the context rate
        for (let c = 0; c < 2; c++) {
            const d = b.getChannelData(c), l = lp1(4000, sr);
            for (let i = 0; i < n; i++) d[i] = l(white()) * Math.pow(1 - i / n, 3) * 0.6;
        }
        return b;
    }

    // ═════════════════════════════════════════════════════════════
    // Ambience generators
    //   bed(): looping texture; ev: { gap: [min,max] s, make(): {buf, gain, pan, send} }
    // ═════════════════════════════════════════════════════════════
    const GEN = {
        white: { bed: () => bed(8, t => { for (let i = 0; i < t.length; i++) t[i] = white(); }, { target: 0.14 }) },
        pink: { bed: () => bed(8, t => { const p = pinkGen(); for (let i = 0; i < t.length; i++) t[i] = p(); }, { target: 0.16 }) },
        brown: { bed: () => bed(8, t => { const p = brownGen(); for (let i = 0; i < t.length; i++) t[i] = p(); }, { target: 0.2, sr: 16000 }) },

        rain: {
            bed: () => bed(16, (t, c, sr) => {
                const p = pinkGen(), hi = lp1(6500, sr), lo = lp1(450, sr), sw = wander(0.8, 1.1, 2, 5, sr), tex = hp1(2500, sr);
                let e = 0, dec = 0.99;
                for (let i = 0; i < t.length; i++) {
                    const x = hi(p()); let y = x - lo(x);
                    if (Math.random() < 260 / sr) { e = Math.pow(Math.random(), 3) * 1.4; dec = rand(0.985, 0.997); }
                    y += tex(white() * e) * 0.9; e *= dec;
                    t[i] = y * sw();
                }
            }, { target: 0.17 }),
            ev: {
                gap: [0.12, 0.7], make: () => ({
                    buf: oneShot(0.09, (d, sr) => {
                        const f0 = rand(1400, 3800), k = rand(45, 90);
                        let ph = 0;
                        for (let i = 0; i < d.length; i++) {
                            const s = i / sr, f = f0 * (1 + s * 9);
                            ph += 2 * Math.PI * f / sr;
                            d[i] = Math.sin(ph) * Math.exp(-s * k) * 0.5 + (i < sr * 0.0015 ? white() * 0.6 : 0);
                        }
                    }), gain: Math.pow(Math.random(), 2) * 0.22, pan: rand(-0.9, 0.9)
                })
            }
        },

        thunder: {
            bed: () => bed(10, (t, c, sr) => { const b = brownGen(), l = lp1(120, sr); for (let i = 0; i < t.length; i++) t[i] = l(b()); }, { target: 0.03, sr: 16000 }),
            first: [3, 9],
            ev: {
                gap: [16, 48], make: () => {
                    const dur = rand(6, 11), near = Math.random() < 0.4;
                    const rolls = Array.from({ length: 3 + Math.floor(Math.random() * 4) }, (_, i) => ({
                        o: i === 0 ? 0 : rand(0.2, dur * 0.55), a: rand(0.15, 0.6), d: rand(1.2, 3.4), g: i === 0 ? 1 : rand(0.35, 0.9) }));
                    return {
                        buf: oneShot(dur, (d, sr) => {
                            const b = brownGen(), p = pinkGen(), l = lp1(200, sr), cr = lp1(2600, sr);
                            for (let i = 0; i < d.length; i++) {
                                const s = i / sr;
                                let env = 0;
                                for (const r of rolls) {
                                    const u = s - r.o;
                                    if (u > 0) env += r.g * (u < r.a ? u / r.a : Math.exp(-(u - r.a) / r.d));
                                }
                                l.set(90 + 420 * Math.min(1, env));
                                let y = l(b() * 1.6 + p() * 0.5) * env;
                                if (near && s < 0.45) y += cr(white()) * Math.exp(-s * 9) * 0.9;
                                d[i] = y * Math.min(1, (dur - s) / 0.6);
                            }
                            let pk = 0; for (let i = 0; i < d.length; i++) pk = Math.max(pk, Math.abs(d[i]));
                            for (let i = 0; i < d.length; i++) d[i] *= 0.85 / (pk || 1);
                        }, 16000), gain: rand(0.45, 0.95), pan: rand(-0.6, 0.6), send: 0.5
                    };
                }
            }
        },

        wind: {
            bed: () => bed(20, (t, c, sr) => {
                const p = pinkGen(), bp = biquad('bp', 500, 1.1, sr), f = wander(220, 950, 2, 6, sr), g = wander(0.25, 1, 2, 7, sr), lo = lp1(180, sr);
                for (let i = 0; i < t.length; i++) {
                    if (i % 64 === 0) bp.set(f());
                    else f();
                    const x = p();
                    t[i] = (bp(x) * 2.2 + lo(x) * 0.5) * g();
                }
            }, { target: 0.15, sr: 22050 })
        },

        ocean: {
            bed: () => bed(12, (t, c, sr) => { const b = brownGen(), l = lp1(320, sr), g = wander(0.75, 1, 1, 3, sr); for (let i = 0; i < t.length; i++) t[i] = l(b()) * g(); }, { target: 0.06, sr: 16000 }),
            first: [0.2, 1.5],
            ev: {
                gap: [4.5, 8.5], make: () => {
                    const rise = rand(2, 3.6), dur = rise + rand(5, 7.5), dec = rand(1.1, 2.2), size = rand(0.55, 1);
                    return {
                        buf: oneShot(dur, (d, sr) => {
                            const b = brownGen(), p = pinkGen(), body = lp1(300, sr), foamHp = hp1(1800, sr), foamLp = lp1(7000, sr), fizz = wander(0.5, 1, 0.05, 0.3, sr);
                            for (let i = 0; i < d.length; i++) {
                                const s = i / sr;
                                const env = s < rise ? Math.pow(s / rise, 2.2) : Math.exp(-(s - rise) / dec);
                                const foam = s < rise ? Math.pow(s / rise, 6) * 0.5 : Math.exp(-(s - rise) / (dec * 1.8));
                                body.set(180 + 2600 * Math.pow(env, 1.6));
                                const y = body(b() * 0.7 + p() * 0.5) * env + foamLp(foamHp(white())) * foam * fizz() * 0.35;
                                d[i] = y * Math.min(1, (dur - s) / 0.8);
                            }
                            scaleTo(d, 0.2);
                        }, 22050), gain: size, pan: rand(-0.5, 0.5)
                    };
                }
            }
        },

        stream: {
            bed: () => bed(12, (t, c, sr) => {
                const bp = biquad('bp', 2200, 0.6, sr), g = wander(0.5, 1, 0.03, 0.15, sr), lo = lp1(600, sr), p = pinkGen();
                const bub = [];
                for (let i = 0; i < t.length; i++) {
                    let y = bp(white()) * 0.22 * g() + lo(p()) * 0.15;
                    if (Math.random() < 90 / sr) bub.push({ ph: 0, f: 450 + Math.pow(Math.random(), 2) * 2400, k: rand(35, 110), a: Math.pow(Math.random(), 1.5) * 0.18, s: 0 });
                    for (let j = bub.length - 1; j >= 0; j--) {
                        const q = bub[j];
                        q.s += 1 / sr;
                        q.ph += 2 * Math.PI * q.f * (1 + q.s * 7) / sr;
                        const e = Math.exp(-q.s * q.k);
                        y += Math.sin(q.ph) * q.a * e;
                        if (e < 0.01) { bub[j] = bub[bub.length - 1]; bub.pop(); }
                    }
                    t[i] = y;
                }
            }, { target: 0.13, sr: 22050 })
        },

        birds: {
            bed: () => bed(10, (t, c, sr) => { const p = pinkGen(), h = hp1(1500, sr), g = wander(0.2, 1, 1, 3, sr); for (let i = 0; i < t.length; i++) t[i] = h(p()) * g(); }, { target: 0.012 }),
            first: [0.5, 2],
            init: ch => { ch.birds = Array.from({ length: 4 }, () => birdVoice()); },
            ev: { gap: [1, 5.5], make: ch => ({ buf: birdCall(pick(ch.birds)), gain: rand(0.08, 0.32), pan: rand(-0.85, 0.85), send: 0.35 }) }
        },

        crickets: {
            bed: () => bed(12, (t, c, sr) => {
                const crs = Array.from({ length: 3 }, () => ({ f: rand(4100, 5200), per: rand(0.55, 0.95), n: 3 + Math.floor(Math.random() * 3), pl: rand(0.012, 0.018), sp: rand(0.028, 0.035), a: rand(0.04, 0.16), next: rand(0, 0.8) }));
                const ch2 = biquad('bp', 4600, 6, sr), am = wander(0.2, 1, 0.01, 0.03, sr), b = brownGen(), l = lp1(150, sr);
                for (let i = 0; i < t.length; i++) {
                    const s = i / sr;
                    let y = ch2(white()) * 0.06 * am() + l(b()) * 0.05;
                    for (const k of crs) {
                        if (s >= k.next + k.n * k.sp) k.next += k.per * rand(0.95, 1.05);
                        const u = s - k.next;
                        if (u >= 0) {
                            const pi = Math.floor(u / k.sp), pu = u - pi * k.sp;
                            if (pi < k.n && pu < k.pl) { const e = Math.sin(Math.PI * pu / k.pl); y += (Math.sin(2 * Math.PI * k.f * s) + 0.15 * Math.sin(4 * Math.PI * k.f * s)) * e * k.a; }
                        }
                    }
                    t[i] = y;
                }
            }, { xf: 0.25, target: 0.07 })
        },

        fire: {
            bed: () => bed(18, (t, c, sr) => {
                const b = brownGen(), p = pinkGen(), roar = lp1(320, sr), hiss = hp1(2200, sr), rg = wander(0.55, 1, 0.5, 2, sr), dens = wander(2, 22, 0.5, 2.5, sr), crk = hp1(900, sr);
                let e = 0, dec = 0.9;
                for (let i = 0; i < t.length; i++) {
                    let y = roar(b()) * 0.9 * rg() + hiss(p()) * 0.05;
                    if (Math.random() < dens() / sr) { e = Math.pow(Math.random(), 2.5) * 2.2; dec = rand(0.86, 0.97); }
                    y += crk(white() * e); e *= dec;
                    t[i] = y;
                }
            }, { target: 0.16 }),
            ev: {
                gap: [1.5, 7], make: () => ({
                    buf: oneShot(0.25, (d, sr) => {
                        const h = hp1(400, sr), lo = lp1(3000, sr);
                        let e = 0;
                        for (let i = 0; i < d.length; i++) {
                            if (Math.random() < (i < sr * 0.06 ? 0.004 : 0.0004)) e = rand(0.5, 1);
                            d[i] = lo(h(white() * e)) * 1.6; e *= 0.93;
                        }
                    }), gain: rand(0.25, 0.7), pan: rand(-0.5, 0.5)
                })
            }
        },

        cafe: {
            bed: () => bed(18, (t, c, sr) => {
                const voices = Array.from({ length: 4 }, () => talker(sr));
                const b = brownGen(), roomTone = lp1(220, sr), out = lp1(2600, sr);
                for (let i = 0; i < t.length; i++) {
                    let y = roomTone(b()) * 0.25;
                    for (const v of voices) y += v();
                    t[i] = out(y);
                }
            }, { target: 0.14, sr: 16000 }),
            ev: {
                gap: [2.5, 10], make: () => {
                    const f0 = rand(1900, 3300), parts = [[1, 1, 9], [2.32, 0.5, 14], [4.25, 0.3, 20], [6.63, 0.15, 28]];
                    return {
                        buf: oneShot(0.7, (d, sr) => {
                            for (let i = 0; i < d.length; i++) {
                                const s = i / sr;
                                let y = i < sr * 0.002 ? white() * 0.3 : 0;
                                for (const [r, a, k] of parts) y += Math.sin(2 * Math.PI * f0 * r * s) * a * Math.exp(-s * k);
                                d[i] = y * 0.4;
                            }
                        }), gain: rand(0.03, 0.12), pan: rand(-0.8, 0.8), send: 0.4
                    };
                }
            }
        },

        fan: {
            bed: () => bed(8, (t, c, sr) => {
                const b = brownGen(), p = pinkGen(), l = lp1(700, sr), bp = biquad('bp', 1100, 0.7, sr);
                for (let i = 0; i < t.length; i++) {
                    const s = i / sr;
                    t[i] = (l(b()) * 0.8 + bp(p()) * 0.2) * (1 + 0.05 * Math.sin(2 * Math.PI * 12 * s)) +
                        0.015 * Math.sin(2 * Math.PI * 120 * s) + 0.007 * Math.sin(2 * Math.PI * 240 * s);
                }
            }, { target: 0.17 })
        },

        vinyl: {
            bed: () => bed(12, (t, c, sr) => {
                const h = hp1(3000, sr), rum = lp1(45, sr), b = brownGen(), pl = lp1(1800, sr);
                let e = 0, pe = 0;
                for (let i = 0; i < t.length; i++) {
                    let y = h(white()) * 0.012 + rum(b()) * 0.04;
                    if (Math.random() < 7 / sr) e = Math.pow(Math.random(), 4) * 0.5;
                    if (Math.random() < 0.35 / sr) pe = rand(0.2, 0.45);
                    y += white() * e + pl(white() * pe); e *= 0.6; pe *= 0.985;
                    t[i] = y;
                }
            }, { target: 0 })
        },
    };

    // A muffled background talker: a voiced pulse train through two
    // vowel formants with syllable / phrase envelopes.
    const VOWELS = [[730, 1090], [270, 2290], [530, 1840], [570, 840], [440, 1020], [300, 870], [640, 1190], [490, 1350]];
    function talker(sr) {
        const pitch = rand(95, 230), scale = pitch > 160 ? rand(1.1, 1.2) : rand(0.9, 1);
        const f1 = biquad('bp', 500, 4, sr), f2 = biquad('bp', 1500, 6, sr), dist = rand(0.25, 1);
        let ph = 0, talking = Math.random() < 0.5, left = Math.floor(rand(0.3, 2) * sr), syl = 0, sylLen = 1, sylAmp = 0, intonation = 0;
        return () => {
            if (--left <= 0) { talking = !talking; left = Math.floor((talking ? rand(1, 4) : rand(0.4, 2.5)) * sr); }
            if (talking && syl <= 0) {
                sylLen = Math.floor(rand(0.08, 0.26) * sr); syl = sylLen; sylAmp = rand(0.4, 1);
                const v = pick(VOWELS); f1.set(v[0] * scale); f2.set(v[1] * scale);
                intonation = rand(-0.12, 0.12);
            }
            let env = 0;
            if (syl > 0) { env = Math.sin(Math.PI * (1 - syl / sylLen)) * sylAmp; syl--; }
            if (!talking) env *= 0.2;
            ph += pitch * (1 + intonation * (1 - syl / sylLen) + 0.01 * white()) / sr;
            ph -= Math.floor(ph);
            const src = (ph * 2 - 1) * 0.6 + white() * 0.25;
            return (f1(src) * 1.4 + f2(src) * 0.8) * env * dist * 0.5;
        };
    }

    function birdVoice() {
        const kind = pick(['whistle', 'whistle', 'trill', 'warble', 'feebee']);
        return { kind, base: kind === 'trill' ? rand(3800, 5800) : rand(2200, 4200), slide: rand(-900, 700), notes: 2 + Math.floor(Math.random() * 5), len: rand(0.07, 0.18), rate: rand(14, 30) };
    }
    function birdCall(v) {
        const segs = [];
        let t0 = 0;
        if (v.kind === 'whistle') for (let i = 0; i < v.notes; i++) { const f = v.base * rand(0.92, 1.1); segs.push({ t: t0, d: v.len, f0: f, f1: f + v.slide, fm: 0 }); t0 += v.len + rand(0.05, 0.12); }
        else if (v.kind === 'trill') { const n = 8 + Math.floor(Math.random() * 12); for (let i = 0; i < n; i++) { segs.push({ t: t0, d: 0.025, f0: v.base, f1: v.base - 900, fm: 0 }); t0 += 0.042; } }
        else if (v.kind === 'warble') segs.push({ t: 0, d: rand(0.45, 0.9), f0: v.base, f1: v.base + v.slide * 0.4, fm: rand(250, 650) });
        else { segs.push({ t: 0, d: 0.28, f0: v.base * 1.18, f1: v.base * 1.16, fm: 0 }); segs.push({ t: 0.36, d: 0.3, f0: v.base, f1: v.base * 0.98, fm: 0 }); }
        const total = segs.reduce((m, s) => Math.max(m, s.t + s.d), 0) + 0.05;
        return oneShot(total, (d, sr) => {
            for (const s of segs) {
                let ph = 0;
                const i0 = Math.floor(s.t * sr), n = Math.floor(s.d * sr);
                for (let i = 0; i < n && i0 + i < d.length; i++) {
                    const u = i / n, f = s.f0 + (s.f1 - s.f0) * u + (s.fm ? s.fm * Math.sin(2 * Math.PI * v.rate * i / sr) : 0);
                    ph += 2 * Math.PI * f / sr;
                    const e = Math.pow(Math.sin(Math.PI * u), 0.7);
                    d[i0 + i] += (Math.sin(ph) + 0.12 * Math.sin(2 * ph)) * e * 0.5;
                }
            }
        });
    }

    // ═════════════════════════════════════════════════════════════
    // Mixer engine
    // ═════════════════════════════════════════════════════════════
    const live = {}; // id → { gain, src, send, next, ... }
    let evTimer = 0;

    function chStart(id, { fade = 1.4 } = {}) {
        if (live[id]) return;
        ensureCtx();
        const spec = chan(id), g = GEN[id];
        const ch = { gain: ctx.createGain(), spec };
        ch.gain.gain.value = 0;
        ch.gain.connect(ambBus);
        ch.send = ctx.createGain(); ch.send.gain.value = 1; ch.send.connect(room);
        if (g.init) g.init(ch);
        if (g.bed) {
            const buf = g.bed();
            ch.src = ctx.createBufferSource();
            ch.src.buffer = buf; ch.src.loop = true;
            ch.src.connect(ch.gain);
            ch.src.start(0, Math.random() * buf.duration);
        }
        if (g.ev) { const f = g.first || g.ev.gap; ch.next = ctx.currentTime + rand(f[0], f[1]); }
        live[id] = ch;
        ch.gain.gain.setTargetAtTime(curve(S.vols[id]) * spec.level, ctx.currentTime, fade / 3);
        app.mixerChannels[id] = ch;
        if (!evTimer) evTimer = setInterval(schedule, 200);
        schedule();
    }
    function chStop(id, { fade = 0.5 } = {}) {
        const ch = live[id];
        if (!ch) return;
        delete live[id];
        delete app.mixerChannels[id];
        const t = ctx.currentTime;
        ch.gain.gain.cancelScheduledValues(t);
        ch.gain.gain.setTargetAtTime(0, t, fade / 3);
        setTimeout(() => {
            try { ch.src && ch.src.stop(); } catch (e) {}
            try { ch.gain.disconnect(); ch.send.disconnect(); } catch (e) {}
        }, fade * 1000 + 600);
        if (!Object.keys(live).length) { clearInterval(evTimer); evTimer = 0; }
    }
    function schedule() {
        const horizon = ctx.currentTime + 0.6;
        for (const id in live) {
            const ch = live[id], g = GEN[id];
            if (!g.ev) continue;
            let guard = 0;
            while (ch.next < horizon && guard++ < 20) {
                if (ch.next > ctx.currentTime - 0.05) playEvent(ch, g.ev.make(ch), ch.next);
                ch.next += rand(g.ev.gap[0], g.ev.gap[1]);
            }
        }
    }
    function playEvent(ch, e, when) {
        const s = ctx.createBufferSource(), g = ctx.createGain();
        s.buffer = e.buf; g.gain.value = e.gain;
        s.connect(g);
        let out = g;
        if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = e.pan || 0; g.connect(p); out = p; }
        out.connect(ch.gain);
        if (e.send) { const sg = ctx.createGain(); sg.gain.value = e.send; out.connect(sg); sg.connect(ch.send); }
        s.start(Math.max(when, ctx.currentTime));
        s.onended = () => { try { out.disconnect(); g.disconnect(); } catch (er) {} };
    }
    function chSetVol(id, v) {
        S.vols[id] = v; save();
        const ch = live[id];
        if (ch) ch.gain.gain.setTargetAtTime(curve(v) * ch.spec.level, ctx.currentTime, 0.06);
    }
    const anyAmb = () => Object.keys(live).length > 0;
    const liveMix = () => Object.fromEntries(Object.keys(live).map(id => [id, S.vols[id]]));

    // ═════════════════════════════════════════════════════════════
    // WebDesks Lo-fi — generative music with Tone.js
    // ═════════════════════════════════════════════════════════════
    const QUAL = {
        maj7: [4, 7, 11, 14], maj9: [4, 7, 11, 14], '69': [4, 9, 14, 7], m7: [3, 7, 10, 14], m9: [3, 10, 14, 7],
        m11: [3, 10, 14, 17], '9': [4, 10, 14, 7], '13': [4, 10, 14, 21], '7sus': [5, 10, 14, 7], m6: [3, 7, 9, 14]
    };
    const PROGS = [
        [[2, 'm9'], [7, '13'], [0, 'maj9'], [9, 'm7']],
        [[0, 'maj7'], [9, 'm9'], [2, 'm7'], [7, '9']],
        [[5, 'maj9'], [4, 'm7'], [2, 'm9'], [0, '69']],
        [[9, 'm9'], [5, 'maj7'], [0, 'maj9'], [7, '7sus']],
        [[0, 'maj9'], [4, 'm7'], [5, 'maj7'], [5, 'm6']],
        [[2, 'm11'], [7, '9'], [4, 'm7'], [9, 'm9']],
        [[5, 'maj7'], [7, '13'], [4, 'm7'], [9, 'm11']],
    ];
    const DRUMS = {
        boom: [
            { k: 'x.........x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
            { k: 'x......x..x.....', s: '....x.......x..o', h: 'x.xox.x.x.xox.x.' },
            { k: 'x..x......x..x..', s: '....x.......x...', h: 'x.x.x.xxx.x.x.x.' },
        ],
        jazz: [
            { k: 'o.......o.......', s: '..o.x...o.o.x..o', h: 'x...x.x.x...x.x.' },
            { k: 'o.....o.........', s: '....x..o....x.o.', h: 'x...x.x.x...x.x.' },
        ],
        half: [
            { k: 'x.........x.....', s: '........x.......', h: '..x...x...x...x.' },
            { k: 'x.....x.........', s: '........x......o', h: 'x...x...x...x.x.' },
        ],
    };
    const COMP = {
        comp: [[[0, 14, 0.7]], [[0, 6, 0.7], [6, 2, 0.45], [10, 6, 0.55]], [[0, 3, 0.65], [3, 3, 0.5], [8, 8, 0.6]], [[0, 10, 0.7], [12, 4, 0.45]]],
        jazz: [[[0, 3, 0.6], [6, 2, 0.5], [10, 3, 0.55]], [[2, 2, 0.5], [6, 4, 0.6], [12, 2, 0.45]], [[0, 2, 0.6], [3, 2, 0.45], [8, 2, 0.55], [11, 3, 0.5]]],
        long: [[[0, 30, 0.55]], [[0, 12, 0.55], [16, 12, 0.45]]],
        sparse: [[[0, 30, 0.35]]],
    };
    const ADJ = ['Rainy', 'Sleepy', 'Golden', 'Quiet', 'Velvet', 'Late', 'Paper', 'Warm', 'Hazy', 'Soft', 'Blue', 'Lazy', 'Faded', 'Cozy', 'Distant', 'Amber', 'Mellow', 'Misty'];
    const NOUN = ['Window', 'Sunday', 'Notebook', 'Tea', 'Streetlights', 'Morning', 'Library', 'Clouds', 'Daydream', 'Balcony', 'Polaroids', 'Snowfall', 'Lanterns', 'Cassette', 'Garden', 'Bookshop', 'Moonlight', 'Pages'];
    const PENTA = [0, 2, 4, 7, 9];
    const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

    const Lofi = {
        built: false, playing: false, st: null, track: null, step: 0, repeatId: null, crackle: null,

        async build() {
            if (this.built) return;
            ensureCtx();
            if (!window.Tone) await app._loadScript(TONE_URL);
            const T = window.Tone;
            T.setContext(ctx);
            this.T = T;
            this.out = new T.Gain(0.9);
            this.out.connect(musicBus);
            this.lp = new T.Filter({ type: 'lowpass', frequency: 2400, rolloff: -24, Q: 0.4 }).connect(this.out);
            this.sat = new T.Distortion({ distortion: 0.1, wet: 0.3 }).connect(this.lp);
            this.wow = new T.Vibrato({ frequency: 0.45, depth: 0.12 }).connect(this.sat);
            this.verb = new T.Reverb({ decay: 3.4, preDelay: 0.02, wet: 1 }).connect(this.lp);
            this.verbSend = new T.Gain(0.25).connect(this.verb);
            this.keysVol = new T.Gain(1).connect(this.wow);
            this.keysVol.connect(this.verbSend);

            this.keys = new T.PolySynth(T.FMSynth, {
                maxPolyphony: 16, volume: -13,
                harmonicity: 1, modulationIndex: 3.2,
                oscillator: { type: 'sine' }, modulation: { type: 'sine' },
                envelope: { attack: 0.004, decay: 1.8, sustain: 0.22, release: 1.4 },
                modulationEnvelope: { attack: 0.002, decay: 0.45, sustain: 0.12, release: 0.8 }
            }).connect(this.keysVol);
            this.padFilter = new T.Filter({ type: 'lowpass', frequency: 1300, rolloff: -12 }).connect(this.wow);
            this.padFilter.connect(this.verbSend);
            this.pad = new T.PolySynth(T.Synth, {
                maxPolyphony: 8, volume: -24,
                oscillator: { type: 'fattriangle', count: 3, spread: 18 },
                envelope: { attack: 1.6, decay: 0.6, sustain: 0.8, release: 3 }
            }).connect(this.padFilter);
            this.delay = new T.FeedbackDelay({ delayTime: '8n.', feedback: 0.28, wet: 0.25 }).connect(this.wow);
            this.delay.connect(this.verbSend);
            this.lead = new T.PolySynth(T.FMSynth, {
                maxPolyphony: 4, volume: -17,
                harmonicity: 2, modulationIndex: 1.6,
                envelope: { attack: 0.005, decay: 0.9, sustain: 0.08, release: 1 },
                modulationEnvelope: { attack: 0.002, decay: 0.25, sustain: 0, release: 0.2 }
            }).connect(this.delay);
            this.bassLP = new T.Filter({ type: 'lowpass', frequency: 420, rolloff: -24 }).connect(this.lp);
            this.bass = new T.MonoSynth({
                volume: -9, oscillator: { type: 'triangle' },
                envelope: { attack: 0.01, decay: 0.35, sustain: 0.55, release: 0.5 },
                filterEnvelope: { attack: 0.005, decay: 0.25, sustain: 0.4, release: 0.4, baseFrequency: 110, octaves: 2.2 }
            }).connect(this.bassLP);
            this.drumBus = new T.Filter({ type: 'lowpass', frequency: 5200, rolloff: -12 }).connect(this.lp);
            this.drumVerb = new T.Gain(0.12).connect(this.verb);
            this.drumBus.connect(this.drumVerb);
            this.kick = new T.MembraneSynth({ volume: -5, pitchDecay: 0.045, octaves: 5, envelope: { attack: 0.001, decay: 0.38, sustain: 0, release: 0.1 } }).connect(this.drumBus);
            this.snareF = new T.Filter({ type: 'bandpass', frequency: 1900, Q: 0.7 }).connect(this.drumBus);
            this.snare = new T.NoiseSynth({ volume: -9, noise: { type: 'pink' }, envelope: { attack: 0.001, decay: 0.17, sustain: 0 } }).connect(this.snareF);
            this.hatF = new T.Filter({ type: 'highpass', frequency: 7000 }).connect(this.drumBus);
            this.hat = new T.NoiseSynth({ volume: -24, noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.035, sustain: 0 } }).connect(this.hatF);
            this.ride = new T.MetalSynth({ volume: -34, harmonicity: 5.1, modulationIndex: 24, resonance: 5200, octaves: 1.3, envelope: { attack: 0.001, decay: 0.9, release: 0.3 } }).connect(this.drumBus);
            this.ride.frequency.value = 320;
            await this.verb.ready;
            this.built = true;
        },

        configure(id) {
            const st = this.st = station(id), T = this.T, now = T.now();
            this.lp.frequency.rampTo(st.cutoff, 0.6, now);
            this.level = 2.6 * st.gain;
            this.out.gain.rampTo(this.playing ? this.level : 0, 0.6, now);
            this.verbSend.gain.rampTo(st.verb, 0.6, now);
            this.snare.envelope.decay = st.drums === 'jazz' ? 0.32 : 0.17;
            this.snare.volume.value = st.drums === 'jazz' ? -19 : -9;
            this.snareF.frequency.value = st.drums === 'jazz' ? 3200 : 1900;
            this.newTrack();
        },

        newTrack() {
            const st = this.st, T = this.T;
            const key = pick([0, 2, 3, 5, 7, 8, 10]);
            const prog = pick(PROGS);
            let prev = 64;
            const chords = prog.map(([deg, q]) => {
                const root = (key + deg) % 12;
                const notes = [...new Set(QUAL[q].map(iv => {
                    let n = 48 + root + iv;
                    while (n < prev - 7) n += 12;
                    while (n > prev + 8) n -= 12;
                    return Math.max(55, Math.min(79, n));
                }))].sort((a, b) => a - b);
                prev = notes.reduce((a, b) => a + b, 0) / notes.length;
                return { root, bass: 36 + root, notes, q };
            });
            const motif = [];
            let d = 5 + Math.floor(Math.random() * 4);
            for (let s = 0; s < 32; s += 2) {
                if (Math.random() < st.lead * 0.55) {
                    d = Math.max(3, Math.min(12, d + pick([-2, -1, -1, 0, 1, 1, 2])));
                    motif.push([s + (Math.random() < 0.2 ? 1 : 0), d, pick([2, 2, 3, 4, 6])]);
                }
            }
            this.track = {
                name: `${pick(ADJ)} ${pick(NOUN)}`, key, chords, motif,
                bpm: Math.round(rand(st.bpm[0], st.bpm[1])),
                drums: st.drums ? pick(DRUMS[st.drums]) : null,
                comp: pick(COMP[st.keys]), start: this.step, bars: st.bars
            };
            const tr = T.getTransport();
            tr.bpm.rampTo(this.track.bpm, 1);
            tr.swing = st.swing; tr.swingSubdivision = st.sub;
            refreshNowPlaying();
        },

        tick(time) {
            const T = this.T, st = this.st, tr = this.track;
            const rel = this.step - tr.start;
            const bar = Math.floor(rel / 16), s = rel % 16;
            const six = 60 / tr.bpm / 4;
            const hum = () => rand(-0.006, 0.01);
            const chordAt = b => tr.chords[Math.floor(b / st.bpc) % tr.chords.length];
            const ch = chordAt(bar);
            const intro = bar < 4, outro = bar >= tr.bars - 2, breakdown = bar % 16 >= 12 && bar % 16 < 14 && !intro;
            const chordStart = bar % st.bpc === 0;

            // Keys / comping
            if (st.keys === 'sparse') {
                if (s % 4 === 0 && Math.random() < 0.18) this.keys.triggerAttackRelease(mtof(pick(ch.notes) + 12), six * 12, time + hum(), rand(0.2, 0.35));
            } else {
                if (s === 0 && bar % 4 === 0) tr.comp = pick(COMP[st.keys]);
                for (const [at, len, vel] of tr.comp) {
                    const barOff = Math.floor(at / 16), at16 = at % 16;
                    if (at16 !== s || (barOff && bar % st.bpc !== barOff) || (!barOff && st.bpc > 1 && !chordStart)) continue;
                    const roll = st.keys === 'jazz' ? 0.008 : 0.018;
                    ch.notes.forEach((n, i) => this.keys.triggerAttackRelease(mtof(n), six * len, time + hum() + i * roll, vel * rand(0.85, 1)));
                }
            }
            // Pad
            if (st.pad && s === 0 && chordStart) this.pad.triggerAttackRelease(ch.notes.map(mtof), six * 16 * st.bpc - 0.1, time, 0.5);

            // Bass
            if (!intro || bar >= 2) {
                const b = ch.bass;
                if (st.bass === 'lofi') {
                    if (s === 0) this.bass.triggerAttackRelease(mtof(b), six * 6, time, 0.8);
                    else if (s === 10 && Math.random() < 0.7) this.bass.triggerAttackRelease(mtof(b + pick([0, 7, 12])), six * 4, time + hum(), 0.6);
                    else if (s === 7 && Math.random() < 0.25) this.bass.triggerAttackRelease(mtof(b + 12), six * 2, time + hum(), 0.45);
                } else if (st.bass === 'walk') {
                    if (s % 4 === 0) {
                        const nb = chordAt(bar + 1).bass;
                        const n = s === 0 ? b : s === 4 ? b + pick([3, 4, 7]) : s === 8 ? b + 7 : nb + pick([-1, 1, 2]);
                        this.bass.triggerAttackRelease(mtof(n), six * 3.5, time + hum(), s === 0 ? 0.75 : 0.55);
                    }
                } else if (s === 0 && chordStart) this.bass.triggerAttackRelease(mtof(b), six * 16 * st.bpc - 0.2, time, 0.6);
            }

            // Drums (with a little sidechain-style dip on the keys)
            if (tr.drums && !intro && !outro) {
                const k = tr.drums.k[s], sn = tr.drums.s[s], h = tr.drums.h[s];
                if (k !== '.' && !breakdown) {
                    this.kick.triggerAttackRelease('C1', '8n', time, k === 'x' ? 0.9 : 0.4);
                    const g = this.keysVol.gain;
                    g.cancelScheduledValues(time); g.setValueAtTime(0.78, time); g.linearRampToValueAtTime(1, time + 0.28);
                }
                if (sn !== '.' && !breakdown) this.snare.triggerAttackRelease(sn === 'x' ? '8n' : '32n', time + hum(), sn === 'x' ? rand(0.75, 0.9) : rand(0.2, 0.3));
                if (st.drums === 'jazz') {
                    if (h === 'x') this.ride.triggerAttackRelease(320, '8n', time + hum(), s % 4 === 0 ? 0.5 : 0.35);
                } else if (h !== '.' || Math.random() < 0.05) {
                    this.hat.triggerAttackRelease('32n', time + hum(), h === 'x' ? (s % 4 === 0 ? 0.55 : 0.4) : 0.2);
                }
            }

            // Melody motif: two bars on, two off, after the intro
            if (!intro && !outro && st.lead && (bar % 8) >= 4 && (bar % 8) < 6) {
                const pos = (bar % 2) * 16 + s;
                for (const [at, deg, len] of tr.motif) {
                    if (at !== pos) continue;
                    const n = 60 + tr.key + PENTA[deg % 5] + 12 * Math.floor(deg / 5) - 12;
                    this.lead.triggerAttackRelease(mtof(n), six * len, time + hum(), rand(0.45, 0.65));
                }
            }

            this.step++;
            // (not Tone.Draw: it runs on rAF, which stalls in background tabs)
            if (rel + 1 >= tr.bars * 16) this.newTrack();
        },

        async play(id) {
            try { await this.build(); } catch (e) { toast("Couldn't load the music engine — check your connection."); return false; }
            const T = this.T;
            await T.start();
            const tr = T.getTransport();
            if (!this.st || this.st.id !== id) {
                if (this.repeatId != null) { tr.clear(this.repeatId); this.repeatId = null; }
                tr.stop();
                this.keys.releaseAll(); this.pad.releaseAll();
                this.configure(id);
            }
            if (this.repeatId == null) this.repeatId = tr.scheduleRepeat(t => this.tick(t), '16n');
            const now = ctx.currentTime;
            this.out.gain.cancelScheduledValues(now);
            this.out.gain.setTargetAtTime(this.level, now, 0.3);
            if (tr.state !== 'started') tr.start('+0.08');
            this.crackleOn(true);
            this.playing = true;
            return true;
        },
        pause() {
            if (!this.built) return;
            const T = this.T, now = ctx.currentTime;
            this.out.gain.cancelScheduledValues(now);
            this.out.gain.setTargetAtTime(0, now, 0.15);
            setTimeout(() => {
                if (this.playing) return;
                T.getTransport().pause();
                this.keys.releaseAll(); this.pad.releaseAll(); this.lead.releaseAll();
            }, 700);
            this.crackleOn(false);
            this.playing = false;
        },
        skip() { if (this.built && this.st) { this.keys.releaseAll(); this.newTrack(); } },
        crackleOn(on) {
            if (on && !this.crackle) {
                const src = ctx.createBufferSource(), g = ctx.createGain();
                src.buffer = GEN.vinyl.bed(); src.loop = true;
                g.gain.value = 0; src.connect(g); g.connect(musicBus);
                src.start(0, Math.random() * 10);
                g.gain.setTargetAtTime(0.5, ctx.currentTime, 0.5);
                this.crackle = { src, g };
            } else if (!on && this.crackle) {
                const c = this.crackle; this.crackle = null;
                c.g.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
                setTimeout(() => { try { c.src.stop(); c.g.disconnect(); } catch (e) {} }, 600);
            }
        }
    };

    // ═════════════════════════════════════════════════════════════
    // Radio — SomaFM via howler.js
    // ═════════════════════════════════════════════════════════════
    const Radio = {
        howl: null, id: null, host: 0, playing: false, song: '', meta: 0,
        async play(id) {
            try { if (!window.Howl) await app._loadScript(HOWLER_URL); } catch (e) { toast("Couldn't load the radio player."); return false; }
            this.stop();
            this.id = id; this.host = 0; this.playing = true;
            this.open();
            this.pollMeta();
            return true;
        },
        open() {
            const id = this.id;
            this.howl = new window.Howl({
                src: [`https://${RADIO_HOSTS[this.host]}/${id}-128-mp3`], html5: true, format: ['mp3'], volume: this.vol(),
                onloaderror: () => this.fail(id), onplayerror: () => this.fail(id),
                onplay: () => refreshUI()
            });
            this.howl.play();
        },
        fail(id) {
            if (id !== this.id || !this.playing) return;
            try { this.howl.unload(); } catch (e) {}
            if (++this.host < RADIO_HOSTS.length) return this.open();
            this.playing = false; this.howl = null;
            toast(`${station(id).name} isn't reachable right now — try another station.`);
            afterChange();
        },
        // Live streams can't resume where they paused, so pausing unloads.
        stop() {
            this.playing = false;
            clearInterval(this.meta); this.meta = 0; this.song = '';
            if (this.howl) { const h = this.howl; this.howl = null; try { h.fade(h.volume(), 0, 300); setTimeout(() => h.unload(), 350); } catch (e) { try { h.unload(); } catch (er) {} } }
        },
        vol() { return curve(S.musicVol) * S.master * fadeMul; },
        setVol() { if (this.howl) this.howl.volume(this.vol()); },
        pollMeta() {
            const id = this.id;
            const get = () => fetch(`https://api.somafm.com/songs/${id}.json`).then(r => r.ok ? r.json() : null).then(j => {
                const s = j && j.songs && j.songs[0];
                if (s && id === this.id) { this.song = [s.title, s.artist].filter(Boolean).join(' — '); refreshNowPlaying(); }
            }).catch(() => {});
            get();
            this.meta = setInterval(get, 30000);
        }
    };

    // ═════════════════════════════════════════════════════════════
    // Transport: what's playing, sleep timer, media session
    // ═════════════════════════════════════════════════════════════
    let fadeMul = 1, sleep = null, lastAmb = [];
    const musicOn = () => Lofi.playing || Radio.playing;
    const anything = () => musicOn() || anyAmb();

    let loading = null;
    async function playMusic(id = S.station) {
        const st = station(id);
        S.station = id; save();
        ensureCtx();
        loading = id; refreshUI();
        try {
            if (st.kind === 'radio') { Lofi.pause(); await Radio.play(id); }
            else { Radio.stop(); await Lofi.play(id); }
        } finally { if (loading === id) loading = null; }
        afterChange();
    }
    function pauseMusic() { Lofi.pause(); Radio.stop(); afterChange(); }

    function afterChange() {
        app.musicPlaying = musicOn();
        keepAliveOn(Lofi.playing || anyAmb());
        refreshUI();
        mediaSession();
    }

    function setSleep(min) {
        clearTimeout(sleep && sleep.t); clearInterval(sleep && sleep.iv);
        fadeMul = 1;
        if (master) master.gain.setTargetAtTime(S.master, ctx.currentTime, 0.1);
        Radio.setVol();
        sleep = null;
        if (min) {
            const end = Date.now() + min * 60000;
            sleep = { end, min };
            sleep.iv = setInterval(() => {
                const left = sleep.end - Date.now();
                if (left <= 60000 && left > 0) {
                    fadeMul = left / 60000;
                    if (master) master.gain.setTargetAtTime(S.master * fadeMul, ctx.currentTime, 0.5);
                    Radio.setVol();
                }
                if (left <= 0) {
                    stopEverything();
                    setSleep(0);
                    toast('Sleep timer — sounds faded out. Good night 🌙');
                }
                renderSleep();
            }, 1000);
        }
        renderSleep();
    }

    function stopEverything() {
        lastAmb = Object.keys(live);
        Object.keys(live).forEach(id => chStop(id));
        pauseMusic();
        afterChange();
    }
    // Toggle for the mobile bar / media keys: pause all, or resume what was on.
    function toggleAll() {
        if (anything()) {
            S.last = Object.keys(live); S.lastMusic = musicOn(); save();
            lastAmb = Object.keys(live);
            Object.keys(live).forEach(id => chStop(id));
            pauseMusic();
        } else {
            const amb = lastAmb.length ? lastAmb : (S.last || []);
            amb.forEach(id => chan(id) && chStart(id));
            if (S.lastMusic !== false || !amb.length) playMusic();
            afterChange();
        }
    }

    function mediaSession() {
        if (!('mediaSession' in navigator)) return;
        const ms = navigator.mediaSession;
        try {
            const np = nowPlaying();
            ms.metadata = new window.MediaMetadata({
                title: np.title, artist: np.artist, album: 'WebDesks'
            });
            ms.playbackState = anything() ? 'playing' : 'paused';
            if (!mediaSession.bound) {
                mediaSession.bound = true;
                const h = (a, f) => { try { ms.setActionHandler(a, f); } catch (e) {} };
                h('play', () => { if (!anything()) toggleAll(); });
                h('pause', () => { if (anything()) toggleAll(); });
                h('stop', () => stopEverything());
                h('nexttrack', () => nextTrack());
                h('previoustrack', () => stepStation(-1));
            }
        } catch (e) {}
    }

    function nowPlaying() {
        const st = station(S.station);
        if (musicOn()) {
            if (st.kind === 'radio') return { title: Radio.song || st.name, artist: `SomaFM · ${st.name}`, station: st };
            return { title: Lofi.track ? Lofi.track.name : st.name, artist: `WebDesks Lo-fi · ${st.name}`, station: st };
        }
        if (anyAmb()) return { title: Object.keys(live).map(id => chan(id).name).join(' + '), artist: 'Ambience mixer', station: st };
        return { title: st.name, artist: st.kind === 'radio' ? 'SomaFM radio' : 'WebDesks Lo-fi', station: st };
    }
    function nextTrack() {
        const st = station(S.station);
        if (st.kind === 'gen' && Lofi.playing) { Lofi.skip(); toast(`Now playing: ${Lofi.track.name}`); }
        else stepStation(1);
    }
    function stepStation(dir) {
        const i = STATIONS.findIndex(s => s.id === S.station);
        playMusic(STATIONS[(i + dir + STATIONS.length) % STATIONS.length].id);
    }

    // ═════════════════════════════════════════════════════════════
    // UI
    // ═════════════════════════════════════════════════════════════
    const $ = id => document.getElementById(id);
    let root = null;

    function stationCard(s) {
        return `<button class="snd-station" data-station="${s.id}" style="--c1:${s.c[0]};--c2:${s.c[1]}">
            <span class="snd-station-art"></span>
            <span class="snd-station-txt"><b>${esc(s.name)}</b><small>${esc(s.desc)}</small></span>
            <span class="snd-station-eq" aria-hidden="true"><i></i><i></i><i></i></span>
        </button>`;
    }

    function render() {
        root = $('audio');
        if (!root) return;
        const groups = [...new Set(CHANNELS.map(c => c.group))];
        root.innerHTML = `
        <div class="snd">
            <div class="snd-head">
                <div>
                    <h2>Sounds</h2>
                    <p>Ad-free music and a living ambience mixer — made right in your browser.</p>
                </div>
                <div class="snd-head-actions">
                    <label class="snd-sleep" title="Fade everything out after a while">
                        <i data-lucide="moon" class="w-4 h-4"></i>
                        <select id="snd-sleep" aria-label="Sleep timer">
                            <option value="0">Sleep timer</option>
                            <option value="15">15 min</option><option value="30">30 min</option>
                            <option value="45">45 min</option><option value="60">1 hour</option><option value="90">90 min</option>
                        </select>
                        <span id="snd-sleep-left"></span>
                    </label>
                    <button class="snd-btn" data-act="stopall"><i data-lucide="square" class="w-4 h-4"></i> Stop all</button>
                </div>
            </div>

            <section class="snd-card snd-player">
                <div class="snd-art" id="snd-art"><canvas id="snd-viz" width="320" height="320"></canvas></div>
                <div class="snd-np">
                    <div class="snd-eyebrow" id="snd-np-eyebrow">Music</div>
                    <div class="snd-np-title" id="snd-np-title">Lo-fi Beats</div>
                    <div class="snd-np-sub" id="snd-np-sub">WebDesks Lo-fi</div>
                    <div class="snd-controls">
                        <button class="snd-ctl" data-act="prev" aria-label="Previous station"><i data-lucide="skip-back" class="w-5 h-5"></i></button>
                        <button class="snd-ctl snd-play" data-act="play" id="snd-play" aria-label="Play"><i data-lucide="play" class="w-7 h-7"></i></button>
                        <button class="snd-ctl" data-act="next" aria-label="Next track"><i data-lucide="skip-forward" class="w-5 h-5"></i></button>
                    </div>
                    <div class="snd-vol"><i data-lucide="volume-1" class="w-4 h-4"></i>
                        <input type="range" min="0" max="1" step="0.01" id="snd-music-vol" value="${S.musicVol}" aria-label="Music volume"></div>
                </div>
            </section>

            <section class="snd-card">
                <div class="snd-sec-title"><span>WebDesks Lo-fi</span><small>Composed live, never repeats, works offline · no ads</small></div>
                <div class="snd-stations">${STATIONS.filter(s => s.kind === 'gen').map(stationCard).join('')}</div>
                <div class="snd-sec-title" style="margin-top:1.1rem"><span>Radio</span><small>Ad-free, listener-supported <a href="https://somafm.com/" target="_blank" rel="noopener">SomaFM</a> · <a href="https://somafm.com/support/" target="_blank" rel="noopener">support them ♥</a></small></div>
                <div class="snd-stations">${STATIONS.filter(s => s.kind === 'radio').map(stationCard).join('')}</div>
            </section>

            <section class="snd-card">
                <div class="snd-mixhead">
                    <div class="snd-sec-title"><span>Ambience</span><small>Tap a sound to blend it in</small></div>
                    <div class="snd-vol snd-master"><i data-lucide="volume-2" class="w-4 h-4"></i>
                        <input type="range" min="0" max="1" step="0.01" id="snd-master" value="${S.master}" aria-label="Master volume"><span id="snd-master-pct">${Math.round(S.master * 100)}%</span></div>
                </div>
                <div class="snd-presets">${PRESETS.map(p => `<button class="snd-chip" data-preset="${p.id}">${p.emoji} ${esc(p.name)}</button>`).join('')}</div>
                <div class="snd-groups">${groups.map(g => `<div><div class="snd-group">${esc(g)}</div>
                <div class="snd-grid">${CHANNELS.filter(c => c.group === g).map(c => `
                    <div class="snd-tile" data-ch="${c.id}">
                        <button class="snd-tile-btn" data-toggle="${c.id}" aria-pressed="false">
                            <i data-lucide="${c.icon}" class="w-6 h-6"></i><span>${esc(c.name)}</span>
                        </button>
                        <input type="range" min="0" max="1" step="0.01" value="${S.vols[c.id]}" data-vol="${c.id}" aria-label="${esc(c.name)} volume">
                    </div>`).join('')}</div></div>`).join('')}</div>
                <div class="snd-saved">
                    <div class="snd-group" style="margin:0">Your mixes</div>
                    <div class="snd-presets" id="snd-mixes"></div>
                    <button class="snd-btn" data-act="savemix"><i data-lucide="bookmark-plus" class="w-4 h-4"></i> Save current mix</button>
                </div>
            </section>
        </div>`;
        bind();
        renderMixes();
        refreshUI();
        app._rebuildIcons && app._rebuildIcons();
    }

    function bind() {
        root.addEventListener('click', e => {
            const t = e.target.closest('[data-act],[data-station],[data-toggle],[data-preset],[data-mix],[data-delmix]');
            if (!t) return;
            if (t.dataset.station) {
                const id = t.dataset.station;
                if (id === S.station && musicOn()) pauseMusic(); else playMusic(id);
            } else if (t.dataset.toggle) app.mixerToggle(t.dataset.toggle);
            else if (t.dataset.preset) app.mixerPreset(t.dataset.preset);
            else if (t.dataset.delmix) { e.stopPropagation(); mixes = mixes.filter(m => m.id !== t.dataset.delmix); saveMixes(); }
            else if (t.dataset.mix) { const m = mixes.find(x => x.id === t.dataset.mix); if (m) applyMix(m.mix); }
            else {
                const a = t.dataset.act;
                if (a === 'play') app.toggleMusic();
                else if (a === 'next') musicOn() ? nextTrack() : playMusic();
                else if (a === 'prev') stepStation(-1);
                else if (a === 'stopall') app.mixerStopAll(true);
                else if (a === 'savemix') saveMix();
            }
        });
        root.addEventListener('input', e => {
            const t = e.target;
            if (t.dataset.vol) {
                const id = t.dataset.vol, v = parseFloat(t.value);
                chSetVol(id, v);
                if (v > 0 && !live[id]) { chStart(id, { fade: 0.4 }); afterChange(); }
                else if (v === 0 && live[id]) { chStop(id); afterChange(); }
            } else if (t.id === 'snd-music-vol') app.musicSetVol(t.value);
            else if (t.id === 'snd-master') app.mixerSetMaster(t.value);
        });
        $('snd-sleep').addEventListener('change', e => setSleep(parseInt(e.target.value, 10)));
    }

    function renderSleep() {
        const el = $('snd-sleep-left'), sel = $('snd-sleep');
        if (!el) return;
        if (!sleep) { el.textContent = ''; if (sel) sel.value = '0'; return; }
        const left = Math.max(0, sleep.end - Date.now()), m = Math.floor(left / 60000), s = Math.floor(left / 1000) % 60;
        el.textContent = `${m}:${String(s).padStart(2, '0')}`;
    }

    function renderMixes() {
        const el = $('snd-mixes');
        if (!el) return;
        el.innerHTML = mixes.length
            ? mixes.map(m => `<button class="snd-chip" data-mix="${esc(m.id)}">${esc(m.name)}<span class="snd-x" data-delmix="${esc(m.id)}" title="Delete mix" role="button" aria-label="Delete ${esc(m.name)}">×</span></button>`).join('')
            : '<span class="snd-empty">Blend a few sounds, then save the mix here.</span>';
    }
    function saveMixes() { try { localStorage.setItem(MIXES_KEY, JSON.stringify(mixes)); } catch (e) {} renderMixes(); }
    function saveMix() {
        const mix = liveMix();
        if (!Object.keys(mix).length) { toast('Turn on a few sounds first.'); return; }
        const name = (prompt('Name this mix', Object.keys(mix).map(id => chan(id).name).join(' + ')) || '').trim();
        if (!name) return;
        mixes = [{ id: 'm' + Date.now().toString(36), name: name.slice(0, 40), mix }, ...mixes].slice(0, 12);
        saveMixes();
        toast('Mix saved');
    }
    function applyMix(mix) {
        Object.keys(live).forEach(id => { if (!(id in mix)) chStop(id); });
        Object.entries(mix).forEach(([id, v]) => {
            if (!chan(id)) return;
            chSetVol(id, v);
            const r = root && root.querySelector(`[data-vol="${id}"]`);
            if (r) r.value = v;
            chStart(id);
        });
        afterChange();
    }

    function refreshNowPlaying() {
        const np = nowPlaying(), st = station(S.station);
        const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
        set('snd-np-title', np.title);
        set('snd-np-sub', np.artist);
        set('snd-np-eyebrow', musicOn() ? 'Now playing' : anyAmb() ? 'Ambience' : 'Music');
        const art = $('snd-art');
        if (art) { art.style.setProperty('--c1', np.station.c[0]); art.style.setProperty('--c2', np.station.c[1]); }
        // sidebar + mobile mini player
        set('sidebar-track-title', musicOn() ? np.title : anyAmb() ? 'Ambience' : 'Lo-Fi & Radio');
        set('sidebar-track-sub', musicOn() ? st.name : anyAmb() ? np.title : 'Ad-free music');
        set('mob-track-name', np.title);
        set('mob-track-sub', musicOn() ? np.artist : 'Ambience');
        mediaSession();
    }

    const PLAY_SVG = '<svg class="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><polygon points="6 4 20 12 6 20 6 4"/></svg>';
    const PAUSE_SVG = '<svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';

    function refreshUI() {
        const on = musicOn();
        if (root) {
            root.querySelectorAll('[data-station]').forEach(b => {
                b.classList.toggle('is-selected', b.dataset.station === S.station);
                b.classList.toggle('is-playing', on && b.dataset.station === S.station);
                b.classList.toggle('is-loading', loading === b.dataset.station);
            });
            root.querySelectorAll('[data-ch]').forEach(t => {
                const a = !!live[t.dataset.ch];
                t.classList.toggle('on', a);
                t.querySelector('button').setAttribute('aria-pressed', a);
            });
            const p = $('snd-play');
            if (p) { p.innerHTML = on ? PAUSE_SVG.replace('w-4 h-4', 'w-7 h-7') : PLAY_SVG.replace('w-4 h-4', 'w-7 h-7'); p.setAttribute('aria-label', on ? 'Pause' : 'Play'); }
        }
        const sb = $('sidebar-play-btn');
        if (sb) { sb.innerHTML = on ? PAUSE_SVG : PLAY_SVG; sb.classList.toggle('text-indigo-500', on); }
        const icon = $('music-icon'), cv = $('music-viz');
        if (icon) icon.classList.toggle('opacity-0', anything());
        if (cv) cv.classList.toggle('opacity-0', !anything());
        app.updateMobileMusicBar();
        refreshNowPlaying();
        if (anything()) startViz();
    }

    // Visualiser: analyser data for in-browser audio; a gentle synthetic
    // motion for radio (cross-origin streams can't be analysed).
    let vizRaf = 0;
    function startViz() {
        if (vizRaf) return;
        const data = new Uint8Array(32);
        const loop = () => {
            if (!anything()) { vizRaf = 0; clearViz(); return; }
            vizRaf = requestAnimationFrame(loop);
            if (document.hidden) return;
            const t = performance.now() / 1000;
            if (analyser) analyser.getByteFrequencyData(data);
            const level = i => {
                const a = analyser ? data[Math.min(31, 1 + i * 2)] / 255 : 0;
                const fake = Radio.playing ? 0.35 + 0.3 * Math.sin(t * (2 + i * 0.7) + i) * Math.sin(t * 1.3 + i * 2) : 0;
                return Math.max(a, Math.abs(fake));
            };
            const sc = $('music-viz');
            if (sc && sc.offsetParent) {
                const c = sc.getContext('2d'), w = sc.width, h = sc.height;
                c.clearRect(0, 0, w, h); c.fillStyle = 'rgba(255,255,255,0.9)';
                for (let i = 0; i < 5; i++) { const bh = Math.max(3, Math.pow(level(i), 1.6) * h * 0.7); c.fillRect(6 + i * 6, (h - bh) / 2, 4, bh); }
            }
            const big = $('snd-viz');
            if (big && big.offsetParent) {
                const c = big.getContext('2d'), w = big.width, h = big.height, n = 24, cx = w / 2, cy = h / 2;
                c.clearRect(0, 0, w, h);
                c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineCap = 'round'; c.lineWidth = 6;
                for (let i = 0; i < n; i++) {
                    const a = (i / n) * Math.PI * 2 + t * 0.15, v = level(i % 12);
                    const r0 = w * 0.2, r1 = r0 + 12 + v * w * 0.2;
                    c.globalAlpha = 0.45 + v * 0.55;
                    c.beginPath(); c.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); c.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); c.stroke();
                }
                c.globalAlpha = 1;
            }
        };
        loop();
    }
    function clearViz() {
        ['music-viz', 'snd-viz'].forEach(id => { const c = $(id); if (c) c.getContext('2d').clearRect(0, 0, c.width, c.height); });
    }

    // ═════════════════════════════════════════════════════════════
    // Public API (keeps the names the rest of the app already calls)
    // ═════════════════════════════════════════════════════════════
    Object.assign(app, {
        toggleMusic() { if (musicOn()) pauseMusic(); else playMusic(); },
        musicPlay(id) { return playMusic(id); },
        musicNext() { nextTrack(); },
        musicSetVol(v) {
            S.musicVol = parseFloat(v); save();
            if (musicBus) musicBus.gain.setTargetAtTime(curve(S.musicVol), ctx.currentTime, 0.05);
            Radio.setVol();
        },
        drawVisualizer() { startViz(); },
        soundToggleAll() { toggleAll(); },

        mixerToggle(id) {
            if (!chan(id)) return;
            if (live[id]) chStop(id);
            else {
                if (S.vols[id] < 0.05) { S.vols[id] = chan(id).def; const r = root && root.querySelector(`[data-vol="${id}"]`); if (r) r.value = S.vols[id]; }
                chStart(id);
            }
            afterChange();
        },
        mixerSetVol(id, v) { chSetVol(id, parseFloat(v)); },
        mixerSetMaster(v) {
            S.master = parseFloat(v); save();
            if (master) master.gain.setTargetAtTime(S.master * fadeMul, ctx.currentTime, 0.05);
            Radio.setVol();
            const p = $('snd-master-pct'); if (p) p.textContent = Math.round(S.master * 100) + '%';
        },
        // stopAll(true) from the Stop-all button also stops the music
        mixerStopAll(includeMusic) {
            Object.keys(live).forEach(id => chStop(id));
            if (includeMusic) pauseMusic();
            afterChange();
        },
        mixerPreset(name) {
            const p = PRESETS.find(x => x.id === name) || PRESETS.find(x => x.id === ({ cafe: 'rainycafe', rain: 'storm', nature: 'forest', cozy: 'cabin' })[name]);
            if (p) { applyMix(p.mix); toast(`${p.emoji} ${p.name}`); }
        },
        soundSleep(min) { setSleep(min); },
        toggleNoise(type) { this.mixerToggle(type === 'nature' ? 'birds' : type === 'coffee' ? 'cafe' : type); },
        stopNoise() { this.mixerStopAll(); },
        setVolume(v) { this.mixerSetMaster(v); },

        updateMobileMusicBar() {
            const bar = $('mobile-music-bar');
            if (!bar) return;
            bar.classList.toggle('visible', anything());
            const btn = $('mob-play-btn');
            if (btn) btn.innerHTML = anything() ? PAUSE_SVG : PLAY_SVG;
        },
        _sound: { S, live, Lofi, Radio, STATIONS, CHANNELS, PRESETS, GEN, nowPlaying, ensureCtx, get ctx() { return ctx; } },
    });

    // Space bar on the Sounds tab toggles music; render when the DOM is ready.
    document.addEventListener('keydown', e => {
        if (e.code !== 'Space' || app.currentTab !== 'audio') return;
        if (/INPUT|TEXTAREA|SELECT|BUTTON/.test(document.activeElement && document.activeElement.tagName) || document.activeElement.isContentEditable) return;
        e.preventDefault(); app.toggleMusic();
    });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render); else render();
})();

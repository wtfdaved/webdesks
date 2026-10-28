// Survey Says — answer grouping and guess matching.
// Shared by the host page (family-feud.html) and the tests. No dependencies.
(function (root) {
    const ARTICLES = /^(a|an|the|my|your|some|his|her|their|our)\s+/;

    // "The Apples!" → "apple"
    function normalize(s) {
        let t = String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
        t = t.replace(/&/g, ' and ').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
        t = t.replace(ARTICLES, '');
        return t.split(' ').map(singular).join(' ');
    }

    function singular(w) {
        if (w.length <= 3 || /ss$|us$|is$/.test(w)) return w;
        if (/ies$/.test(w) && w.length > 4) return w.slice(0, -3) + 'y';
        if (/(ches|shes|xes|zes|sses)$/.test(w)) return w.slice(0, -2);
        if (/oes$/.test(w)) return w.slice(0, -2);
        if (/s$/.test(w)) return w.slice(0, -1);
        return w;
    }

    function bigrams(s) {
        const t = s.replace(/\s+/g, '');
        const out = new Map();
        for (let i = 0; i < t.length - 1; i++) {
            const g = t.slice(i, i + 2);
            out.set(g, (out.get(g) || 0) + 1);
        }
        return out;
    }

    // 0..1 — Sørensen–Dice on letter pairs. Deliberately no "contains" rule:
    // "pine apple" must not count as "apple". Hosts merge true synonyms by hand.
    function similarity(a, b) {
        a = normalize(a); b = normalize(b);
        if (!a || !b) return 0;
        if (a === b) return 1;
        if (a.replace(/\s/g, '') === b.replace(/\s/g, '')) return 0.98;
        if (Math.min(a.length, b.length) < 3) return 0;
        const A = bigrams(a), B = bigrams(b);
        let inter = 0, total = 0;
        A.forEach((n, g) => { total += n; if (B.has(g)) inter += Math.min(n, B.get(g)); });
        B.forEach(n => { total += n; });
        return total ? (2 * inter) / total : 0;
    }

    const titleCase = s => String(s).trim().replace(/\s+/g, ' ').replace(/\b([a-z])/g, (m, c) => c.toUpperCase());

    // Raw answers → [{ label, count, aliases:[normalized…] }] most-said first.
    function groupAnswers(raw, threshold = 0.82) {
        const counts = new Map();   // normalized → { n, variants: Map(raw → n) }
        raw.forEach(r => {
            const n = normalize(r);
            if (!n) return;
            if (!counts.has(n)) counts.set(n, { n: 0, variants: new Map() });
            const c = counts.get(n);
            c.n++;
            const v = String(r).trim();
            c.variants.set(v, (c.variants.get(v) || 0) + 1);
        });
        const keys = [...counts.keys()].sort((a, b) => counts.get(b).n - counts.get(a).n || a.localeCompare(b));
        const groups = [];
        keys.forEach(k => {
            const c = counts.get(k);
            let best = null, bestScore = 0;
            groups.forEach(g => {
                const s = Math.max(...g.aliases.map(a => similarity(a, k)));
                if (s > bestScore) { bestScore = s; best = g; }
            });
            if (best && bestScore >= threshold) {
                best.count += c.n;
                best.aliases.push(k);
                c.variants.forEach((n, v) => best._variants.set(v, (best._variants.get(v) || 0) + n));
            } else {
                groups.push({ count: c.n, aliases: [k], _variants: new Map(c.variants) });
            }
        });
        return groups.map(g => {
            // Label from the most common spelling of the most common form ("Strawberry", not a one-off "Strawbery").
            const main = [...g._variants.entries()].filter(([v]) => normalize(v) === g.aliases[0]);
            const label = (main.length ? main : [...g._variants.entries()]).sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)[0][0];
            return { label: titleCase(label), count: g.count, aliases: g.aliases };
        }).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    }

    // Re-apply a host's saved edits (renames, merges, hidden answers) to the
    // current responses, so answers that arrived later still land correctly.
    function applySaved(saved, raw, threshold = 0.82) {
        if (!Array.isArray(saved) || !saved.length) return groupAnswers(raw, threshold);
        const groups = saved.map(g => ({ label: g.label, hidden: !!g.hidden, aliases: [...(g.aliases || [])], count: 0 }));
        const leftovers = [];
        raw.forEach(r => {
            const n = normalize(r);
            if (!n) return;
            const g = groups.find(x => x.aliases.includes(n));
            if (g) g.count++; else leftovers.push(r);
        });
        groupAnswers(leftovers, threshold).forEach(nw => {
            let best = null, bestScore = 0;
            groups.forEach(g => {
                const s = Math.max(similarity(g.label, nw.label), ...g.aliases.map(a => similarity(a, nw.aliases[0])));
                if (s > bestScore) { bestScore = s; best = g; }
            });
            if (best && bestScore >= threshold) { best.count += nw.count; best.aliases.push(...nw.aliases); }
            else groups.push({ ...nw, hidden: false });
        });
        return groups.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    }

    // The board: up to 8 answers said at least `minCount` times, scored out of 100 like the show.
    function buildBoard(groups, minCount = 2, totalAnswers, max = 8) {
        const total = totalAnswers || groups.reduce((n, g) => n + g.count, 0) || 1;
        return groups
            .filter(g => !g.hidden && g.count >= minCount)
            .slice(0, max)
            .map(g => ({ label: g.label, count: g.count, aliases: g.aliases, points: Math.max(1, Math.round((g.count / total) * 100)) }));
    }

    // Every word the host typed appears in the answer ("coffee" → "Make coffee").
    // One-directional on purpose: "pine apple" must not hit "Apple".
    function wordsWithin(guess, answer) {
        const g = normalize(guess).split(' ').filter(w => w.length >= 3);
        const a = new Set(normalize(answer).split(' '));
        return g.length > 0 && g.join('').length >= 4 && g.every(w => a.has(w)) ? 0.8 : 0;
    }

    // Which board slot does the host's typed answer match? -1 if none.
    function matchGuess(guess, board, threshold = 0.72) {
        const n = normalize(guess);
        if (!n) return -1;
        let best = -1, bestScore = 0;
        board.forEach((b, i) => {
            const s = Math.max(similarity(n, b.label), wordsWithin(n, b.label), ...(b.aliases || []).map(a => Math.max(similarity(n, a), wordsWithin(n, a))));
            if (s > bestScore) { bestScore = s; best = i; }
        });
        return bestScore >= threshold ? best : -1;
    }

    const api = { normalize, similarity, groupAnswers, applySaved, buildBoard, matchGuess, titleCase };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.SurveyLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);

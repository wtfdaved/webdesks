// Badges for a Public Desk, derived from the summary the app publishes.
// Shared by the in-app preview (growth.js) and the public page
// (functions/u/[username].js) so both always agree.
(function (root) {
    const TIERS = [
        { key: 'streak', icon: '🔥', label: n => `${n}-day focus streak`, steps: [3, 7, 14, 30, 100], value: s => s.focusStreak || 0 },
        { key: 'pomodoros', icon: '🍅', label: n => `${n} Pomodoros`, steps: [1, 10, 50, 100, 500, 1000], value: s => s.pomodoros || 0 },
        { key: 'hours', icon: '⏱️', label: n => `${n}h focused`, steps: [1, 5, 25, 100, 250, 1000], value: s => Math.floor((s.focusMin || 0) / 60) },
        { key: 'town', icon: '🏙️', label: (n, s) => `${s.town && s.town.levelName || 'Town'} builder`, steps: [2, 3, 4, 5, 6], value: s => (s.town && s.town.level) || 0 },
        { key: 'gift', icon: '🎁', label: n => `${n}-day daily-gift run`, steps: [3, 7], value: s => (s.town && s.town.giftStreak) || 0 }
    ];

    // Highest earned tier of each badge, plus the next one to aim for.
    function badges(stats) {
        const s = stats || {};
        const earned = [], next = [];
        TIERS.forEach(t => {
            const v = t.value(s);
            const got = t.steps.filter(n => v >= n);
            const up = t.steps.find(n => v < n);
            if (got.length) earned.push({ key: t.key, icon: t.icon, label: t.label(got[got.length - 1], s), tier: got.length });
            if (up !== undefined) next.push({ key: t.key, icon: t.icon, label: t.label(up, { town: { levelName: ['', 'Campsite', 'Hamlet', 'Village', 'Town', 'City', 'Capital'][up] } }), progress: Math.min(1, v / up) });
        });
        return { earned, next };
    }

    // A skyline that grows with the town's level (1 Campsite … 6 Capital).
    const SKYLINE = ['⛺🔥', '⛺🏠🌾', '🏠🌳🏡🌾', '🏡🏘️🌳⛲🏡', '🏘️🏢🌳🏛️🏡🏢', '🏙️🏢🏛️🌳🏰🏢🏙️'];
    const skyline = level => SKYLINE[Math.max(0, Math.min(SKYLINE.length - 1, (level || 1) - 1))];

    const api = { badges, skyline };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.WD_BADGES = api;
})(typeof window !== 'undefined' ? window : this);

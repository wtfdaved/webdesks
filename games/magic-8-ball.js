/* ═══════════════════════════════════════════════════════════════
   Magic 8 Ball — answers and the "ask" logic, shared by the full page
   (/games/magic-8-ball) and the dashboard widget in index.html.

   window.Magic8 = {
     THEMES, ORDER,                // id → { name, emoji, blurb, answers: { yes, no, maybe }, open }
     ask(question, themeId, opts)  // → { text, lean, theme, note }
     mountMini(el)                 // the small dashboard version
   }

   Answers are picked at random but never repeat one of the last few, so
   asking five times in a row doesn't show the same joke twice.
   ═══════════════════════════════════════════════════════════════ */
(() => {
    const THEMES = {
        classic: {
            name: 'Classic', emoji: '🎱',
            blurb: 'The original, with a sarcastic streak.',
            open: [
                'I’m an 8 ball, not a search engine. Try a yes-or-no question.',
                'Big question. Tiny triangle. Rephrase it as yes or no?',
                'I only do yes, no and dramatic maybes. Try again.'
            ],
            answers: {
                yes: [
                    'It is certain. Annoyingly so.',
                    'Yes — and I’d bet money on it, if I had pockets.',
                    'Signs point to yes. The signs are very insistent.',
                    'Absolutely. Tell everyone I said so.',
                    'Yes. Act surprised.',
                    'The stars aligned and they said “duh.”',
                    'Without a doubt. I’d high-five you if I had hands.',
                    'Yes. Write that down.',
                    'Outlook good. Outlook also has 47 unread emails, but good.'
                ],
                no: [
                    'My sources say no. My sources are me.',
                    'Hard pass.',
                    'Not in this timeline.',
                    'No. Please don’t make me say it twice.',
                    'Outlook not so good. Outlook also crashed.',
                    'Absolutely not, but I admire the optimism.',
                    'Very doubtful. Like, “pineapple on a birthday cake” doubtful.',
                    'Don’t count on it. Count on literally anything else.',
                    'The answer is no, and the triangle is tired.'
                ],
                maybe: [
                    'Ask again after coffee.',
                    'Reply hazy. I left my glasses in another dimension.',
                    'Concentrate and ask again. Louder this time.',
                    'Cannot predict now. Buffering…',
                    'Maybe. I’m a plastic ball, not a miracle worker.',
                    '50/50 — which is just a coin with extra steps.',
                    'Better not tell you now. It’s a surprise.',
                    'Shake me harder. Gently. You know what I mean.'
                ]
            }
        },
        cat: {
            name: 'Cat', emoji: '🐱',
            blurb: 'Purr-dictions from a ball that ignores you on purpose.',
            open: [
                'I only answer yes-or-no questions. And only when I feel like it.',
                'That’s not a yes-or-no question. I’m going back to sleep.',
                'Meow? Ask me something I can answer with a slow blink.'
            ],
            answers: {
                yes: [
                    'Paws-itively yes.',
                    'Fur sure!',
                    'Yes. Now feed me.',
                    'Meow-velous idea. Do it.',
                    'Claw-some. That’s a yes.',
                    'Litter-ally yes.',
                    'Purr-fect. Absolutely.',
                    'Yes — I’d stake all nine lives on it.',
                    'The cat’s out of the bag: YES.',
                    'Im-paw-sible to say no to that.'
                ],
                no: [
                    'Hiss. That’s a no.',
                    'Not a feline chance.',
                    'I knocked that idea off the table.',
                    'Me-OWch. No.',
                    'Cat-egorically no.',
                    'I’d rather take a bath.',
                    'Fur-get about it.',
                    'No. And I’m coughing up a hairball about it.',
                    'Paw-sitively not.',
                    'That’s a cat-astrophe waiting to happen.'
                ],
                maybe: [
                    'I’m napping. Ask again in 16 hours.',
                    'Purr-haps.',
                    'Ask later — I’m busy staring at a wall.',
                    'My whiskers are undecided.',
                    'Curiosity killed the cat. I’m not risking it.',
                    'Wave a laser pointer and I’ll decide.',
                    'I have nine lives and none of them know.',
                    'Feline unsure. Ask again.',
                    'Let me sit on your keyboard and think about it.'
                ]
            }
        },
        dog: {
            name: 'Dog', emoji: '🐶',
            blurb: 'An over-excited good boy who wants you to win.',
            open: [
                'I only know yes, no and “walk.” Try a yes-or-no question!',
                'Head tilt. That’s not a yes-or-no question, friend.',
                'I fetched your question but dropped the answer. Yes or no, please!'
            ],
            answers: {
                yes: [
                    'YES! Who’s a good question? You are!',
                    'Pawsitively, absolutely, tail-waggingly yes.',
                    'WOOF. That’s dog for yes.',
                    'Fetch it! Go! GO!',
                    'Doggone right.',
                    'Best idea since bacon. Yes.',
                    'Yes. Good human.',
                    'Fur real? Yes!',
                    'Bow-WOW, that’s a yes.',
                    'My tail is wagging so hard it’s a yes.'
                ],
                no: [
                    'Ruh-roh. No.',
                    'That idea belongs in the doghouse.',
                    'I’d rather go to the vet.',
                    'Nope. Bury that one in the backyard.',
                    'Bad idea. Sit. Stay.',
                    'Not even for a belly rub.',
                    'Drop it. Leave it. No.',
                    'That’s a ruff no.',
                    'Paws off that plan.',
                    'Barking up the wrong tree, pal.'
                ],
                maybe: [
                    'Ask again after walkies.',
                    'SQUIRREL! …sorry, what was the question?',
                    'I’m chasing my tail on this one.',
                    'Sniffing around… results unclear.',
                    'Paws for thought. Ask again.',
                    'Throw the ball again and I’ll tell you.',
                    'My nose says maybe.',
                    'I buried the answer. I forget where.',
                    'Ruff call. Try again.'
                ]
            }
        },
        work: {
            name: 'Office', emoji: '💼',
            blurb: 'Corporate wisdom from a ball with a calendar invite.',
            open: [
                'Please resubmit as a yes-or-no question, per the template.',
                'That’s a whole workshop. Can we scope it to yes or no?',
                'Out of scope. Let’s align on a yes-or-no question.'
            ],
            answers: {
                yes: [
                    'Approved. Ship it.',
                    'Per my last prophecy: yes.',
                    'Synergy says yes.',
                    'Green light. Loop me in.',
                    'Yes — and that’s a promotion-worthy idea.',
                    'This could have been an email. Still yes.',
                    'Leadership is aligned: yes.',
                    'Yes. Block the time before someone else does.'
                ],
                no: [
                    'Let’s take this offline. Forever.',
                    'Blocked by legal.',
                    'That’s a no, with action items.',
                    'Not in this quarter’s budget. Or the next one.',
                    'Hard no. Reply-all if you disagree.',
                    'The answer is no. This meeting is over.',
                    'Deprioritised. Indefinitely.',
                    'No, and HR would like a word.'
                ],
                maybe: [
                    'Let’s circle back.',
                    'Let’s put a pin in it.',
                    'Needs more stakeholders.',
                    'That’s a Q4 problem.',
                    'Let me check my bandwidth.',
                    'Waiting on approval from someone who’s on holiday.',
                    'Let’s schedule a meeting to discuss the meeting.',
                    'Pending. Like everything else.'
                ]
            }
        },
        random: {
            name: 'Random', emoji: '🎲',
            blurb: 'Pure chaos: any theme, plus answers from a ball that’s been up too long.',
            open: [
                'That’s a big question. Here’s a small answer: probably?',
                'Ask a sandwich. They know things.',
                'Not a yes-or-no question, but I’ll allow it. Next!'
            ],
            answers: {
                yes: [
                    'Yes, but only on Tuesdays.',
                    'The council of pigeons has voted yes.',
                    'Yes. A raccoon told me in confidence.',
                    'Ten out of ten ghosts agree: yes.',
                    'Yes, and the moon is weirdly into it.',
                    'Yes! Cue the dramatic music.'
                ],
                no: [
                    'No, but a goose would.',
                    'The vibes say no. The vibes are rarely wrong.',
                    'My crystal ball is in the shop. This loaner says no.',
                    'No. The toaster agrees.',
                    'Nope. Not even in the multiverse.',
                    'No. I asked a fortune cookie to be sure.'
                ],
                maybe: [
                    'Flip a pancake. If it lands, yes.',
                    'Results unclear. Try sacrificing a snack.',
                    'The answer is hiding in your couch cushions.',
                    'Maybe. The wind is still deciding.',
                    'Ask again when Mercury stops being weird.',
                    'I’m 60% sure. The other 40% is a sandwich.'
                ]
            }
        }
    };

    const ORDER = ['classic', 'cat', 'dog', 'work', 'random'];
    const recent = [];
    let lastQuestion = '';

    const pick = list => {
        const fresh = list.filter(a => !recent.includes(a));
        const pool = fresh.length ? fresh : list;
        const choice = pool[Math.floor(Math.random() * pool.length)];
        recent.push(choice);
        if (recent.length > 8) recent.shift();
        return choice;
    };

    // "What should I eat?" can't be answered with yes or no; "Should I…?" can.
    const isOpenQuestion = q => /^(what|why|how|when|where|who|whom|whose|which)\b/i.test(q.trim())
        && !/^(what if|how about)\b/i.test(q.trim());
    const norm = q => q.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

    function ask(question, themeId) {
        const q = String(question || '').trim();
        let themeKey = THEMES[themeId] ? themeId : 'classic';
        // Random: a third of the time its own chaos answers, otherwise any theme.
        if (themeKey === 'random' && Math.random() > 0.34) themeKey = ORDER[Math.floor(Math.random() * 4)];
        const theme = THEMES[themeKey];
        let note = '';
        if (q && norm(q) === lastQuestion) note = 'Asking twice won’t change fate… but here’s a second opinion.';
        lastQuestion = norm(q);
        if (q && isOpenQuestion(q) && Math.random() < 0.7) {
            return { text: pick(theme.open), lean: 'open', theme: themeKey, note };
        }
        // Slightly optimistic, like the original: 45% yes, 30% no, 25% maybe.
        const r = Math.random();
        const lean = r < 0.45 ? 'yes' : r < 0.75 ? 'no' : 'maybe';
        return { text: pick(theme.answers[lean]), lean, theme: themeKey, note };
    }

    // ── Dashboard widget ─────────────────────────────────────────
    function mountMini(el) {
        if (!el || el.dataset.ready) return;
        el.dataset.ready = '1';
        let theme = 'classic';
        try { theme = localStorage.getItem('webdesks_8ball_theme') || 'classic'; } catch (e) {}
        if (!THEMES[theme]) theme = 'classic';
        const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        el.innerHTML = `
            <div class="widget-head"><span class="widget-label text-fuchsia-600 dark:text-fuchsia-400">Magic 8 Ball</span>
                <a href="/games/magic-8-ball" class="home-link text-xs">Full ball <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i></a></div>
            <div class="m8-mini">
                <button type="button" class="m8-mini-ball" aria-label="Shake the Magic 8 Ball"><span class="m8-mini-win"><span class="m8-mini-tri" aria-live="polite">8</span></span></button>
                <div class="m8-mini-side">
                    <div class="m8-mini-themes" role="group" aria-label="Ball theme">${ORDER.map(id => `<button type="button" data-t="${id}" title="${esc(THEMES[id].name)}" aria-pressed="${id === theme}">${THEMES[id].emoji}</button>`).join('')}</div>
                    <form class="m8-mini-form"><input type="text" maxlength="140" placeholder="Ask a yes-or-no question…" aria-label="Your question" class="widget-input flex-1 min-w-0"><button type="submit" class="m8-mini-go">Ask</button></form>
                    <p class="m8-mini-answer" aria-live="polite">Type a question, then shake.</p>
                </div>
            </div>`;
        const ball = el.querySelector('.m8-mini-ball');
        const tri = el.querySelector('.m8-mini-tri');
        const out = el.querySelector('.m8-mini-answer');
        const input = el.querySelector('input');
        const go = () => {
            const q = input.value.trim();
            if (!q) { out.textContent = 'Ask me something first — I’m psychic, not a mind reader.'; input.focus(); return; }
            ball.classList.remove('shaking'); void ball.offsetWidth; ball.classList.add('shaking');
            tri.textContent = '…';
            setTimeout(() => {
                const a = ask(q, theme);
                tri.textContent = THEMES[a.theme].emoji;
                out.textContent = a.text;
                ball.classList.remove('shaking');
            }, 650);
        };
        el.querySelector('form').addEventListener('submit', e => { e.preventDefault(); go(); });
        ball.addEventListener('click', go);
        el.querySelectorAll('[data-t]').forEach(b => b.addEventListener('click', () => {
            theme = b.dataset.t;
            try { localStorage.setItem('webdesks_8ball_theme', theme); } catch (e) {}
            el.querySelectorAll('[data-t]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
            out.textContent = THEMES[theme].blurb;
        }));
        try { window.lucide && lucide.createIcons(); } catch (e) {}
    }

    window.Magic8 = { THEMES, ORDER, ask, mountMini };
    // On the WebDesks dashboard, fill the widget slot.
    const slot = document.getElementById('w-8ball');
    if (slot) mountMini(slot);
})();

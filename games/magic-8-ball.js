/* ═══════════════════════════════════════════════════════════════
   Magic 8 Ball — answers and the "ask" logic, shared by the full page
   (/games/magic-8-ball) and the dashboard widget in index.html.

   window.Magic8 = {
     THEMES, ORDER,                // id → { name, emoji, blurb, answers: { yes, no, maybe }, open }
     ask(question, themeId)        // → { text, lean: yes|no|maybe|open|pick, theme, note }
     listen(), speak()             // voice in (Web Speech API) and out (speechSynthesis)
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

    // "Pizza or tacos?" — the ball picks one. {x} is the winner.
    const PICKS = {
        classic: ['{x}. Obviously.', '{x}. I’ve never been more sure of anything.', 'Go with {x}. Trust the triangle.', '{x}. The other one knows what it did.', 'The spirits have spoken: {x}.'],
        cat: ['{x}. The other option is beneath me.', '{x}. Now leave me alone.', '{x}. I’m a cat, so that’s final.', '{x}. I knocked the other one off the table.', 'Purr-sonally? {x}.'],
        dog: ['{x}! {x}! Definitely {x}!', '{x}! I fetched it for you!', 'Ooh, {x}! Can I come too?', 'I sniffed every option. {x} smells like a good time.', '{x}! Best choice ever! (I love them all.)'],
        work: ['{x}. Let’s align on that and move forward.', 'Leadership has chosen {x}.', '{x}. The other one is out of scope.', 'After a 3-hour meeting: {x}.', '{x}. I’ll put it in the deck.'],
        random: ['{x}, according to a very confident pigeon.', '{x}. The moon insisted.', 'The toaster picked {x}.', '{x}. A raccoon whispered it to me.', 'Eeny, meeny, miny… {x}.']
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

    // "Should I get pizza, tacos or sushi?" → ['pizza', 'tacos', 'sushi'].
    // "Will it rain or not?" stays a yes-or-no question.
    function options(q) {
        if (!/\bor\b/i.test(q)) return null;
        let body = q.replace(/[?!.]+$/, '').trim();
        const parts = body.split(/\s*,?\s+or\s+/i);
        let first = parts.shift();
        // Drop the lead-in: "What should I eat, pizza" / "Should I watch a movie".
        let pieces = first.split(/\s*[,:]\s*/);
        // "What should I eat, pizza…" — a question lead-in before the list.
        if (pieces.length > 1 && /^(what|which|where|who|how|pick|choose|decide|help)\b/i.test(pieces[0])) pieces.shift();
        pieces[0] = pieces[0]
            .replace(/^(should|shall|do|does|can|could|would|will|is|are|am)\s+(i|we|it|you|they|my|our|this|that)\s+/i, '')
            .replace(/^(pick|choose|decide)\s*/i, '');
        // "Should I eat pizza or tacos?" → pizza / tacos (but keep "watch a movie or read a book").
        if (parts.every(p => p.split(/\s+/).length <= 2)) pieces[0] = pieces[0].replace(/^(get|have|eat|order|watch|play|wear|buy|try|drink|cook|pick|choose|go with|go for|listen to)\s+/i, '');
        const list = [...pieces, ...parts].map(o => o.trim()).filter(Boolean);
        if (list.length < 2 || list.length > 6) return null;
        if (list.some(o => /^(not|no|nah|nope|never|what|anything)$/i.test(o) || o.length > 48)) return null;
        return list;
    }
    const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

    function ask(question, themeId) {
        const q = String(question || '').trim();
        let themeKey = THEMES[themeId] ? themeId : 'classic';
        // Random: a third of the time its own chaos answers, otherwise any theme.
        if (themeKey === 'random' && Math.random() > 0.34) themeKey = ORDER[Math.floor(Math.random() * 4)];
        const theme = THEMES[themeKey];
        let note = '';
        if (q && norm(q) === lastQuestion) note = 'Asking twice won’t change fate… but here’s a second opinion.';
        lastQuestion = norm(q);
        const opts = options(q);
        if (opts) {
            const winner = opts[Math.floor(Math.random() * opts.length)];
            const text = pick(PICKS[themeKey]).replace(/(^|[.?!:…]\s+)\{x\}/g, (m, p) => p + cap(winner)).split('{x}').join(winner);
            return { text, lean: 'pick', theme: themeKey, note, choice: winner };
        }
        if (q && isOpenQuestion(q) && Math.random() < 0.7) {
            return { text: pick(theme.open), lean: 'open', theme: themeKey, note };
        }
        // Slightly optimistic, like the original: 45% yes, 30% no, 25% maybe.
        const r = Math.random();
        const lean = r < 0.45 ? 'yes' : r < 0.75 ? 'no' : 'maybe';
        return { text: pick(theme.answers[lean]), lean, theme: themeKey, note };
    }

    // ── Voice: speak a question in, hear the answer out ──────────
    // Web Speech API: Chrome, Edge, Safari (macOS + iOS). Elsewhere the mic
    // button simply isn't shown and typing works as always.
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const canListen = !!Recognition;
    let active = null;
    function listen({ onText, onEnd, onError } = {}) {
        if (!canListen) return null;
        if (active) { try { active.abort(); } catch (e) {} active = null; }
        const rec = new Recognition();
        rec.lang = navigator.language || 'en-US';
        rec.interimResults = true;
        rec.maxAlternatives = 1;
        rec.continuous = false;
        let finalText = '';
        rec.onresult = e => {
            let interim = '';
            for (let i = e.resultIndex; i < e.results.length; i++) {
                const t = e.results[i][0].transcript;
                if (e.results[i].isFinal) finalText += t; else interim += t;
            }
            onText && onText((finalText + interim).trim(), false);
        };
        rec.onerror = e => { onError && onError(e.error || 'error'); };
        rec.onend = () => {
            active = null;
            let text = finalText.trim();
            // Speech has no punctuation; make it read like a question.
            if (text && !/[?!.]$/.test(text)) text += '?';
            onEnd && onEnd(cap(text));
        };
        try { rec.start(); } catch (e) { onError && onError('busy'); return null; }
        active = rec;
        return rec;
    }

    const canSpeak = 'speechSynthesis' in window;
    const VOICE = { classic: [1, .95], cat: [1.45, 1], dog: [1.25, 1.15], work: [.85, .95], random: [1.1, 1.05] };
    function speak(text, themeKey) {
        if (!canSpeak || !text) return;
        try {
            speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(text.replace(/[“”]/g, ''));
            const [pitch, rate] = VOICE[themeKey] || VOICE.classic;
            u.pitch = pitch; u.rate = rate;
            u.lang = navigator.language || 'en-US';
            speechSynthesis.speak(u);
        } catch (e) {}
    }
    const micError = code => code === 'not-allowed' || code === 'service-not-allowed'
        ? 'Microphone blocked. Allow it in your browser settings, or just type.'
        : code === 'no-speech' ? 'I didn’t catch that. Tap the mic and try again.'
        : code === 'network' ? 'Voice needs an internet connection. Typing works offline.'
        : 'Voice didn’t work this time. Typing always does.';

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
                <button type="button" class="m8-mini-ball" aria-label="Shake the Magic 8 Ball"><span class="m8-mini-win"><span class="m8-mini-tri">8</span></span></button>
                <div class="m8-mini-side">
                    <div class="m8-mini-themes" role="group" aria-label="Ball theme">${ORDER.map(id => `<button type="button" data-t="${id}" title="${esc(THEMES[id].name)}" aria-label="${esc(THEMES[id].name)} theme" aria-pressed="${id === theme}">${THEMES[id].emoji}</button>`).join('')}</div>
                    <form class="m8-mini-form"><input type="text" maxlength="140" placeholder="Ask, or try “pizza or tacos?”" aria-label="Your question" class="widget-input flex-1 min-w-0">${canListen ? '<button type="button" class="m8-mini-mic" aria-label="Ask out loud" title="Ask out loud">🎤</button>' : ''}<button type="submit" class="m8-mini-go">Ask</button></form>
                    <p class="m8-mini-answer" aria-live="polite">Type or say a question, then shake.</p>
                </div>
            </div>`;
        const ball = el.querySelector('.m8-mini-ball');
        const tri = el.querySelector('.m8-mini-tri');
        const out = el.querySelector('.m8-mini-answer');
        const input = el.querySelector('input');
        const mic = el.querySelector('.m8-mini-mic');
        let viaVoice = false;
        const go = () => {
            const q = input.value.trim();
            if (!q) { out.textContent = 'Ask me something first — I’m psychic, not a mind reader.'; input.focus(); return; }
            ball.classList.remove('shaking'); void ball.offsetWidth; ball.classList.add('shaking');
            tri.textContent = '…';
            const spoken = viaVoice; viaVoice = false;
            setTimeout(() => {
                const a = ask(q, theme);
                tri.textContent = THEMES[a.theme].emoji;
                out.textContent = a.text;
                ball.classList.remove('shaking');
                if (spoken) speak(a.text, a.theme);
            }, 650);
        };
        el.querySelector('form').addEventListener('submit', e => { e.preventDefault(); go(); });
        ball.addEventListener('click', go);
        if (mic) mic.addEventListener('click', () => {
            if (mic.classList.contains('listening')) { try { active && active.stop(); } catch (e) {} return; }
            mic.classList.add('listening'); out.textContent = 'Listening… ask your question.';
            listen({
                onText: t => { input.value = t; },
                onEnd: t => { mic.classList.remove('listening'); if (t) { input.value = t; viaVoice = true; go(); } },
                onError: c => { mic.classList.remove('listening'); out.textContent = micError(c); }
            });
        });
        el.querySelectorAll('[data-t]').forEach(b => b.addEventListener('click', () => {
            theme = b.dataset.t;
            try { localStorage.setItem('webdesks_8ball_theme', theme); } catch (e) {}
            el.querySelectorAll('[data-t]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
            out.textContent = THEMES[theme].blurb;
        }));
        try { window.lucide && lucide.createIcons(); } catch (e) {}
    }

    window.Magic8 = { THEMES, ORDER, ask, options, listen, speak, canListen, canSpeak, micError, mountMini };
    // On the WebDesks dashboard, fill the widget slot.
    const slot = document.getElementById('w-8ball');
    if (slot) mountMini(slot);
})();

# WebDesks

A browser-native productivity suite: 28 tools in a single tab, no required
account, no upload, no bundler. `index.html` is the whole application — vanilla JS on top
of Tailwind and Lucide, with everything persisted to `localStorage` and every
file operation done locally.

**Live:** https://webdesks.app

## Tools

| Group | Tools |
| --- | --- |
| **Life planner** | **Today** (morning check-in), **Calendar** (month / week / day / agenda), **Pages** (Notion-style), **Chores** (ADHD organiser), **Bills** |
| Focus | Focus Timer (Pomodoro), **Focus Town**, **Sounds** (ad-free Lo-fi + ambience mixer), Breathing Guide, On Air, Desk Clock, Stopwatch |
| Work | Scratchpad, Task Manager, Project Board, Whiteboard, Time Zones |
| Files & media | PDF Merger, Screen Recorder, Media Converter (WebM → MP4, image resize) |
| Utilities | Calculator, Unit Converter, Colour Picker, **Dev Toolkit**, **Image to Text (OCR)** |
| **Group Games** (`/games/`) | **Survey Says** — a survey game show: collect answers with one link, then play the board live in a call or on the TV |

Press <kbd>⌘K</kbd> / <kbd>Ctrl</kbd>+<kbd>K</kbd> anywhere to open the command
palette and jump to any tool or action.

## Life planner

The planner is built to be the tab you open every morning. It lives in
`life.js`, which extends `app` and shares its storage and helpers.

- **Today** — mood (shared with the dashboard tracker), energy level, a
  one-line journal, top 3 priorities, and one agenda that merges calendar
  events, due and overdue tasks, today's chores and bills due in the next week.
  A brain-dump box drops tasks into today, tomorrow or the inbox. It opens
  automatically on the first visit of each day (toggle at the bottom).
- **Calendar** — FullCalendar month, week, day and agenda views. Events, dated
  tasks, chores and bills are separate layers you can toggle. Drag a task or
  event to reschedule it; click a bill to mark it paid. Events and bills
  export to `.ics` for Google, Apple or Outlook.
- **Tasks** gained a due date plus Today / Upcoming / Inbox filters, so the
  Task Manager *is* the planner's to-do list; dated tasks show on the calendar.
- **Pages** — an Editor.js block editor with headings, lists, checklists,
  quotes, tables, highlights and `/` commands. Templates for a mood board, a
  daily journal, a weekly review, a brain dump, money notes, a meal plan and
  goals. Pages export to Markdown.
- **Chores** — 70+ premade chores in 11 categories, each with minutes, an
  energy level (🔋 ⚡ 🔥), how often it repeats and tiny steps. One-click
  routine packs (Morning launch, Evening shutdown, Weekly home reset, Money on
  autopilot, ADHD starter kit). The scheduler spreads chores across the week
  using your scheduling needs: a daily minute budget, chore-free days, a
  preferred weekday per chore and your best time of day. ADHD helpers: "Just
  pick one for me", a body-doubling countdown timer, "Not today" snoozing,
  low-energy sorting, streaks, points and confetti.
- **Bills** — recurring due dates (weekly to yearly), autopay, paid tracking
  per due date, overdue alerts, monthly totals and a by-category breakdown.
- **Back up / Restore** (in the Pages sidebar) saves every planner store to one
  JSON file.

## Survey Says (`/family-feud`, `/survey`)

A Family Feud–style game for meetings and parties.

1. **Create** (signed in): a name, 3–5 questions, when to stop collecting
   (15 minutes to a week, or no timer) and how many people must give an answer
   for it to make the board (default 2).
2. **Share** the link (`/survey?g=<code>`) or show the QR code — **📺 Join
   screen** puts a giant QR code, the link and a live answer count full-screen
   for a TV or a shared call window. People answer on
   any phone, one question per screen, no account; one set of answers per
   device. The close time is enforced in the database, and **Close survey** stops
   it immediately (**Reopen** restarts it).
3. **Review**: answers are grouped automatically ("Apple", "apples", "an apple"
   count together, typos like "strawbery" too). Merge answers that mean the same
   thing, rename them or hide them; edits are saved and still apply to answers
   that arrive later.
4. **Play**: a full-screen game-show board. Up to 8 answers, scored out of 100
   by how many people said them. Type what a team guesses: if it matches an
   answer on the board the tile flips, otherwise it's a strike (3 strikes and
   the other team can steal). Award the round's points, then move on to the
   next question. **Open board in its own window** lets you screen-share just
   the board and keep the controls private. Keys: Enter = check, 1–8 = reveal,
   X = strike. A demo board works without an account.

`survey-logic.js` holds the grouping and matching (no dependencies). Data
lives in `survey_games`, `survey_questions` and `survey_responses`
(`supabase/migrations/20261029120000_survey_says.sql`). Hosts reach only their
own rows through row-level security. Respondents never touch the tables; they
call `get_survey(code)` and `submit_survey(code, token, answers)`, which only
accept answers while the game is open.

### Group Games & SEO

`/games/` is the Group Games hub (more games will be listed there) and
`/games/survey-says` is the Survey Says landing page: how it works, playing in
Microsoft Teams / Zoom / Meet, casting to a TV, question ideas and an FAQ. Both
are plain HTML with a small shared stylesheet (`games/games.css`, no Tailwind
runtime) and carry JSON-LD (`WebApplication`, `HowTo`, `FAQPage`,
`CollectionPage`/`ItemList`, `BreadcrumbList`). Two guides in the blog
(`survey-game-microsoft-teams-meeting`, `family-game-night-tv-survey-game`)
link back to them. `sitemap.xml` lists all of them and `robots.txt` points
crawlers at it and keeps personal `/survey` links and `/login` out of search.
Survey Says is described as "Family Feud–style" with a non-affiliation note.

## Dashboard upgrades (`desks.js`, v0.28)

- **Get started checklist** — brand-new visitors see three interactive steps
  in the tasks card instead of empty `0 / 0` / `--:--` widgets: *Try pressing
  ⌘K*, *Start a 25m Pomodoro*, *Save your Desk to your profile*. Each ticks
  itself off when you actually do it (palette opened, timer started, signed
  in). The empty alarm card steps aside while the checklist shows, and new
  visitors land on the Dashboard instead of the Today check-in. Anyone with
  existing data never sees it (`wd_onboard`).
- **Desk presets** — chips above the toolkit switch between *All tools*,
  **Developer** (Dev Toolkit, code Scratchpad, Pomodoro…), **Student** (Focus
  Town, Sounds mixer, Hydration…) and **Remote Work** (World Clock, On Air,
  Kanban…). A preset trims the sidebar to Dashboard/Today/Calendar/Tasks plus
  its tools ("show all" link at the bottom), swaps the toolkit tiles, adds a
  spotlight card for its three headline tools and re-orders the widgets. Also
  in ⌘K. Saved as `wd_desk_preset`, so it syncs with your Desk.
- **Morning brief & daily shutdown** — one hero button. Before noon it opens
  the brief (yesterday's log, today's tasks and meetings, a standup to copy);
  after noon it becomes **Shut down day**: unfinished tasks dated today or
  earlier move to tomorrow (`rolled` counter), today's Focus Town minutes and
  Pomodoros are logged, and a standup summary is copied to the clipboard. The
  log is kept locally (`wd_daily_log`, 90 days) and, when signed in, upserted
  to Supabase `daily_logs`. Tasks now record `doneOn` when checked off.
- **Workspace launchers** — Quick Actions gained folders ("Morning Routine",
  "Client Work", "Deep Work") that open a set of URLs, start a Sounds preset or
  saved mix, open a tool and optionally start a 25-minute focus session, in one
  click. If the browser blocks the extra tabs you get the links to click.
  `wd_launchers`; also runnable from ⌘K.
- **Daily life widgets**
  - **Snippet vault** — one-click copy for text and links you paste often,
    sorted by use, searchable, in ⌘K as "Copy: …" (`wd_snippets`).
  - **Money** — subscriptions (monthly/yearly totals, renewals this week,
    auto-advancing renewal dates) and quick expenses (today / 7 days / month),
    currency picker (`wd_subs`, `wd_expenses`, `wd_money_cur`).
  - **Calendar agenda** — paste a Google/Outlook/iCloud `.ics` (or `webcal://`)
    link and see the next 7 days, read-only. Parsed in the browser (time zones
    incl. Windows names, RRULE daily/weekly/monthly/yearly with BYDAY,
    BYMONTHDAY, COUNT, UNTIL, EXDATE, RECURRENCE-ID overrides). Calendar servers
    block browser CORS, so the feed is fetched by
    `netlify/functions/ics.mjs`, which refuses private-network hosts and
    anything that isn't `BEGIN:VCALENDAR`, and stores nothing. The parsed feed
    is cached on the device only (`wdl_ics_cache`, outside Desk sync).

## v0.30: dashboard tabs, fixes and five improvements

- **Dashboard tabs (`home.js`)** — the home screen was one long scroll. Now:
  a compact hero, search, and four tabs — **Today** (tasks / get-started,
  calendar agenda, launchers, alarm), **Focus** (timer, this week's focus,
  latest note, quote), **Life** (snippets, money, mood, hydration) and
  **Tools** (Desk presets + toolkit). Each tab is an even two-column grid
  (an odd widget out stretches across), the tab bar sticks while scrolling,
  the last tab is remembered (`wd_home_tab`), **Customize** hides widgets
  (`wd_home_hidden`, synced) and the guest card is a dismissible strip.
- **Public Desk fix** — saving now *upserts* the profile row (accounts made
  before the profiles trigger had no row, so the old update silently saved
  nothing) and checks `get_public_desk()` before saying the link is live;
  sharing defaults to on when you first pick a username. The page function
  reads the username from the path, sends only the `apikey` header, tries
  several config sources, and if it still can't reach the database it serves
  a page that loads the Desk in the browser (`public-desk-render.js` is shared
  by both).
- **iOS Safari header** — the body is pinned (`position: fixed; inset: 0`,
  Tailwind's `h-screen`/100vh removed) and `shell.js` resets any window pan
  left by the keyboard or toolbar, so the header can't get stuck off-screen.
- **Five improvements**
  1. *Faster first load* — PDF-lib, Marked, highlight.js and FFmpeg.wasm
     (hundreds of KB) load the first time a tool needs them (`app.LAZY_LIBS`).
  2. *Quick capture* — press **N** anywhere (or the floating **+** on phones)
     to add a task (smart dates), a Scratchpad note or a snippet.
  3. *This week's focus* — a Focus-tab chart of minutes per day for the last
     7 days (`wd_focus_history`, filled from Focus Town minutes and shutdown
     logs).
  4. *Branded 404 page* (`404.html`) — guesses the tool from the broken URL
     and searches every tool page.
  5. *Accessibility* — skip-to-content link, visible keyboard focus rings,
     `aria-current` on the active tool, keyboard-navigable dashboard tabs and
     a global reduced-motion rule.

## Clean tool URLs (`tool-routes.js`, v0.29)

Every tool has its own indexable URL — `/tools/whiteboard`,
`/tools/alarm-clock`, `/tools/pdf-merger` — and each Dev Toolkit utility has
one too (`/tools/json-formatter`, `/tools/jwt-decoder`, `/tools/qr-code-generator`
…): 38 in all, plus a `/tools/` index.

- `tool-routes.js` is the single table (slug, tab, title, description,
  features, related tools, matching blog post). Keep slugs stable.
- **In the app**, `/tools/<slug>` opens that tool; switching tools
  `pushState`s the clean URL (back/forward work), updates the title, meta
  description and canonical, and adds an "About this tool" card (features,
  guide, related tools) at the bottom of the panel. Old `#hash` links still
  work and are rewritten. Sidebar items and toolkit tiles are real `<a href>`
  links (⌘/Ctrl-click opens a new tab).
- **On deploy**, `scripts/build-tool-pages.mjs` writes
  `tools/<slug>/index.html` for each route: the app with that tool's
  `<title>`, description, canonical, Open Graph/Twitter tags,
  `WebApplication` + `BreadcrumbList` JSON-LD and the About card baked in, so
  crawlers get a distinct page without running JS. The output is git-ignored;
  run the script locally to preview. All URLs are in `sitemap.xml`.

## Live tools in blog posts (`embed/mini-tools.js`)

`<div class="wd-mini" data-tool="pomodoro"></div>` plus the script puts a
working mini tool at the top of an article: pomodoro, todo
(`data-target="board"` for Kanban), notepad, worldclock, status (On Air),
breathing, noise, color, stopwatch, calculator, converter, alarm. 15 posts
carry one, and the new **Remote Worker Productivity Guide**
(`/blog/remote-worker-productivity-guide`) has three. **Save to My WebDesk**
writes what the reader made into the app's own keys (tasks, board, notes,
cities, mixes, swatches, alarm, focus minutes), stamps them for Desk sync,
then offers a free account (`/login?mode=signup&next=/tools/<slug>?saved=…`)
or opens the tool; the app confirms with a toast. Self-contained: no
Tailwind or other dependencies.

## Public Desks (`/u/<username>`)

Members can share a read-only page from the account menu (or ⌘K → "Share my
Desk"): pick a username, switch on *Make my Desk public*, copy or share the
link. The page shows Focus Town's level and skyline, focus streak, Pomodoros,
hours focused, badges (`desk-badges.js`: streaks, Pomodoros, hours, town
level, daily gifts, plus the next ones to earn) and the most-played Sounds
preset (counted in `wd_mix_usage`). `growth.js` publishes that summary to
`profiles.public_stats` and refreshes it every few hours; nothing else from
the Desk leaves the account. `netlify/functions/u.mjs` renders the page on the
server (so link previews show the stats) via the `get_public_desk()` RPC,
which only answers for public Desks. Migration:
`20261101120000_public_desks_and_sponsors.sql`.

## Desk Sponsor (`sponsors.json`)

The app no longer runs AdSense or A-ADS (`ads.js data-programmatic="off"` on
`index.html` and `/tools/*`); the dashboard shows one curated sponsor or
affiliate card instead, hidden for signed-in members. Book a sponsor through
ads@webdesks.app / the contact form's *Advertising* topic (`/contact#sponsor`
describes the slot), then add an entry to `sponsors.json` (id, name, tagline,
https url, cta, logo emoji or image, `Sponsor`/`Affiliate` label, category,
Desk presets to target, start/end dates, weight) and deploy. Links get UTM
tags and `rel="sponsored"`; daily views/clicks go to `sponsor_stats` through
`log_sponsor_event()` (no user identifiers). With no live sponsor the card
invites brands to book the slot. Blog and landing pages keep their existing
ad units for guests.

## Ads (`ads.js`)

Every page loads `/ads.js` instead of the AdSense tag. Signed-in members
(a saved `sb-webdesks-auth` session) never load AdSense or A-ADS (their iframe
`src` lives in `data-src`) and every ad slot is hidden; guests get the same
ads as before plus a "Free profile = no ads" nudge on the dashboard slots. If
`account.js` finds the saved session has expired it calls `wdAds.enable()`.

## App shell (`shell.js`)

- **More sheet** (phones): every tool grouped like the sidebar, with colourful
  tiles and quick actions (Add to Home Screen, dark mode, privacy screen).
  Search opens only when you tap it, full-screen, so the keyboard can't cover
  the list.
- **Add to Home Screen**: uses the browser's install prompt where there is one
  (Android/desktop Chrome and Edge) and step-by-step instructions on
  iPhone/iPad, from the More sheet, a banner on a return visit, or ⌘K →
  "Install". The manifest has real icons (`icon-*.png`, maskable, Apple touch
  icon), screenshots and shortcuts.
- **Phone header** respects the iPhone safe area (it used to be a fixed 64 px,
  so the notch padding cut it in half) and shows the tool's name once its title
  scrolls away.
- **Offline**: registers `sw.js`, which is network-first for the site's own
  files (a deploy is live on the next load) and falls back to the cache when
  offline.
- The status bar colour follows light/dark mode.

## Focus Town (`town.js`)

A cozy isometric town that grows while WebDesks is open. Coins come in every
minute (4× while a focus session runs, plus bonuses for finished Pomodoros,
tasks and chores); spend them on houses, farms, bakeries, a windmill, a
fountain, a town hall and more. Villagers move in when there's housing and
food, wander the streets, and can be tapped for a treat. The town keeps
growing at a quarter speed while you're away (up to 12 h), there's a daily
gift with a streak, a sequence of quests, day/night lighting from your clock,
and six levels from Campsite to Capital that expand the island. Terrain is
shaped with [simplex-noise](https://github.com/jwagner/simplex-noise.js); the
town is saved under `wd_town` and syncs with your Desk.

## Sounds (`sound.js`)

The old Lo-Fi button streamed a third-party station that inserted ads (and
paid us nothing). It's replaced by two ad-free sources:

- **WebDesks Lo-fi** — four stations (Lo-fi Beats, Jazzy Café, Night Chill,
  Deep Focus) composed live by [Tone.js](https://github.com/Tonejs/Tone.js):
  jazz chord progressions with voice-leading, Rhodes-style keys, swung drums,
  walking or lo-fi bass, a repeating melody motif, tape wobble, vinyl crackle
  and a low-pass "dusty" filter. Every track gets a new key, tempo and name and
  it works offline once cached.
- **Radio** — five listener-supported [SomaFM](https://somafm.com) channels
  (Fluid, Groove Salad, Lush, Drone Zone, Deep Space One) played with
  [howler.js](https://github.com/goldfire/howler.js), with host failover and
  now-playing titles.

The **ambience mixer** synthesises 14 sounds procedurally (rain with
droplets, rolling thunder, individual ocean waves, wind gusts, a bubbling
creek, a crackling fireplace, café chatter with cup clinks, bird calls,
crickets, a fan, vinyl, white/pink/brown noise). Beds are rendered offline as
seamless stereo loops and one-shot events are scheduled at random, so it
never audibly repeats. There are eight presets, saved mixes (`wd_mixes`), a
sleep timer that fades out over the last minute, and Media Session controls
(lock screen, media keys).

## Everyday helpers (`extras.js`)

- **Smart quick add** — type "pay rent next friday 5pm" in Tasks, the
  dashboard, Today's brain dump or the ⌘K palette and it becomes a task dated
  Fri 5:00 PM titled "Pay rent". A live hint shows what was understood.
- **Search everything** — ⌘K finds tasks, events, pages (including their
  text), chores and bills as well as tools, typo-tolerant, and can add what
  you typed as a task.
- **Touch drag & drop** — reorder tasks and move board cards with a finger
  (HTML5 drag events never fire on phones).
- **Reminders** — timed tasks and events (at the time or up to an hour
  before), all-day events, bills due today/tomorrow and chore time. System
  notifications when allowed, otherwise an in-app alert with a chime. They run
  while WebDesks is open; on iPhone, system notifications need WebDesks added
  to the Home Screen.
- **Undo** — deleting a task, event, bill, chore, page or board card shows an
  Undo button for a few seconds.

## Accounts & Desk sync

Signing in is optional. Guests keep everything in `localStorage` exactly as
before; an account keeps a copy of that **Desk** in Supabase so it follows you
to any browser.

| File | Role |
| --- | --- |
| `login.html` (`/login`) | Sign in, create account (13+ consent), email magic link, forgot / set new password, Google sign-in, email-link callbacks (PKCE) |
| `account.js` | Header account button and menu (profile, sync status, download my data, change password, sign out, delete account) and the sync engine |
| `supabase-config.js` | Public project URL + anon key. Empty = accounts hidden, site runs guest-only |
| `supabase/migrations/` | `profiles` + `desks` tables, row-level security, sign-up trigger, `delete_my_account()` |
| `scripts/write-supabase-config.mjs` + `netlify.toml` | Netlify build step that writes the keys from environment variables |

**How sync works.** `account.js` timestamps every write to a `wd_*` /
`webdesks_*` key. A sync reads the user's single `desks` row, keeps the newest
value of each key from either side, and writes back using an optimistic
`version` check (retrying if another device saved in between). Changes are
pushed 2 s after you stop editing, when the tab is hidden, and pulled on focus
and every 5 minutes. When newer data arrives the page reloads to pick it up,
or shows a "Load it" bar if you're mid-typing. On first sign-in in a browser
that already has guest data you choose: combine (cloud wins per tool), use the
cloud Desk, or overwrite the cloud with this browser. Signing out saves, then
clears this browser's copy.

### One-time Supabase setup

1. **Database.** Run each file in `supabase/migrations/` in order
   (`…_profiles_and_desks.sql`, then `…_survey_says.sql`, then
   `…_daily_logs.sql`, then `…_public_desks_and_sponsors.sql`).
   The Supabase GitHub integration applies it on merge to `main` when
   "Deploy to production" is on; otherwise paste it into **SQL Editor → New
   query → Run** (it's safe to run twice).
2. **Auth URLs** (Authentication → URL Configuration): Site URL
   `https://webdesks.app`; Redirect URLs `https://webdesks.app/**` (add
   `https://*--<your-netlify-site>.netlify.app/**` to test deploy previews).
3. **Email.** Supabase's built-in mailer only delivers to your own team's
   addresses, so until you add an email provider:
   - In Authentication → Sign In / Providers → Email, turn **Confirm email
     off** and set the minimum password length to 8. New accounts are signed
     in straight away.
   - Leave `emailEnabled: false` in `supabase-config.js`. The login page then
     hides email sign-in links and "Forgot password" (it points people to
     support instead). Changing a password from the account menu still works.

   Later, add custom SMTP (Authentication → Emails → SMTP; Resend's free tier
   or a Gmail app password both work), turn Confirm email back on, and set
   `emailEnabled: true`.
4. **Google sign-in (optional, needs no email).** Create an OAuth client in
   Google Cloud with redirect URI
   `https://<project-ref>.supabase.co/auth/v1/callback`, paste its ID and
   secret into Authentication → Providers → Google, and add `'google'` to
   `providers` in `supabase-config.js`.
5. **Keys.** Put the Project URL and the **anon / publishable** key (Project
   Settings → API; never the `service_role` / secret key) into
   `supabase-config.js` and merge to `main`. Alternatively set
   `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_AUTH_PROVIDERS` and
   `SUPABASE_EMAIL_ENABLED` in the Netlify site's environment variables and the
   build step writes them for you.

## Design & performance

v0.30 reorganised the dashboard into tabs and fixed Public Desks and the
iOS Safari header (see above).

v0.29 added clean `/tools/<slug>` URLs, live tools in blog posts, Public
Desks and the Desk Sponsor card (see above).

v0.28 added the dashboard upgrades in `desks.js` and ad-free browsing for
signed-in members (see above).

v0.27 fixed the iPhone header, rebuilt the phone More sheet, added Add to Home
Screen and offline support, and started the Group Games section (see above).

v0.26 rebuilt Focus Town as a growing isometric town and replaced the ad-supported
Lo-Fi stream and the old mixer with the ad-free Sounds tab (see above).

v0.25 redesigned the home screen: a gradient hero with your greeting, today's
focus, counts of events, tasks, chores and bills due and a check-in button; a
"toolkit" grid of the main tools; and an "At a glance" bento of widgets. On
phones the header is compact, the toolkit is a two-column launcher and the
bottom bar floats with a highlighted active tab. Guests see a short "sync on
every device" sign-up card.


v0.24 replaced the frosted-glass look with solid "paper" cards, a static
background and roomier spacing (`<style id="wd-design">` in `index.html`). It
also fixed iOS Safari's "A problem repeatedly occurred" crash loop: every tab
used to stay painted as an invisible full-screen layer full of
`backdrop-filter` blurs over an animated background, roughly 790 MB of layer
memory on a 3× iPhone. Now only the active tab is painted (`visibility:
hidden` on the rest), there's no blur on touch devices, the background is
static and Focus Town only animates while it's on screen (about 57 MB).

The sidebar groups (Life Planner, Workspace, Focus, Tools) collapse on desktop;
Focus and Tools start collapsed and open automatically when you jump to one of
their tools.

## Architecture

Everything lives in `index.html`:

- A single `app` object holds state and behaviour. Tools are `.tab-content`
  panels switched by `app.switchTab(id)`.
- `app.searchItems` is the tool registry that drives the sidebar search, the
  command palette, the pinned quick actions and the mobile More drawer.
  Adding a tool means: a nav button, a `.tab-content` panel, a registry entry,
  and entries in `tabOrder` / `tabIcons` / `tabLabels` / the title map.
- `app._loadScript(url)` lazily fetches heavy libraries (qrcode, tesseract.js,
  FullCalendar, Editor.js, canvas-confetti)
  on first use and memoises the promise, so the initial page load stays light.
- `sw.js` caches the shell plus the CDN bundles, so the suite keeps working
  offline after the first visit.
- Tools are deep-linkable at clean URLs: `https://webdesks.app/tools/dev-toolkit`
  opens that tool directly (see `tool-routes.js`), which is also what the PWA
  manifest shortcuts use. Old `/#tab` links are rewritten.

Open `index.html` directly, or serve the folder (`npx http-server`) if you want
the service worker to register.

## Prior art

The tool catalogue and interaction patterns here are informed by these
open-source projects. None of their code is vendored — the implementations in
this repo are written against the browser platform directly — but the shape of
the features is theirs, and they are worth your stars:

| Project | Stars | What we took from it |
| --- | --- | --- |
| [wanasit/chrono](https://github.com/wanasit/chrono) | ~5k | Powers smart quick add (natural-language dates); loaded on first use |
| [krisk/Fuse](https://github.com/krisk/Fuse) | ~21k | Powers "search everything" in the ⌘K palette |
| [SortableJS/Sortable](https://github.com/SortableJS/Sortable) | ~31k | Touch-friendly drag & drop for Tasks and the Project Board |
| [fullcalendar/fullcalendar](https://github.com/fullcalendar/fullcalendar) | ~21k | Powers the Calendar's month/week/day/agenda views; loaded lazily |
| [codex-team/editor.js](https://github.com/codex-team/editor.js) | ~32k | Powers Pages, the Notion-style block editor, plus its official header/list/checklist/quote/table/marker plugins |
| [catdad/canvas-confetti](https://github.com/catdad/canvas-confetti) | ~13k | The celebration when you finish a chore, task or bill |
| [super-productivity/super-productivity](https://github.com/super-productivity/super-productivity) | ~23k | The daily planning ritual and time-boxing behind Today and chore time blocks |
| [iSoron/uhabits](https://github.com/iSoron/uhabits) | ~10k | Frequency-based repeats and streaks for Chores |
| [Demizo/Daily_You](https://github.com/Demizo/Daily_You) | ~1.4k | Mood journaling and the year-in-pixels view |
| [Illyism/sidejot](https://github.com/Illyism/sidejot) | ~0.1k | ADHD-first task flow: one thing at a time, timer-led starts |
| [excalidraw/excalidraw](https://github.com/excalidraw/excalidraw) | ~133k | Whiteboard interaction model |
| [Stirling-Tools/Stirling-PDF](https://github.com/Stirling-Tools/Stirling-PDF) | ~93k | Local-first PDF tooling; the merge/reorder flow |
| [CorentinTh/it-tools](https://github.com/CorentinTh/it-tools) | ~41k | The Dev Toolkit catalogue and its one-input/one-output UX |
| [naptha/tesseract.js](https://github.com/naptha/tesseract.js) | ~39k | Powers Image to Text; loaded lazily from a CDN |
| [gchq/CyberChef](https://github.com/gchq/CyberChef) | ~36k | Encoder/decoder and hashing recipes, all run client-side |
| [GoogleChromeLabs/squoosh](https://github.com/GoogleChromeLabs/squoosh) | ~26k | In-browser image compression, no upload |
| [ffmpegwasm/ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm) | ~15k | Powers the Media Converter |
| [soldair/node-qrcode](https://github.com/soldair/node-qrcode) | ~8k | Powers the QR code generator |
| [Hopding/pdf-lib](https://github.com/Hopding/pdf-lib) | ~8k | Powers the PDF Merger |
| [Tonejs/Tone.js](https://github.com/Tonejs/Tone.js) | ~14k | Powers the generative WebDesks Lo-fi stations; loaded on first play |
| [goldfire/howler.js](https://github.com/goldfire/howler.js) | ~24k | Plays the SomaFM radio streams; loaded on first play |
| [jwagner/simplex-noise.js](https://github.com/jwagner/simplex-noise.js) | ~1.7k | Shapes Focus Town's island terrain |

The command palette itself follows the launcher pattern popularised by VS Code
and adopted by it-tools: substring matches rank first, then subsequence matches
with a penalty proportional to how scattered the letters are.

## Privacy

No analytics beyond AdSense (never loaded for signed-in members) and no file ever leaves the device. For guests,
planner data (tasks, events, chores, bills, pages, moods) stays in
`localStorage` too. Signed-in users' Desks are stored in Supabase behind
row-level security; see `privacy.html` §2.5 for exactly what is stored and the
in-app download and delete controls. The only other network calls are CDN assets, the weather and quote APIs on the dashboard,
and the one-time OCR language pack download.

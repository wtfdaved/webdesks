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
| Focus | Focus Timer (Pomodoro), Focus Town, Breathing Guide, On Air, Audio Mixer, Desk Clock, Stopwatch |
| Work | Scratchpad, Task Manager, Project Board, Whiteboard, Time Zones |
| Files & media | PDF Merger, Screen Recorder, Media Converter (WebM → MP4, image resize) |
| Utilities | Calculator, Unit Converter, Colour Picker, **Dev Toolkit**, **Image to Text (OCR)** |
| Games | Survey Says |

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

1. **Database.** Run `supabase/migrations/20261028120000_profiles_and_desks.sql`.
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
- Tabs are deep-linkable: `https://webdesks.app/#devtools` opens that tool
  directly, which is also what the PWA manifest shortcuts rely on.

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

The command palette itself follows the launcher pattern popularised by VS Code
and adopted by it-tools: substring matches rank first, then subsequence matches
with a penalty proportional to how scattered the letters are.

## Privacy

No analytics beyond AdSense and no file ever leaves the device. For guests,
planner data (tasks, events, chores, bills, pages, moods) stays in
`localStorage` too. Signed-in users' Desks are stored in Supabase behind
row-level security; see `privacy.html` §2.5 for exactly what is stored and the
in-app download and delete controls. The only other network calls are CDN assets, the weather and quote APIs on the dashboard,
and the one-time OCR language pack download.

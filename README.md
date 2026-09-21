# WebDesks

A browser-native productivity suite: 23 tools in a single tab, no account, no
upload, no build step. `index.html` is the whole application — vanilla JS on top
of Tailwind and Lucide, with everything persisted to `localStorage` and every
file operation done locally.

**Live:** https://webdesks.app

## Tools

| Group | Tools |
| --- | --- |
| Focus | Focus Timer (Pomodoro), Focus Town, Breathing Guide, On Air, Audio Mixer, Desk Clock, Stopwatch |
| Work | Scratchpad, Task Manager, Project Board, Whiteboard, Time Zones |
| Files & media | PDF Merger, Screen Recorder, Media Converter (WebM → MP4, image resize) |
| Utilities | Calculator, Unit Converter, Colour Picker, **Dev Toolkit**, **Image to Text (OCR)** |
| Games | Survey Says |

Press <kbd>⌘K</kbd> / <kbd>Ctrl</kbd>+<kbd>K</kbd> anywhere to open the command
palette and jump to any tool or action.

## Architecture

Everything lives in `index.html`:

- A single `app` object holds state and behaviour. Tools are `.tab-content`
  panels switched by `app.switchTab(id)`.
- `app.searchItems` is the tool registry that drives the sidebar search, the
  command palette, the pinned quick actions and the mobile More drawer.
  Adding a tool means: a nav button, a `.tab-content` panel, a registry entry,
  and entries in `tabOrder` / `tabIcons` / `tabLabels` / the title map.
- `app._loadScript(url)` lazily fetches heavy libraries (qrcode, tesseract.js)
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
| [excalidraw/excalidraw](https://github.com/excalidraw/excalidraw) | ~133k | Whiteboard interaction model |
| [Stirling-Tools/Stirling-PDF](https://github.com/Stirling-Tools/Stirling-PDF) | ~93k | Local-first PDF tooling; the merge/reorder flow |
| [CorentinTh/it-tools](https://github.com/CorentinTh/it-tools) | ~41k | The Dev Toolkit catalogue and its one-input/one-output UX |
| [naptha/tesseract.js](https://github.com/naptha/tesseract.js) | ~39k | Powers Image to Text; loaded lazily from a CDN |
| [gchq/CyberChef](https://github.com/gchq/CyberChef) | ~36k | Encoder/decoder and hashing recipes, all run client-side |
| [GoogleChromeLabs/squoosh](https://github.com/GoogleChromeLabs/squoosh) | ~26k | In-browser image compression, no upload |
| [ffmpegwasm/ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm) | ~15k | Powers the Media Converter |
| [soldair/node-qrcode](https://github.com/soldair/node-qrcode) | ~8k | Powers the QR code generator |
| [Hopding/pdf-lib](https://github.com/Hopding/pdf-lib) | ~8k | Powers the PDF Merger |
| [krisk/Fuse](https://github.com/krisk/Fuse) | ~19k | Scoring model behind the command palette's fuzzy search |

The command palette itself follows the launcher pattern popularised by VS Code
and adopted by it-tools: substring matches rank first, then subsequence matches
with a penalty proportional to how scattered the letters are.

## Privacy

No analytics beyond AdSense, no backend, no file ever leaves the device. The
only network calls are CDN assets, the weather and quote APIs on the dashboard,
and the one-time OCR language pack download.

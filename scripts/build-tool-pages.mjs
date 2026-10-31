// Writes tools/<slug>/index.html for every route in tool-routes.js.
//
// Each page is the full app (index.html) with its own <title>, meta
// description, canonical URL, Open Graph / Twitter tags, structured data and
// a baked-in "About this tool" section, so /tools/whiteboard,
// /tools/json-formatter … can each rank on their own. The app reads the path
// and opens that tool.
//
// Runs on every Netlify deploy (netlify.toml). Output is git-ignored.
// Locally: `node scripts/build-tool-pages.mjs`.
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { ROUTES, bySlug } = require(join(root, 'tool-routes.js'));
const SITE = 'https://webdesks.app';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const base = readFileSync(join(root, 'index.html'), 'utf8');

const replaceOnce = (html, re, value, label) => {
    if (!re.test(html)) throw new Error(`build-tool-pages: couldn't find ${label} in index.html`);
    return html.replace(re, value);
};

rmSync(join(root, 'tools'), { recursive: true, force: true });

for (const r of ROUTES) {
    const url = `${SITE}/tools/${r.slug}`;
    const title = `${r.title} | WebDesks`;
    let html = base;
    html = replaceOnce(html, /<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`, '<title>');
    html = replaceOnce(html, /<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(r.desc)}">`, 'meta description');
    html = replaceOnce(html, /<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${url}">`, 'canonical');
    html = replaceOnce(html, /<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${url}">`, 'og:url');
    html = replaceOnce(html, /<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(title)}">`, 'og:title');
    html = replaceOnce(html, /<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${esc(r.desc)}">`, 'og:description');
    html = replaceOnce(html, /<meta name="twitter:url" content="[^"]*">/, `<meta name="twitter:url" content="${url}">`, 'twitter:url');
    html = replaceOnce(html, /<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${esc(title)}">`, 'twitter:title');
    html = replaceOnce(html, /<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${esc(r.desc)}">`, 'twitter:description');

    // The tool, not the dashboard greeting, is this page's main heading.
    html = replaceOnce(html, /<h1 class="hero-title">([\s\S]*?)<\/h1>/, '<div class="hero-title">$1</div>', 'dashboard <h1>');

    const ld = [
        {
            '@context': 'https://schema.org', '@type': 'WebApplication', name: `${r.name} — WebDesks`, url,
            description: r.desc, applicationCategory: r.tab === 'devtools' ? 'DeveloperApplication' : 'ProductivityApplication',
            operatingSystem: 'Any — runs in a modern web browser', isAccessibleForFree: true,
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, featureList: r.features,
            isPartOf: { '@type': 'WebSite', name: 'WebDesks', url: `${SITE}/` }
        },
        {
            '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'WebDesks', item: `${SITE}/` },
                { '@type': 'ListItem', position: 2, name: 'Tools', item: `${SITE}/tools/` },
                { '@type': 'ListItem', position: 3, name: r.name, item: url }
            ]
        }
    ];
    html = replaceOnce(html, /<\/head>/, `    <script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>\n</head>`, '</head>');

    // Crawler-readable copy of the "About this tool" card; the app moves it
    // into the tool's panel (renderToolAbout).
    const related = r.related.map(s => bySlug[s]).filter(Boolean)
        .map(x => `<a href="/tools/${x.slug}" onclick="return app.toolLink(event, '${x.slug}')">${esc(x.name)}</a>`).join('');
    const about = `
        <section class="tool-about" id="tool-about-static" data-tab="${r.tab}" data-slug="${r.slug}">
            <h1 class="tool-about-title">${esc(r.name)} — free, in your browser</h1>
            <p>${esc(r.desc)}</p>
            <ul>${r.features.map(f => `<li>${esc(f)}</li>`).join('')}</ul>
            <div class="tool-about-links">${r.blog ? `<a href="/blog/${r.blog}">Read the guide →</a>` : ''}${related}</div>
        </section>`;
    html = replaceOnce(html, /(<main id="main-content"[^>]*>)/, `$1${about}`, '<main>');

    const dir = join(root, 'tools', r.slug);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), html);
}

// /tools/ — a plain index of every tool page (good for crawlers and people).
const groups = [['Planner', ['daily-planner', 'calendar', 'notes', 'chore-chart', 'bill-tracker']],
    ['Work', ['todo-list', 'kanban-board', 'notepad', 'whiteboard', 'world-clock', 'on-air-sign']],
    ['Focus', ['pomodoro-timer', 'focus-town', 'ambient-sounds', 'breathing-exercise', 'alarm-clock', 'stopwatch']],
    ['Files & media', ['pdf-merger', 'screen-recorder', 'webm-to-mp4', 'image-to-text']],
    ['Utilities', ['calculator', 'unit-converter', 'color-picker']],
    ['Developer', ROUTES.filter(r => r.tab === 'devtools').map(r => r.slug)]];
const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>All ${ROUTES.length} Free Online Tools | WebDesks</title>
    <meta name="description" content="Every free WebDesks tool on one page: planner, calendar, to-do list, Pomodoro timer, PDF merger, screen recorder, JSON formatter, QR code generator and more. No sign-up.">
    <link rel="canonical" href="${SITE}/tools/">
    <link rel="icon" href="/favicon-32.png">
    <script src="/ads.js"></script>
    <style>
        body { font-family: Inter, system-ui, sans-serif; margin: 0; background: #f7f7f5; color: #0f172a; }
        main { max-width: 64rem; margin: 0 auto; padding: 2.5rem 1.25rem 4rem; }
        h1 { font-size: 2.2rem; letter-spacing: -.02em; margin: .5rem 0; } h2 { margin: 2rem 0 .75rem; font-size: 1.1rem; text-transform: uppercase; letter-spacing: .08em; color: #64748b; }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr)); gap: .75rem; }
        a.card { display: block; padding: 1rem 1.1rem; border-radius: 1rem; background: #fff; border: 1px solid #e5e7eb; text-decoration: none; color: inherit; }
        a.card:hover { border-color: #4f46e5; } a.card b { display: block; margin-bottom: .2rem; } a.card span { font-size: .85rem; color: #64748b; }
        .top a { color: #4f46e5; font-weight: 700; text-decoration: none; }
    </style>
</head>
<body>
<main>
    <div class="top"><a href="/">← WebDesks</a></div>
    <h1>All free tools</h1>
    <p>Every tool opens instantly in your browser — no download, no sign-up, and your files never leave your device.</p>
    ${groups.map(([name, slugs]) => `<h2>${esc(name)}</h2><div class="grid">${slugs.map(s => bySlug[s]).filter(Boolean).map(r => `<a class="card" href="/tools/${r.slug}"><b>${esc(r.name)}</b><span>${esc(r.desc.split('. ')[0].replace(/\.$/, ''))}.</span></a>`).join('')}</div>`).join('\n    ')}
</main>
</body>
</html>
`;
writeFileSync(join(root, 'tools', 'index.html'), indexHtml);
console.log(`build-tool-pages: wrote ${ROUTES.length} tool pages + /tools/ index`);

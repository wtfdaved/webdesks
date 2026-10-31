// Writes tools/<slug>/index.html for every route in tool-routes.js, plus
// the /tools/ index (rendering lives in tool-pages.js).
//
// Each page is the full app with its own <title>, meta description,
// canonical URL, Open Graph / Twitter tags, structured data and an "About
// this tool" section, so each tool can rank on its own.
//
// Runs on Netlify deploys (netlify.toml). Cloudflare Pages has no build
// step here; functions/tools/[[path]].js renders the same pages on request.
// Output is git-ignored. Locally: `node scripts/build-tool-pages.mjs`.
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { renderToolPage, renderToolsIndex, ROUTES } = require(join(root, 'tool-pages.js'));
const base = readFileSync(join(root, 'index.html'), 'utf8');

rmSync(join(root, 'tools'), { recursive: true, force: true });
for (const r of ROUTES) {
    const dir = join(root, 'tools', r.slug);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), renderToolPage(base, r));
}
writeFileSync(join(root, 'tools', 'index.html'), renderToolsIndex());
console.log(`build-tool-pages: wrote ${ROUTES.length} tool pages + /tools/ index`);

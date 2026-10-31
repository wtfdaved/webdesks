// Cloudflare Pages: /tools/ and /tools/<slug>.
//
// Cloudflare Pages serves the repository as-is (no build step), so each
// tool's SEO page is rendered on request from index.html: its own title,
// description, canonical URL, structured data and About card.
// Anything unexpected falls back to the plain app, which opens the tool
// from the URL by itself.
import pages from '../../tool-pages.js';

const HTML = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=0, must-revalidate' };

export async function onRequestGet(context) {
    const { request, env, params } = context;
    const parts = [].concat(params.path || []).filter(Boolean);
    const app = () => env.ASSETS.fetch(new URL('/', request.url));
    try {
        if (!parts.length) return new Response(pages.renderToolsIndex(), { headers: HTML });
        const slug = parts[0].toLowerCase().replace(/\.html?$/, '').replace(/\/+$/, '');
        const route = pages.bySlug[slug];
        if (!route || parts.length > 2 || (parts[1] && parts[1] !== 'index.html')) {
            const nf = await env.ASSETS.fetch(new URL('/404', request.url));
            return new Response(nf.body, { status: 404, headers: HTML });
        }
        const res = await app();
        if (!res.ok) return res;
        return new Response(pages.renderToolPage(await res.text(), route), { headers: HTML });
    } catch (e) {
        return app();
    }
}

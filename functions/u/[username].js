// Cloudflare Pages: webdesks.app/u/<username> — the Public Desk page.
// Same renderer as the Netlify function (netlify/functions/u.mjs).
import { handler } from '../../netlify/functions/u.mjs';
import { runNetlifyHandler } from '../../lib/cf-adapter.js';

export async function onRequestGet(context) {
    try {
        return await runNetlifyHandler(handler, context, { username: String(context.params.username || '') });
    } catch (e) {
        // Last resort: the static page that loads the Desk in the browser.
        return context.env.ASSETS.fetch(new URL('/u', context.request.url));
    }
}

// webdesks.app/u/<username> — a member's Public Desk.
import { publicDeskResponse } from '../../lib/public-desk-page.js';

export async function onRequestGet({ request, env, params }) {
    try {
        return await publicDeskResponse({ request, env, username: params.username });
    } catch (e) {
        // Last resort: the static page that loads the Desk in the browser.
        return env.ASSETS.fetch(new URL('/u', request.url));
    }
}

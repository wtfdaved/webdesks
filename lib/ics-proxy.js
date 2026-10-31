// Fetches a public/secret calendar feed (.ics) for the dashboard's
// Calendar Agenda widget. Google, Outlook and iCloud don't send CORS
// headers, so the browser can't read those feeds directly.
//
// GET /api/ics?url=<https or webcal URL>  (Cloudflare Pages Function,
// functions/api/ics.js)
//
// Only iCalendar bodies are passed back (the response must start with
// BEGIN:VCALENDAR), so this can't be used as a general-purpose proxy.
// Nothing is logged or stored.

const MAX_BYTES = 3 * 1024 * 1024;
const TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 3;

const headers = {
    'Content-Type': 'text/plain; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, max-age=300'
};
const fail = (status, msg) => new Response(msg, { status, headers: { ...headers, 'Cache-Control': 'no-store' } });

// Refuse anything that points back into a private network.
const privateHost = host => {
    const h = host.toLowerCase().replace(/^\[|\]$/g, '');
    if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal') || !h.includes('.') && !h.includes(':')) return true;
    const v4 = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if (v4) {
        const [a, b] = [Number(v4[1]), Number(v4[2])];
        return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
    }
    if (h.includes(':')) return h === '::1' || h === '::' || /^f[cd]/.test(h) || /^fe80/.test(h) || h.startsWith('::ffff:');
    return /^\d+$/.test(h); // decimal-encoded IPs
};

const checkUrl = raw => {
    let u;
    try { u = new URL(String(raw || '').trim().replace(/^webcals?:\/\//i, 'https://')); } catch (e) { return null; }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    if (u.username || u.password) return null;
    if (u.port && !['80', '443'].includes(u.port)) return null;
    if (privateHost(u.hostname)) return null;
    return u;
};

export async function icsResponse(request) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'GET') return fail(405, 'Method not allowed');
    let url = checkUrl(new URL(request.url).searchParams.get('url'));
    if (!url) return fail(400, 'Paste a full https:// or webcal:// calendar link.');

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
        let res;
        for (let hop = 0; ; hop++) {
            res = await fetch(url, { redirect: 'manual', signal: ctrl.signal, headers: { 'User-Agent': 'WebDesks-Calendar/1.0 (+https://webdesks.app)', Accept: 'text/calendar, text/plain;q=0.8, */*;q=0.1' } });
            if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
                if (hop >= MAX_REDIRECTS) return fail(502, 'Too many redirects.');
                url = checkUrl(new URL(res.headers.get('location'), url).href);
                if (!url) return fail(400, 'That calendar redirects somewhere we can\'t fetch.');
                continue;
            }
            break;
        }
        if (res.status === 401 || res.status === 403 || res.status === 404) return fail(404, 'The calendar link didn\'t work. Make sure it\'s the public or secret iCal address.');
        if (!res.ok) return fail(502, `The calendar server answered ${res.status}.`);
        const len = Number(res.headers.get('content-length') || 0);
        if (len > MAX_BYTES) return fail(413, 'That calendar is too large.');

        const reader = res.body.getReader();
        const chunks = [];
        let size = 0;
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.length;
            if (size > MAX_BYTES) { ctrl.abort(); return fail(413, 'That calendar is too large.'); }
            chunks.push(value);
        }
        const all = new Uint8Array(size);
        let off = 0;
        chunks.forEach(c => { all.set(c, off); off += c.length; });
        const body = new TextDecoder('utf-8').decode(all).replace(/^\uFEFF/, '');
        if (!/^\s*BEGIN:VCALENDAR/i.test(body)) return fail(415, 'That link isn\'t an iCalendar (.ics) feed.');
        return new Response(body, { status: 200, headers });
    } catch (e) {
        return fail(504, e.name === 'AbortError' ? 'The calendar server took too long.' : 'Couldn\'t reach that calendar.');
    } finally {
        clearTimeout(timer);
    }
}

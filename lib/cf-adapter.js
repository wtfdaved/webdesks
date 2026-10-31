// Shared by functions/ (Cloudflare Pages Functions). Lives outside functions/
// because Cloudflare turns every file in that folder into a route.
// Runs the Netlify-style handlers (netlify/functions/*.mjs) as Cloudflare
// Pages Functions, so both hosts serve the same code.
export async function runNetlifyHandler(handler, context, extra = {}) {
    const { request, env } = context;
    const url = new URL(request.url);
    const event = {
        httpMethod: request.method,
        path: url.pathname,
        rawUrl: request.url,
        queryStringParameters: { ...Object.fromEntries(url.searchParams), ...extra },
        headers: Object.fromEntries(request.headers)
    };
    const res = await handler(event, env);
    return new Response(res.body ?? '', { status: res.statusCode || 200, headers: res.headers || {} });
}

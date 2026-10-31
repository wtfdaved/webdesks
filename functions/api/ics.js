// Cloudflare Pages: /api/ics?url=… — fetches a calendar feed for the
// dashboard agenda (same code as netlify/functions/ics.mjs).
import { handler } from '../../netlify/functions/ics.mjs';
import { runNetlifyHandler } from '../../lib/cf-adapter.js';

export const onRequest = context => runNetlifyHandler(handler, context);

// /api/ics?url=… — fetches a calendar feed for the dashboard agenda
// (Google, Outlook and iCloud don't allow browsers to read them directly).
import { icsResponse } from '../../lib/ics-proxy.js';

export const onRequest = ({ request }) => icsResponse(request);

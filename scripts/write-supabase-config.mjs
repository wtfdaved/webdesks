// Netlify build step: writes the public Supabase URL and anon key from
// environment variables into supabase-config.js. With no variables set it
// leaves the committed file alone, so the deploy never fails because of it.
import { readFileSync, writeFileSync } from 'node:fs';

const env = process.env;
const pick = (...names) => names.map(n => (env[n] || '').trim()).find(Boolean) || '';

// Some integrations put a postgres:// connection string in these names; only an
// https project URL is usable from the browser, so skip anything else.
const url = ['SUPABASE_URL', 'SUPABASE_DATABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'VITE_SUPABASE_URL']
    .map(n => (env[n] || '').trim().replace(/\/+$/, ''))
    .find(v => /^https:\/\/[a-z0-9.-]+$/i.test(v)) || '';
const anonKey = pick('SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
const providers = pick('SUPABASE_AUTH_PROVIDERS').split(',').map(s => s.trim().toLowerCase()).filter(s => /^[a-z]+$/.test(s));

// A secret key in the browser would bypass row-level security; refuse it.
const isSecret = key => {
    if (key.startsWith('sb_secret_')) return true;
    try {
        const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
        return payload.role === 'service_role';
    } catch { return false; }
};

if (!url || !anonKey) {
    console.log('[supabase-config] No https SUPABASE_URL + SUPABASE_ANON_KEY set — keeping supabase-config.js as committed.');
    process.exit(0);
}
if (isSecret(anonKey)) {
    console.error('[supabase-config] Refusing to publish a service_role / secret key. Use the anon (publishable) key.');
    process.exit(1);
}

const file = new URL('../supabase-config.js', import.meta.url);
const src = readFileSync(file, 'utf8');
const out = src
    .replace(/url: '[^']*'/, `url: '${url}'`)
    .replace(/anonKey: '[^']*'/, `anonKey: '${anonKey.replace(/[^A-Za-z0-9._-]/g, '')}'`)
    .replace(/providers: \[[^\]]*\]/, `providers: [${providers.map(p => `'${p}'`).join(', ')}]`)
    .replace(/emailEnabled: (true|false)/, `emailEnabled: ${/^(1|true|yes)$/i.test(pick('SUPABASE_EMAIL_ENABLED'))}`);
writeFileSync(file, out);
console.log(`[supabase-config] Wrote ${url} (providers: ${providers.join(', ') || 'email only'}).`);

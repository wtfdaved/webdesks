// Public Supabase settings for WebDesks accounts and Desk sync.
//
// Both values are safe to publish: the anon / publishable key only allows
// what the row-level security policies in supabase/migrations permit (each
// signed-in user can reach their own profile and Desk, nothing else).
// NEVER put the service_role / secret key here.
//
// Fill these in directly, or set SUPABASE_URL and SUPABASE_ANON_KEY in
// Netlify (Site configuration → Environment variables) and the build step in
// netlify.toml writes them into this file on every deploy.
// While either is empty, sign-in is hidden and WebDesks runs guest-only.
window.WEBDESKS_SUPABASE = {
    url: '',
    anonKey: '',
    // Social logins switched on in Supabase (Authentication → Providers).
    providers: []
};

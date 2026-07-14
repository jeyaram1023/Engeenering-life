import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.2/+esm';

// ⚠️ IMPORTANT: Replace with your actual Supabase Project URL and Anon Key.
// This key is the public "anon" key — it's meant to be visible in
// client-side code and committed to a public repo. It has no power on its
// own; access is controlled entirely by the RLS policies + grants in
// App. SQL. Never put the service_role key here or anywhere in frontend code.
const SUPABASE_URL = 'https://syfxajnbspsrlwnnswfg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5Znhham5ic3Bzcmx3bm5zd2ZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5ODAwNzEsImV4cCI6MjA2OTU1NjA3MX0.pzaOcdhWArFg0vnq_Nvynttcc1Db3JxmNdXdkUGkUK0';

// Export a single shared Supabase client. Every page (index.html, admin.html)
// imports this same module rather than creating its own client, so there's
// only ever one auth session/storage instance per tab.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,     // keep the session in localStorage between visits
        autoRefreshToken: true,   // silently refresh the access token before it expires
        detectSessionInUrl: true, // required: parses the magic-link token out of the redirect URL
    },
});

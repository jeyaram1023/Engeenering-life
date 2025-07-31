import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// ⚠️ IMPORTANT: Replace with your actual Supabase Project URL and Anon Key
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

// Export the Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

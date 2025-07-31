import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// ⚠️ IMPORTANT: Replace with your actual Supabase Project URL and Anon Key
const SUPABASE_URL = 'https://syfxajnbspsrlwnnswfg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5Znhham5ic3Bzcmx3bm5zd2ZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5ODAwNzEsImV4cCI6MjA2OTU1NjA3MX0.pzaOcdhWArFg0vnq_Nvynttcc1Db3JxmNdXdkUGkUK0';

// Export the Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

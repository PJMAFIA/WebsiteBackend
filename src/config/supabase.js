const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;

// ✅ CRITICAL FIX: Use the Service Role Key (Admin Key)
// If it's missing, fall back to the normal key (but show a warning)
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

console.log("---------------------------------------------------");
console.log("🔌 Backend Supabase Connection:");
console.log("   - URL:", supabaseUrl);
console.log("   - Key Type:", process.env.SUPABASE_SERVICE_ROLE_KEY ? "🛡️ ADMIN (Service Role)" : "⚠️ PUBLIC (Anon - RLS Restricted)");
console.log("---------------------------------------------------");

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials in .env file');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false, // 👈 Ensures Node doesn't try to read browser URLs
    // 🔥 THE FIX: Dummy Storage. This physically prevents the server from 
    // saving User A's session into RAM and overwriting it when User B logs in.
    storage: {
      getItem: () => null,
      setItem: () => null,
      removeItem: () => null,
    }
  },
  // 🔥 Force fresh requests (Disable Fetch Caching)
  global: {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  },
});

module.exports = supabase;
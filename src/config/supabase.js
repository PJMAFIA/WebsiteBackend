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
    persistSession: false
  }
});

module.exports = supabase;
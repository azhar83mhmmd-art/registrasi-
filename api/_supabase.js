// Shared Supabase client for server-side API routes.
// Uses the SERVICE_ROLE key — this file must NEVER be imported into
// client-side code (public/), only from api/*.js which runs on the server.

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;
let configError = null;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  configError =
    'Supabase belum dikonfigurasi. Isi SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY ' +
    'di file .env (lokal) atau Vercel Project Settings -> Environment Variables.';
  console.warn('[supabase] ' + configError);
} else {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
  } catch (e) {
    configError = 'Gagal membuat koneksi Supabase: ' + e.message;
    console.error('[supabase] ' + configError);
  }
}

module.exports = { supabase, configError };


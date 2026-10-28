// Supabase browser configuration for GitHub Pages.
// The publishable key is intended for the browser; never paste a service_role/secret key here.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const SUPABASE_URL = "https://hrfsyyjgrqeiukbxlbnb.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_gfv6_ITHlXipmDQV_Y8Wpg_GjQK_U86";

export const isSupabaseConfigured =
  /^https:\/\/.+\.supabase\.co$/.test(SUPABASE_URL) &&
  SUPABASE_PUBLISHABLE_KEY.startsWith("sb_publishable_") &&
  SUPABASE_PUBLISHABLE_KEY.trim().length > 20;

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

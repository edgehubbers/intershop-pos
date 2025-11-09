// app/lib/supabase.client.ts
import { createClient } from "@supabase/supabase-js";

// Variables Vite:
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
});

export function getSupabaseClient() {
  return supabase;
}

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let serverClient: SupabaseClient | null = null;

export function getSupabaseServer(): SupabaseClient {
  if (serverClient) return serverClient;

  const url = process.env.SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_ANON_KEY;

  if (!url) throw new Error('Falta SUPABASE_URL');
  if (!serviceKey)
    throw new Error('Falta SUPABASE_SERVICE_ROLE (o SUPABASE_ANON_KEY)');

  serverClient = createClient(url, serviceKey, {
    auth: { persistSession: false },
    global: { headers: { 'X-Client-Info': 'intershop-pos-server' } },
  });
  return serverClient;
}

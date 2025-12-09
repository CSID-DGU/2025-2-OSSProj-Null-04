import { createClient as createServiceClient } from '@supabase/supabase-js';

let supabaseServiceClient = null;

export function getSupabaseServiceClient() {
  if (supabaseServiceClient) {
    return supabaseServiceClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  supabaseServiceClient = createServiceClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });

  return supabaseServiceClient;
}

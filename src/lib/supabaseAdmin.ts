import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Cliente com service role — USO EXCLUSIVO server-side (API routes / RSC).
// Nunca importar em componente client.
let cached: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar no .env.local",
    );
  }
  cached = createClient(url, key, { auth: { persistSession: false } });
  return cached;
}

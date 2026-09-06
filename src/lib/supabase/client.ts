"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Whether Supabase is configured at all. When it isn't, the app runs fully
 * local (IndexedDB) with zero setup — this lets `getRepository()` and the
 * auth gate fall back gracefully instead of crashing on missing env vars.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

let client: ReturnType<typeof createBrowserClient> | null = null;

/**
 * The one Supabase client for browser-side use. Every CRUD operation
 * (SupabaseRepository) and every photo/audio upload runs through this,
 * authenticated as the signed-in user — never through a service-role key,
 * so Row Level Security is what actually protects the data.
 */
export function getSupabaseClient() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured — set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return client;
}

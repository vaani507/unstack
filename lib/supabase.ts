import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (client) return client;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Newer projects issue a publishable key (sb_publishable_...) as the drop-in
  // replacement for the legacy anon key. Accept both names.
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.warn(
      "[supabase] NEXT_PUBLIC_SUPABASE_URL or a Supabase client key is missing. " +
        "Copy .env.local.example to .env.local and fill in your project credentials."
    );
    throw new Error(
      "Supabase client is missing credentials. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) in .env.local."
    );
  }

  client = createClient(supabaseUrl, supabaseKey);
  return client;
}

/**
 * Lazily-constructed Supabase client. This SDK version throws at construction
 * time when credentials are empty ("supabaseUrl is required"), which would
 * crash `next build` on any route that imports this module without a
 * .env.local. The Proxy defers construction until the first actual query, so
 * importing this module is always safe; real calls fail with a clear error
 * when env vars are unset.
 */
export const supabase = new Proxy(
  {},
  {
    get(_target, prop: string | symbol) {
      const value = (getClient() as unknown as Record<PropertyKey, unknown>)[prop];
      return typeof value === "function"
        ? (value as (...args: unknown[]) => unknown).bind(getClient())
        : value;
    },
  }
) as SupabaseClient;
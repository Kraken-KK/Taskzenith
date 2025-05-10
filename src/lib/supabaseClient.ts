// src/lib/supabaseClient.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  console.error(
    "Supabase URL is missing. " +
    "Please ensure NEXT_PUBLIC_SUPABASE_URL environment variable is set correctly."
  );
  throw new Error("Supabase URL is required but not found. Ensure NEXT_PUBLIC_SUPABASE_URL is set.");
}

if (!supabaseAnonKey) {
  console.error(
    "Supabase Anon Key is missing. " +
    "Please ensure NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable is set correctly."
  );
  throw new Error("Supabase Anon Key is required but not found. Ensure NEXT_PUBLIC_SUPABASE_ANON_KEY is set.");
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// Note: The error "AuthApiError: Database error saving new user" typically indicates an issue
// on the Supabase backend, such as Row Level Security (RLS) policies on the auth.users table
// preventing insertion, or other database-level constraints or triggers.
// Ensure your Supabase project's database and auth settings allow user creation.
// Common RLS for allowing user creation (public.users table often mirrors auth.users):
// For INSERT: `(auth.uid() = id)` on `public.users` and ensure `auth.users` table is not overly restricted.
// Or, if you're not using a public.users table for profiles yet, the issue might be directly with auth.users permissions.
// Check Supabase dashboard logs for more specific database errors.

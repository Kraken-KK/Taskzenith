// src/lib/supabaseClient.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mrhrwgydvlnqdjnofavj.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yaHJ3Z3lkdmxucWRqbm9mYXZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM1ODAzNzEsImV4cCI6MjA1OTE1NjM3MX0.dt9wUC4CVu_AQtrS1McCHYjC6rYVibf7VSvxJRK3Ues";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Supabase URL or Anon Key is missing. " +
    "Please ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables are set correctly. " +
    "Using fallback credentials if provided, but this is not recommended for production."
  );
  if (!supabaseUrl) throw new Error("Supabase URL is required but not found.");
  if (!supabaseAnonKey) throw new Error("Supabase Anon Key is required but not found.");
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

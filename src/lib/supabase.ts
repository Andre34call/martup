import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Create Supabase client — only if credentials are available
// During build time or in environments without Supabase, this will create a no-op client
// IMPORTANT: Disable auto-detect session in URL and auto-refresh to prevent
// Supabase Auth from interfering with our custom auth system (NextAuth + JWT).
// This prevents the unwanted PASSWORD_RECOVERY screen from appearing after login.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      detectSessionInUrl: false,
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

/**
 * Check if Supabase is properly configured with real credentials.
 * Returns false if using placeholder values.
 */
export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('placeholder'))
}

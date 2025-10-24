import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from './info';

// Create a singleton Supabase client instance with session persistence
export const supabase = createClient(
  `https://${projectId}.supabase.co`,
  publicAnonKey,
  {
    auth: {
      persistSession: true, // Enable session persistence
      autoRefreshToken: true, // Auto refresh token before expiry
      detectSessionInUrl: true, // Detect session in URL for OAuth
      storage: typeof window !== 'undefined' ? window.localStorage : undefined, // Use localStorage
      storageKey: 'kueue-auth-token', // Custom storage key
    }
  }
);

// Export the client as default for convenience
export default supabase;
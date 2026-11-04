import { createClient } from "@supabase/supabase-js";

// Confirms a password without touching the app's session. Signing in on the main
// client would replace the session, dropping an MFA-verified user back to aal1.
export async function verifyCurrentPassword(email: string, password: string): Promise<boolean> {
  const client = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: "evernest-reauth",
    },
  });

  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) return false;

  await client.auth.signOut({ scope: "local" });
  return true;
}

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// A client whose session is separate from the app's. Signing in on the main client
// would replace the session, dropping an MFA-verified user back to aal1.
export function createReauthClient() {
  return createClient<Database>(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: "evernest-reauth",
    },
  });
}

export async function verifyCurrentPassword(email: string, password: string): Promise<boolean> {
  const client = createReauthClient();

  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) return false;

  await client.auth.signOut({ scope: "local" });
  return true;
}

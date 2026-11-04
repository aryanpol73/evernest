import { supabase } from "@/integrations/supabase/client";
import { createReauthClient } from "@/lib/reauth";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const REMOVE_BATCH_SIZE = 100;

interface DeleteAccountInput {
  email: string;
  password: string;
  mfaCode?: string;
}

async function removeFilesAndAccount(client: SupabaseClient<Database>): Promise<void> {
  const { data: paths, error: listError } = await client.rpc("list_my_storage_paths");
  if (listError) throw listError;

  const bucket = client.storage.from("family-documents");
  for (let start = 0; start < paths.length; start += REMOVE_BATCH_SIZE) {
    const { error } = await bucket.remove(paths.slice(start, start + REMOVE_BATCH_SIZE));
    if (error) throw error;
  }

  const { error: deleteError } = await client.rpc("delete_my_account");
  if (deleteError) throw deleteError;

  // The account is gone, so the server can no longer confirm this sign-out.
  await supabase.auth.signOut({ scope: "local" });
}

// For Google accounts, which have just signed in again. The screen only offers this
// after a fresh sign-in and completed MFA, and the server checks both again.
export function deleteAccountWithCurrentSession(): Promise<void> {
  return removeFilesAndAccount(supabase);
}

// Runs on a freshly signed-in session, which the server requires as proof. All
// identity checks finish before the first file is touched, so a wrong password or
// code cannot leave an account half deleted.
export async function deleteAccount({ email, password, mfaCode }: DeleteAccountInput): Promise<void> {
  const client = createReauthClient();

  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error("That password is incorrect.");

  const { data: factors, error: factorError } = await client.auth.mfa.listFactors();
  if (factorError) throw factorError;
  const factor = factors.totp[0];
  if (factor) {
    if (!mfaCode) throw new Error("Enter the code from your authenticator app.");
    const { error } = await client.auth.mfa.challengeAndVerify({ factorId: factor.id, code: mfaCode });
    if (error) throw new Error("That security code didn't work.");
  }

  await removeFilesAndAccount(client);
}

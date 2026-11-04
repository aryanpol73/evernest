import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface RecoveryResult {
  ok: boolean;
  locked_until: string | null;
}

export interface TotpEnrollment {
  factorId: string;
  qrCode: string;
  secret: string;
}

// The query key includes the token so the gate re-evaluates whenever the session
// changes, such as straight after a code is verified.
export function useMfaGate() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["mfa_gate", session?.access_token],
    queryFn: async () => {
      const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (error) throw error;
      return { needsCode: data.nextLevel === "aal2" && data.currentLevel !== "aal2" };
    },
    enabled: !!session,
  });
}

export function useTotpFactors() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["mfa_factors", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      return data.totp;
    },
    enabled: !!user,
  });
}

export function useRecoveryCodesRemaining(enabled: boolean) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["mfa_recovery_remaining", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("mfa_recovery_codes_remaining");
      if (error) throw error;
      return data;
    },
    enabled: !!user && enabled,
  });
}

export async function generateRecoveryCodes(): Promise<string[]> {
  const { data, error } = await supabase.rpc("generate_mfa_recovery_codes");
  if (error) throw error;
  return data;
}

export async function redeemRecoveryCode(code: string): Promise<RecoveryResult> {
  const { data, error } = await supabase.rpc("redeem_mfa_recovery_code", { _code: code });
  if (error) throw error;
  const result = data as unknown as RecoveryResult;
  if (result.ok) {
    // The session still lists the deleted factor until it is refreshed. Whoever
    // lost the device could also be signed in somewhere else.
    await supabase.auth.refreshSession();
    await supabase.auth.signOut({ scope: "others" });
  }
  return result;
}

export async function verifyTotpCode(code: string): Promise<void> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  const factor = data.totp[0];
  if (!factor) throw new Error("No authenticator is set up for this account.");
  const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
  if (verifyError) throw verifyError;
}

export async function startTotpEnrollment(): Promise<TotpEnrollment> {
  // An abandoned setup leaves an unverified factor behind, so clear those first.
  const { data: existing, error: listError } = await supabase.auth.mfa.listFactors();
  if (listError) throw listError;
  for (const factor of existing.all.filter(f => f.status === "unverified")) {
    const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
    if (error) throw error;
  }

  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
  if (error) throw error;
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

export async function confirmTotpEnrollment(factorId: string, code: string): Promise<void> {
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) throw error;
  // Sessions on other devices are still aal1 and would just see an empty vault.
  await supabase.auth.signOut({ scope: "others" });
}

export async function removeTotpFactor(factorId: string): Promise<void> {
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw error;
  await supabase.auth.refreshSession();
}

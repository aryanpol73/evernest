import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface UserSettings {
  id: string;
  onboarding_completed: boolean;
}

export interface PinStatus {
  has_pin: boolean;
  locked_until: string | null;
}

export interface PinResult {
  ok: boolean;
  locked_until: string | null;
  attempts_remaining: number;
}

export function useUserSettings() {
  const { user } = useAuth();
  return useQuery<UserSettings | null>({
    queryKey: ["user_settings", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("user_settings")
        .select("id, onboarding_completed")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<UserSettings> & { id: string }) => {
      const { error } = await supabase.from("user_settings").update({ ...data, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user_settings"] }),
  });
}

export function usePinStatus() {
  const { user } = useAuth();
  return useQuery<PinStatus>({
    queryKey: ["pin_status", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pin_status");
      if (error) throw error;
      return data as unknown as PinStatus;
    },
    enabled: !!user,
  });
}

// PIN hashing, comparison, and lockout all happen in the database.
export async function verifyPin(pin: string): Promise<PinResult> {
  const { data, error } = await supabase.rpc("verify_pin", { _pin: pin });
  if (error) throw error;
  return data as unknown as PinResult;
}

export async function setPin(newPin: string, currentPin?: string): Promise<PinResult> {
  const { data, error } = await supabase.rpc("set_pin", { _new_pin: newPin, _current_pin: currentPin });
  if (error) throw error;
  return data as unknown as PinResult;
}

export async function removePin(currentPin: string): Promise<PinResult> {
  const { data, error } = await supabase.rpc("remove_pin", { _current_pin: currentPin });
  if (error) throw error;
  return data as unknown as PinResult;
}

// For Google accounts that have just signed in again.
export async function resetPinAfterSignIn(): Promise<void> {
  const { error } = await supabase.rpc("reset_pin_after_login");
  if (error) throw error;
}

// Signing in again produces the fresh proof the database requires.
export async function resetPinWithPassword(email: string, password: string): Promise<void> {
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  const { error } = await supabase.rpc("reset_pin_after_login");
  if (error) throw error;
}

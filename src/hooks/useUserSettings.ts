import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface UserSettings {
  id: string;
  pin_hash: string | null;
  pin_salt: string | null;
  onboarding_completed: boolean;
  pin_attempts: number;
  pin_locked_until: string | null;
}

export function useUserSettings() {
  const { user } = useAuth();
  return useQuery<UserSettings | null>({
    queryKey: ["user_settings", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("user_settings")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data as UserSettings | null;
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

// PIN hashing using Web Crypto API
export async function hashPin(pin: string, salt?: string): Promise<{ hash: string; salt: string }> {
  const s = salt || crypto.getRandomValues(new Uint8Array(16)).reduce((a, b) => a + b.toString(16).padStart(2, "0"), "");
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + s);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  return { hash, salt: s };
}

export async function verifyPin(pin: string, storedHash: string, storedSalt: string): Promise<boolean> {
  const { hash } = await hashPin(pin, storedSalt);
  return hash === storedHash;
}

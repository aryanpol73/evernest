import type { Session, User } from "@supabase/supabase-js";
import { lovable } from "@/integrations/lovable";

// A little under the server's five minutes, so a check that passes here passes there.
const RECENT_SECONDS = 240;
const SIGN_IN_METHODS = ["password", "oauth"];

interface AuthMethod {
  method?: string;
  timestamp?: number;
}

// Google-only accounts have no password to confirm, so they sign in with Google again.
export function usesPassword(user: User | null | undefined): boolean {
  const providers = user?.app_metadata?.providers;
  return !Array.isArray(providers) || providers.includes("email");
}

function authMethods(accessToken: string): AuthMethod[] {
  try {
    const payload = accessToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const claims = JSON.parse(atob(payload));
    return Array.isArray(claims.amr) ? claims.amr : [];
  } catch {
    return [];
  }
}

// Only decides what to show. The server makes the same check on the signed token.
export function hasRecentSignIn(session: Session | null | undefined): boolean {
  if (!session) return false;
  const earliest = Date.now() / 1000 - RECENT_SECONDS;
  return authMethods(session.access_token).some(
    entry => SIGN_IN_METHODS.includes(entry.method ?? "") && (entry.timestamp ?? 0) >= earliest,
  );
}

export async function confirmWithGoogle(path: string): Promise<void> {
  const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: `${window.location.origin}${path}` });
  if (result.error) throw result.error;
}

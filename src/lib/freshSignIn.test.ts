import { describe, expect, it, vi } from "vitest";
import type { Session, User } from "@supabase/supabase-js";
import { hasRecentSignIn, usesPassword } from "./freshSignIn";

vi.mock("@/integrations/lovable", () => ({ lovable: { auth: { signInWithOAuth: vi.fn() } } }));

const now = () => Math.floor(Date.now() / 1000);

function sessionWith(amr: unknown): Session {
  const body = btoa(JSON.stringify({ amr })).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return { access_token: `header.${body}.signature` } as Session;
}

const userWith = (providers?: string[]) => ({ app_metadata: { providers } }) as unknown as User;

describe("usesPassword", () => {
  it("is false only for accounts with no email sign-in", () => {
    expect(usesPassword(userWith(["google"]))).toBe(false);
    expect(usesPassword(userWith(["email"]))).toBe(true);
    expect(usesPassword(userWith(["email", "google"]))).toBe(true);
  });

  it("defaults to the password flow when providers are unknown", () => {
    expect(usesPassword(userWith())).toBe(true);
    expect(usesPassword(null)).toBe(true);
  });
});

describe("hasRecentSignIn", () => {
  it.each(["password", "oauth"])("accepts a fresh %s sign-in", method => {
    expect(hasRecentSignIn(sessionWith([{ method, timestamp: now() }]))).toBe(true);
  });

  it.each(["otp", "recovery", "totp", "magiclink"])("does not accept %s as proof", method => {
    expect(hasRecentSignIn(sessionWith([{ method, timestamp: now() }]))).toBe(false);
  });

  it("does not accept an old sign-in", () => {
    expect(hasRecentSignIn(sessionWith([{ method: "oauth", timestamp: now() - 3600 }]))).toBe(false);
  });

  it("finds the sign-in among other methods", () => {
    expect(hasRecentSignIn(sessionWith([{ method: "totp", timestamp: now() }, { method: "oauth", timestamp: now() }]))).toBe(true);
  });

  it("is false for no session, no claim, or a broken token", () => {
    expect(hasRecentSignIn(null)).toBe(false);
    expect(hasRecentSignIn(sessionWith(undefined))).toBe(false);
    expect(hasRecentSignIn({ access_token: "not-a-token" } as Session)).toBe(false);
  });

  it("handles non-Latin characters elsewhere in the token", () => {
    const body = btoa(unescape(encodeURIComponent(JSON.stringify({ name: "आधार", amr: [{ method: "oauth", timestamp: now() }] }))));
    expect(hasRecentSignIn({ access_token: `h.${body}.s` } as Session)).toBe(true);
  });
});

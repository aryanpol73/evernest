import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { verifyCurrentPassword } from "./reauth";

const signInWithPassword = vi.fn();
const signOut = vi.fn();

vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));

describe("verifyCurrentPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockReturnValue({ auth: { signInWithPassword, signOut } } as never);
  });

  it("uses a client that cannot replace the app's session", async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    await verifyCurrentPassword("a@example.com", "pw");
    const options = vi.mocked(createClient).mock.calls[0][2];
    expect(options?.auth).toMatchObject({ persistSession: false, autoRefreshToken: false, detectSessionInUrl: false });
    expect(options?.auth?.storageKey).toBe("evernest-reauth");
  });

  it("confirms a correct password and ends the temporary session", async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    await expect(verifyCurrentPassword("a@example.com", "pw")).resolves.toBe(true);
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("rejects a wrong password", async () => {
    signInWithPassword.mockResolvedValue({ error: new Error("Invalid login credentials") });
    await expect(verifyCurrentPassword("a@example.com", "bad")).resolves.toBe(false);
    expect(signOut).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteAccount } from "./accountDeletion";
import { createReauthClient } from "@/lib/reauth";
import { supabase } from "@/integrations/supabase/client";

const signInWithPassword = vi.fn();
const listFactors = vi.fn();
const challengeAndVerify = vi.fn();
const rpc = vi.fn();
const remove = vi.fn();

vi.mock("@/lib/reauth", () => ({ createReauthClient: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { signOut: vi.fn() } } }));

const input = { email: "a@example.com", password: "pw" };

describe("deleteAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createReauthClient).mockReturnValue({
      auth: { signInWithPassword, mfa: { listFactors, challengeAndVerify } },
      rpc,
      storage: { from: () => ({ remove }) },
    } as never);
    signInWithPassword.mockResolvedValue({ error: null });
    listFactors.mockResolvedValue({ data: { totp: [] }, error: null });
    challengeAndVerify.mockResolvedValue({ error: null });
    remove.mockResolvedValue({ error: null });
    rpc.mockImplementation(async (name: string) =>
      name === "list_my_storage_paths" ? { data: ["f/general/a.pdf"], error: null } : { error: null },
    );
  });

  const deletionStarted = () => remove.mock.calls.length > 0 || rpc.mock.calls.some(c => c[0] === "delete_my_account");

  it("removes files, then the account, then ends the local session", async () => {
    await deleteAccount(input);
    expect(remove).toHaveBeenCalledWith(["f/general/a.pdf"]);
    expect(rpc).toHaveBeenLastCalledWith("delete_my_account");
    expect(remove.mock.invocationCallOrder[0]).toBeLessThan(rpc.mock.invocationCallOrder.at(-1)!);
    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("removes large file sets in batches", async () => {
    const paths = Array.from({ length: 250 }, (_, i) => `f/general/${i}.pdf`);
    rpc.mockImplementation(async (name: string) => (name === "list_my_storage_paths" ? { data: paths, error: null } : { error: null }));
    await deleteAccount(input);
    expect(remove.mock.calls.map(c => c[0].length)).toEqual([100, 100, 50]);
  });

  it("touches nothing if the password is wrong", async () => {
    signInWithPassword.mockResolvedValue({ error: new Error("Invalid login credentials") });
    await expect(deleteAccount(input)).rejects.toThrow("That password is incorrect.");
    expect(deletionStarted()).toBe(false);
  });

  it("touches nothing if an MFA code is missing or wrong", async () => {
    listFactors.mockResolvedValue({ data: { totp: [{ id: "factor-1" }] }, error: null });
    await expect(deleteAccount(input)).rejects.toThrow(/authenticator app/);

    challengeAndVerify.mockResolvedValue({ error: new Error("Invalid code") });
    await expect(deleteAccount({ ...input, mfaCode: "000000" })).rejects.toThrow(/security code/);
    expect(deletionStarted()).toBe(false);
  });

  it("does not delete the account if a file can't be removed", async () => {
    remove.mockResolvedValue({ error: new Error("storage down") });
    await expect(deleteAccount(input)).rejects.toThrow("storage down");
    expect(rpc).not.toHaveBeenCalledWith("delete_my_account");
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
  });
});

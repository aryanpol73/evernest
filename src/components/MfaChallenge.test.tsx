import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MfaChallenge } from "./MfaChallenge";
import { redeemRecoveryCode, verifyTotpCode } from "@/hooks/useMfa";

const toast = vi.fn();

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ signOut: vi.fn() }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/hooks/useMfa", () => ({ verifyTotpCode: vi.fn(), redeemRecoveryCode: vi.fn() }));

const openRecovery = () => {
  render(<MfaChallenge />);
  fireEvent.click(screen.getByRole("button", { name: "Lost your device?" }));
};

const submitRecovery = (code: string) => {
  fireEvent.change(screen.getByLabelText("Recovery code"), { target: { value: code } });
  fireEvent.click(screen.getByRole("button", { name: "Use Recovery Code" }));
};

describe("MfaChallenge", () => {
  beforeEach(() => vi.clearAllMocks());

  it("verifies an authenticator code", async () => {
    vi.mocked(verifyTotpCode).mockResolvedValue();
    render(<MfaChallenge />);
    fireEvent.change(screen.getByLabelText("Security code"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));
    await waitFor(() => expect(verifyTotpCode).toHaveBeenCalledWith("123456"));
  });

  it("warns what a recovery code does before it's used", () => {
    openRecovery();
    expect(screen.getByText(/turns off two-step verification/)).toBeInTheDocument();
    expect(redeemRecoveryCode).not.toHaveBeenCalled();
  });

  it("tells the user MFA is off after recovery", async () => {
    vi.mocked(redeemRecoveryCode).mockResolvedValue({ ok: true, locked_until: null });
    openRecovery();
    submitRecovery("ABCD-EF01");
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Two-step verification is off" })));
    expect(redeemRecoveryCode).toHaveBeenCalledWith("ABCD-EF01");
  });

  it("clears a wrong code", async () => {
    vi.mocked(redeemRecoveryCode).mockResolvedValue({ ok: false, locked_until: null });
    openRecovery();
    submitRecovery("WRONG");
    expect(await screen.findByText("That recovery code didn't work.")).toBeInTheDocument();
    expect(screen.getByLabelText("Recovery code")).toHaveValue("");
  });

  it("explains a lockout", async () => {
    vi.mocked(redeemRecoveryCode).mockResolvedValue({ ok: false, locked_until: "2099-01-01T00:00:00Z" });
    openRecovery();
    submitRecovery("WRONG");
    expect(await screen.findByText(/Too many attempts/)).toBeInTheDocument();
  });

  it("asks for a fresh sign-in when the server requires one", async () => {
    vi.mocked(redeemRecoveryCode).mockRejectedValue(new Error("A recent password sign-in is required"));
    openRecovery();
    submitRecovery("ABCD");
    expect(await screen.findByText(/sign out and sign in again/)).toBeInTheDocument();
  });

  it("can go back to the authenticator", () => {
    openRecovery();
    fireEvent.click(screen.getByRole("button", { name: "Use my authenticator app" }));
    expect(screen.getByLabelText("Security code")).toBeInTheDocument();
  });
});

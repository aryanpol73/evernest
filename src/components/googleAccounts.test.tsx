import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MfaSettings } from "./MfaSettings";
import { PinLockScreen } from "./PinLockScreen";
import { YourDataSettings } from "./YourDataSettings";
import { removeTotpFactor } from "@/hooks/useMfa";
import { resetPinAfterSignIn, resetPinWithPassword } from "@/hooks/useUserSettings";
import { deleteAccount, deleteAccountWithCurrentSession } from "@/lib/accountDeletion";
import { confirmWithGoogle, hasRecentSignIn } from "@/lib/freshSignIn";
import { verifyCurrentPassword } from "@/lib/reauth";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ session: {}, user: { id: "u1", email: "a@gmail.com", app_metadata: { providers: ["google"] } } }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/lib/freshSignIn", () => ({ confirmWithGoogle: vi.fn(), hasRecentSignIn: vi.fn(), usesPassword: () => false }));
vi.mock("@/lib/accountDeletion", () => ({ deleteAccount: vi.fn(), deleteAccountWithCurrentSession: vi.fn() }));
vi.mock("@/lib/dataExport", () => ({ buildDataExport: vi.fn(), saveDataExport: vi.fn() }));
vi.mock("@/lib/reauth", () => ({ verifyCurrentPassword: vi.fn() }));
vi.mock("@/hooks/useMfa", () => ({
  useTotpFactors: () => ({ data: [{ id: "f1" }] }),
  useRecoveryCodesRemaining: () => ({ data: 5 }),
  removeTotpFactor: vi.fn(),
  startTotpEnrollment: vi.fn(),
  confirmTotpEnrollment: vi.fn(),
  generateRecoveryCodes: vi.fn(),
}));
vi.mock("@/hooks/useUserSettings", () => ({
  usePinStatus: () => ({ data: { has_pin: true, locked_until: null } }),
  verifyPin: vi.fn(),
  resetPinAfterSignIn: vi.fn(),
  resetPinWithPassword: vi.fn(),
}));

const wrap = (ui: React.ReactNode) =>
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>);

describe("accounts with no password", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("deleting the account", () => {
    const typeConfirmation = () => fireEvent.change(screen.getByLabelText(/to confirm/), { target: { value: "DELETE" } });
    const deleteButton = () => screen.getByRole("button", { name: /Delete My Account/ });

    it("asks for no password, and needs a fresh Google sign-in first", async () => {
      vi.mocked(hasRecentSignIn).mockReturnValue(false);
      wrap(<YourDataSettings />);
      expect(screen.queryByLabelText("Account password")).not.toBeInTheDocument();
      typeConfirmation();
      expect(deleteButton()).toBeDisabled();
      fireEvent.click(screen.getByRole("button", { name: /Confirm It's You With Google/ }));
      await waitFor(() => expect(confirmWithGoogle).toHaveBeenCalledWith("/settings?tab=Your%20Data"));
      expect(deleteAccountWithCurrentSession).not.toHaveBeenCalled();
    });

    it("deletes on the current session after a fresh sign-in", async () => {
      vi.mocked(hasRecentSignIn).mockReturnValue(true);
      vi.mocked(deleteAccountWithCurrentSession).mockResolvedValue();
      wrap(<YourDataSettings />);
      typeConfirmation();
      fireEvent.click(deleteButton());
      await waitFor(() => expect(deleteAccountWithCurrentSession).toHaveBeenCalledOnce());
      expect(deleteAccount).not.toHaveBeenCalled();
    });

    it("still needs the confirmation word", () => {
      vi.mocked(hasRecentSignIn).mockReturnValue(true);
      wrap(<YourDataSettings />);
      expect(deleteButton()).toBeDisabled();
    });
  });

  describe("turning off MFA", () => {
    it("sends the user to Google first", async () => {
      vi.mocked(hasRecentSignIn).mockReturnValue(false);
      wrap(<MfaSettings />);
      fireEvent.click(screen.getByRole("button", { name: /Confirm With Google to Turn Off/ }));
      await waitFor(() => expect(confirmWithGoogle).toHaveBeenCalledWith("/settings?tab=Security"));
      expect(removeTotpFactor).not.toHaveBeenCalled();
    });

    it("turns it off after a fresh sign-in, without asking for a password", async () => {
      vi.mocked(hasRecentSignIn).mockReturnValue(true);
      vi.mocked(removeTotpFactor).mockResolvedValue();
      wrap(<MfaSettings />);
      fireEvent.click(screen.getByRole("button", { name: "Turn Off" }));
      await waitFor(() => expect(removeTotpFactor).toHaveBeenCalledWith("f1"));
      expect(verifyCurrentPassword).not.toHaveBeenCalled();
    });
  });

  describe("a forgotten PIN", () => {
    const openForgot = () => {
      wrap(<PinLockScreen onUnlock={onUnlock} />);
      fireEvent.click(screen.getByRole("button", { name: "Forgot PIN?" }));
    };
    const onUnlock = vi.fn();

    it("sends the user to Google, and stays locked", async () => {
      vi.mocked(hasRecentSignIn).mockReturnValue(false);
      openForgot();
      expect(screen.queryByLabelText("Account password")).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Continue With Google" }));
      await waitFor(() => expect(confirmWithGoogle).toHaveBeenCalledOnce());
      expect(onUnlock).not.toHaveBeenCalled();
      expect(resetPinAfterSignIn).not.toHaveBeenCalled();
    });

    it("removes the PIN after a fresh sign-in", async () => {
      vi.mocked(hasRecentSignIn).mockReturnValue(true);
      vi.mocked(resetPinAfterSignIn).mockResolvedValue();
      openForgot();
      fireEvent.click(screen.getByRole("button", { name: "Remove PIN" }));
      await waitFor(() => expect(onUnlock).toHaveBeenCalledOnce());
      expect(resetPinWithPassword).not.toHaveBeenCalled();
    });

    it("stays locked if the server refuses", async () => {
      vi.mocked(hasRecentSignIn).mockReturnValue(true);
      vi.mocked(resetPinAfterSignIn).mockRejectedValue(new Error("A recent sign-in is required"));
      openForgot();
      fireEvent.click(screen.getByRole("button", { name: "Remove PIN" }));
      expect(await screen.findByText(/couldn't confirm it's you/)).toBeInTheDocument();
      expect(onUnlock).not.toHaveBeenCalled();
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ResetPasswordPage from "./ResetPasswordPage";
import { useAuth } from "@/contexts/AuthContext";
import { useMfaGate } from "@/hooks/useMfa";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("@/hooks/useMfa", () => ({ useMfaGate: vi.fn(), verifyTotpCode: vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { updateUser: vi.fn(), signOut: vi.fn() } },
}));

const clearRecovery = vi.fn();

function setup({ recovering = true, session = {}, needsCode = false }: { recovering?: boolean; session?: object | null; needsCode?: boolean } = {}) {
  vi.mocked(useAuth).mockReturnValue({
    session,
    user: { email: "asha@example.com" },
    loading: false,
    recovering,
    clearRecovery,
    signOut: vi.fn(),
  } as unknown as ReturnType<typeof useAuth>);
  vi.mocked(useMfaGate).mockReturnValue({ data: { needsCode } } as ReturnType<typeof useMfaGate>);
  render(<MemoryRouter><ResetPasswordPage /></MemoryRouter>);
}

const submit = (password: string, confirm = password) => {
  fireEvent.change(screen.getByLabelText("New password"), { target: { value: password } });
  fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: confirm } });
  fireEvent.click(screen.getByRole("button", { name: "Update Password" }));
};

describe("ResetPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.auth.updateUser).mockResolvedValue({ error: null } as never);
    vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null } as never);
  });

  it("refuses without a recovery link", () => {
    setup({ recovering: false });
    expect(screen.getByText("This reset link isn't valid")).toBeInTheDocument();
    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
  });

  it("refuses a recovery hash with no session behind it", () => {
    setup({ session: null });
    expect(screen.getByText("This reset link isn't valid")).toBeInTheDocument();
  });

  it("requires the MFA code first when MFA is enrolled", () => {
    setup({ needsCode: true });
    expect(screen.getByLabelText("Security code")).toBeInTheDocument();
    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
  });

  it("rejects a weak password without calling the server", () => {
    setup();
    submit("short1");
    expect(screen.getByText(/at least 10/)).toBeInTheDocument();
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
  });

  it("rejects mismatched passwords", () => {
    setup();
    submit("river-stone-42", "river-stone-43");
    expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
  });

  it("updates the password and signs out other sessions", async () => {
    setup();
    submit("river-stone-42");
    await waitFor(() => expect(clearRecovery).toHaveBeenCalledOnce());
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: "river-stone-42" });
    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: "others" });
  });
});

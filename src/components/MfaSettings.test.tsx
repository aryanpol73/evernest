import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MfaSettings } from "./MfaSettings";
import { confirmTotpEnrollment, generateRecoveryCodes, startTotpEnrollment, useRecoveryCodesRemaining, useTotpFactors } from "@/hooks/useMfa";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { email: "a@example.com" } }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/lib/reauth", () => ({ verifyCurrentPassword: vi.fn() }));
vi.mock("@/hooks/useMfa", () => ({
  useTotpFactors: vi.fn(),
  useRecoveryCodesRemaining: vi.fn(),
  startTotpEnrollment: vi.fn(),
  confirmTotpEnrollment: vi.fn(),
  generateRecoveryCodes: vi.fn(),
  removeTotpFactor: vi.fn(),
}));

const CODES = ["AAAA-BBBB-CCCC-DDDD-EEEE", "1111-2222-3333-4444-5555"];

function setup(factors: object[], remaining = 10) {
  vi.mocked(useTotpFactors).mockReturnValue({ data: factors } as never);
  vi.mocked(useRecoveryCodesRemaining).mockReturnValue({ data: remaining } as never);
  render(<QueryClientProvider client={new QueryClient()}><MfaSettings /></QueryClientProvider>);
}

describe("MfaSettings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows recovery codes straight after MFA is turned on", async () => {
    vi.mocked(startTotpEnrollment).mockResolvedValue({ factorId: "f1", qrCode: "data:image/png;base64,x", secret: "SECRET" });
    vi.mocked(confirmTotpEnrollment).mockResolvedValue();
    vi.mocked(generateRecoveryCodes).mockResolvedValue(CODES);
    setup([]);

    fireEvent.click(screen.getByRole("button", { name: /Set Up/ }));
    fireEvent.change(await screen.findByLabelText("6-digit code"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /Turn On/ }));

    const list = await screen.findByRole("list", { name: "Recovery codes" });
    expect(within(list).getAllByRole("listitem").map(li => li.textContent)).toEqual(CODES);
    expect(confirmTotpEnrollment).toHaveBeenCalledWith("f1", "123456");
  });

  it("hides the codes once the user says they've saved them", async () => {
    vi.mocked(generateRecoveryCodes).mockResolvedValue(CODES);
    setup([{ id: "f1" }]);
    fireEvent.click(screen.getByRole("button", { name: /Create New Codes/ }));
    fireEvent.click(await screen.findByRole("button", { name: "I've Saved Them" }));
    await waitFor(() => expect(screen.queryByRole("list", { name: "Recovery codes" })).not.toBeInTheDocument());
  });

  it("warns when codes are running out", () => {
    setup([{ id: "f1" }], 0);
    expect(screen.getByText(/no recovery codes left/)).toBeInTheDocument();
  });

  it("shows how many codes remain", () => {
    setup([{ id: "f1" }], 7);
    expect(screen.getByText(/7 recovery codes left/)).toBeInTheDocument();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PinLockScreen } from "./PinLockScreen";
import { resetPinWithPassword, usePinStatus, verifyPin } from "@/hooks/useUserSettings";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1", email: "a@example.com" } }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/useUserSettings", () => ({
  usePinStatus: vi.fn(),
  verifyPin: vi.fn(),
  resetPinWithPassword: vi.fn(),
}));

const onUnlock = vi.fn();

function renderScreen() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <PinLockScreen onUnlock={onUnlock} />
    </QueryClientProvider>,
  );
}

const enterPin = (pin: string) => {
  for (const digit of pin) fireEvent.click(screen.getByRole("button", { name: digit }));
};

describe("PinLockScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePinStatus).mockReturnValue({ data: { has_pin: true, locked_until: null } } as ReturnType<typeof usePinStatus>);
  });

  it("unlocks only when the server accepts the PIN", async () => {
    vi.mocked(verifyPin).mockResolvedValue({ ok: true, locked_until: null, attempts_remaining: 5 });
    renderScreen();
    enterPin("123456");
    await waitFor(() => expect(onUnlock).toHaveBeenCalledOnce());
    expect(verifyPin).toHaveBeenCalledWith("123456");
  });

  it("stays locked and shows remaining attempts on a wrong PIN", async () => {
    vi.mocked(verifyPin).mockResolvedValue({ ok: false, locked_until: null, attempts_remaining: 3 });
    renderScreen();
    enterPin("000000");
    expect(await screen.findByText("Wrong PIN. 3 attempts left.")).toBeInTheDocument();
    expect(onUnlock).not.toHaveBeenCalled();
  });

  it("stays locked when the server can't be reached", async () => {
    vi.mocked(verifyPin).mockRejectedValue(new Error("offline"));
    renderScreen();
    enterPin("123456");
    expect(await screen.findByText(/couldn't check your PIN/)).toBeInTheDocument();
    expect(onUnlock).not.toHaveBeenCalled();
  });

  it("disables the keypad during a server lockout", () => {
    const lockedUntil = new Date(Date.now() + 60_000).toISOString();
    vi.mocked(usePinStatus).mockReturnValue({ data: { has_pin: true, locked_until: lockedUntil } } as ReturnType<typeof usePinStatus>);
    renderScreen();
    expect(screen.getByRole("button", { name: "1" })).toBeDisabled();
  });

  it("removes a forgotten PIN only with the account password", async () => {
    vi.mocked(resetPinWithPassword).mockRejectedValueOnce(new Error("bad password"));
    vi.mocked(resetPinWithPassword).mockResolvedValueOnce(undefined);
    renderScreen();
    fireEvent.click(screen.getByRole("button", { name: "Forgot PIN?" }));

    const submit = (password: string) => {
      fireEvent.change(screen.getByLabelText("Account password"), { target: { value: password } });
      fireEvent.click(screen.getByRole("button", { name: "Remove PIN" }));
    };

    submit("wrong");
    expect(await screen.findByText(/couldn't verify that password/)).toBeInTheDocument();
    expect(onUnlock).not.toHaveBeenCalled();

    submit("right");
    await waitFor(() => expect(onUnlock).toHaveBeenCalledOnce());
    expect(resetPinWithPassword).toHaveBeenLastCalledWith("a@example.com", "right");
  });

  it("does not send typed password digits to the keypad", () => {
    renderScreen();
    fireEvent.click(screen.getByRole("button", { name: "Forgot PIN?" }));
    for (const digit of "123456") fireEvent.keyDown(window, { key: digit });
    expect(verifyPin).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { useMfaGate } from "@/hooks/useMfa";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("@/hooks/useMfa", () => ({ useMfaGate: vi.fn(), verifyTotpCode: vi.fn() }));

const signedIn = { user: { id: "u1" }, loading: false, signOut: vi.fn() } as unknown as ReturnType<typeof useAuth>;
const gateResult = (value: object) => value as ReturnType<typeof useMfaGate>;

function renderRoute() {
  render(
    <MemoryRouter>
      <ProtectedRoute><p>Family vault</p></ProtectedRoute>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(signedIn);
  });

  it("shows the app when no code is needed", () => {
    vi.mocked(useMfaGate).mockReturnValue(gateResult({ data: { needsCode: false } }));
    renderRoute();
    expect(screen.getByText("Family vault")).toBeInTheDocument();
  });

  it("asks for a code instead of showing the app", () => {
    vi.mocked(useMfaGate).mockReturnValue(gateResult({ data: { needsCode: true } }));
    renderRoute();
    expect(screen.getByLabelText("Security code")).toBeInTheDocument();
    expect(screen.queryByText("Family vault")).not.toBeInTheDocument();
  });

  it("stays closed while the check is loading", () => {
    vi.mocked(useMfaGate).mockReturnValue(gateResult({ isLoading: true }));
    renderRoute();
    expect(screen.queryByText("Family vault")).not.toBeInTheDocument();
  });

  it("stays closed if the check fails", () => {
    vi.mocked(useMfaGate).mockReturnValue(gateResult({ isError: true, refetch: vi.fn() }));
    renderRoute();
    expect(screen.getByText(/couldn't check your sign-in status/)).toBeInTheDocument();
    expect(screen.queryByText("Family vault")).not.toBeInTheDocument();
  });
});

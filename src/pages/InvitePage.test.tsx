import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import InvitePage from "./InvitePage";
import { acceptInvite, previewInvite } from "@/hooks/useFamilyAccess";
import { readPendingInvite, savePendingInvite } from "@/lib/pendingInvite";

const navigate = vi.fn();
const setActiveFamilyId = vi.fn();

vi.mock("react-router-dom", async importOriginal => ({ ...(await importOriginal<object>()), useNavigate: () => navigate }));
vi.mock("@/components/ProtectedRoute", () => ({ ProtectedRoute: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1", email: "a@example.com" }, signOut: vi.fn() }) }));
vi.mock("@/contexts/ActiveFamilyContext", () => ({ useActiveFamily: () => ({ setActiveFamilyId }) }));
vi.mock("@/hooks/useFamilyAccess", () => ({ previewInvite: vi.fn(), acceptInvite: vi.fn() }));

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter><InvitePage /></MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("InvitePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    window.history.replaceState(null, "", "/invite");
  });

  it("takes the token out of the address bar straight away", async () => {
    vi.mocked(previewInvite).mockResolvedValue({ family_name: "The Sharmas", role: "viewer" });
    window.history.replaceState(null, "", "/invite#token=abc123");
    renderPage();
    expect(window.location.hash).toBe("");
    expect(readPendingInvite()).toBe("abc123");
    await screen.findByText("Join The Sharmas?");
  });

  it("explains what joining means before anything happens", async () => {
    vi.mocked(previewInvite).mockResolvedValue({ family_name: "The Sharmas", role: "editor" });
    savePendingInvite("abc123");
    renderPage();
    expect(await screen.findByText(/as an Editor/)).toHaveTextContent(/owner will be able to see/);
    expect(acceptInvite).not.toHaveBeenCalled();
  });

  it("joins, switches to the family, and forgets the token", async () => {
    vi.mocked(previewInvite).mockResolvedValue({ family_name: "The Sharmas", role: "viewer" });
    vi.mocked(acceptInvite).mockResolvedValue("family-1");
    savePendingInvite("abc123");
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Accept Invite" }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/dashboard", { replace: true }));
    expect(acceptInvite).toHaveBeenCalledWith("abc123");
    expect(setActiveFamilyId).toHaveBeenCalledWith("family-1");
    expect(readPendingInvite()).toBeNull();
  });

  it("explains an unusable invite and names the signed-in account", async () => {
    vi.mocked(previewInvite).mockRejectedValue(new Error("not valid"));
    savePendingInvite("abc123");
    renderPage();
    expect(await screen.findByText("This invite can't be used")).toBeInTheDocument();
    expect(screen.getByText(/signed in as a@example.com/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Accept Invite" })).not.toBeInTheDocument();
  });

  it("handles a link with no token", () => {
    renderPage();
    expect(screen.getByText("This invite link isn't complete")).toBeInTheDocument();
    expect(previewInvite).not.toHaveBeenCalled();
  });
});

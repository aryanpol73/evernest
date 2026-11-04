import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FamilyAccessSettings } from "./FamilyAccessSettings";
import { useFamily } from "@/hooks/useFamily";
import { createInvite, removeAccess, revokeInvite, useFamilyAccess, usePendingInvites } from "@/hooks/useFamilyAccess";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "me" } }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/useFamily", () => ({ useFamily: vi.fn(), useFamilies: vi.fn(() => ({ data: [] })) }));
vi.mock("@/contexts/ActiveFamilyContext", () => ({ useActiveFamily: () => ({ setActiveFamilyId: vi.fn() }) }));
vi.mock("@/hooks/useFamilyAccess", () => ({
  useFamilyAccess: vi.fn(),
  usePendingInvites: vi.fn(),
  createInvite: vi.fn(),
  removeAccess: vi.fn(),
  revokeInvite: vi.fn(),
  setMemberRole: vi.fn(),
}));

const PEOPLE = [
  { user_id: "me", email: "me@example.com", full_name: "Me", role: "owner", joined_at: "" },
  { user_id: "p2", email: "ravi@example.com", full_name: null, role: "viewer", joined_at: "" },
];

function setup(role: string, invites: object[] = []) {
  vi.mocked(useFamily).mockReturnValue({ data: { id: "f1", name: "The Sharmas", role } } as never);
  vi.mocked(useFamilyAccess).mockReturnValue({ data: PEOPLE } as never);
  vi.mocked(usePendingInvites).mockReturnValue({ data: invites } as never);
  render(<QueryClientProvider client={new QueryClient()}><FamilyAccessSettings /></QueryClientProvider>);
}

describe("FamilyAccessSettings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lets the owner remove people, but never themselves", async () => {
    vi.mocked(removeAccess).mockResolvedValue();
    setup("owner");
    const remove = screen.getAllByRole("button", { name: "Remove" });
    expect(remove).toHaveLength(1);
    fireEvent.click(remove[0]);
    await waitFor(() => expect(removeAccess).toHaveBeenCalledWith("f1", "p2"));
  });

  it("shows the invite link once, after creating it", async () => {
    vi.mocked(createInvite).mockResolvedValue("token123");
    setup("owner");
    fireEvent.change(screen.getByLabelText("Their email"), { target: { value: "new@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /Create Invite Link/ }));
    await waitFor(() => expect(createInvite).toHaveBeenCalledWith("f1", "new@example.com", "viewer"));
    expect(await screen.findByLabelText("Invite link")).toHaveValue(`${window.location.origin}/invite#token=token123`);
  });

  it("lets the owner revoke a pending invite", async () => {
    vi.mocked(revokeInvite).mockResolvedValue();
    setup("owner", [{ id: "i1", email: "new@example.com", role: "editor", expires_at: "" }]);
    fireEvent.click(screen.getByRole("button", { name: "Revoke" }));
    await waitFor(() => expect(revokeInvite).toHaveBeenCalledWith("i1"));
  });

  it.each(["editor", "viewer"])("gives an %s the list and a way to leave, and no controls", async role => {
    vi.mocked(removeAccess).mockResolvedValue();
    setup(role);
    expect(screen.getByText("ravi@example.com")).toBeInTheDocument();
    expect(screen.queryByText("Invite Someone")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Leave This Family" }));
    await waitFor(() => expect(removeAccess).toHaveBeenCalledWith("f1", "me"));
  });
});

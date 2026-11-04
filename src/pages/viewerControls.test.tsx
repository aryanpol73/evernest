import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import DocumentsPage from "./DocumentsPage";
import FamilyTreePage from "./FamilyTreePage";
import MembersPage from "./MembersPage";
import RemindersPage from "./RemindersPage";
import { useCanEdit } from "@/hooks/useFamily";

const SOON = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);

const doc = { id: "d1", name: "Passport", category: "Identity", member_id: null, file_path: "f/general/a.pdf", file_type: "application/pdf", expiry_date: SOON, dismissed_reminder: false };
const member = { id: "m1", name: "Asha", relation: null, phone: null, blood_group: null, date_of_birth: null, parent_member_id: null, notes: null };

const mutation = { mutate: vi.fn(), isPending: false };

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/lib/documentAccess", () => ({ fetchDocumentForPreview: vi.fn(), saveDocument: vi.fn() }));
vi.mock("@/hooks/useFamily", () => ({
  useCanEdit: vi.fn(),
  useFamily: () => ({ data: { id: "f1" } }),
  useFamilyMembers: () => ({ data: [member], isLoading: false }),
  useDocuments: () => ({ data: [doc], isLoading: false }),
  useAddDocument: () => mutation,
  useDeleteDocument: () => mutation,
  useAddMember: () => mutation,
  useUpdateMember: () => mutation,
  useDeleteMember: () => mutation,
  useDismissReminder: () => mutation,
}));

const page = (ui: React.ReactNode) => render(<MemoryRouter>{ui}</MemoryRouter>);
const iconButtons = (name: string) => document.querySelectorAll(`button svg[class*="lucide-${name}"]`).length;

describe("controls by role", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("for a viewer", () => {
    beforeEach(() => vi.mocked(useCanEdit).mockReturnValue(false));

    it("hides upload and delete, but keeps view and download", () => {
      page(<DocumentsPage />);
      expect(screen.getByText("Passport")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Upload Document/ })).not.toBeInTheDocument();
      expect(iconButtons("trash")).toBe(0);
      expect(iconButtons("eye")).toBe(1);
      expect(iconButtons("download")).toBe(1);
    });

    it("hides adding, editing, and removing members", () => {
      page(<MembersPage />);
      expect(screen.getByText("Asha")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Add Member/ })).not.toBeInTheDocument();
      expect(iconButtons("trash")).toBe(0);
    });

    it("hides adding to the family tree", () => {
      page(<FamilyTreePage />);
      expect(screen.queryByRole("button", { name: /Add Member/ })).not.toBeInTheDocument();
    });

    it("hides dismissing a reminder", () => {
      page(<RemindersPage />);
      expect(screen.getByText("Passport")).toBeInTheDocument();
      expect(iconButtons("x")).toBe(0);
    });
  });

  describe("for an editor", () => {
    beforeEach(() => vi.mocked(useCanEdit).mockReturnValue(true));

    it("shows document controls", () => {
      page(<DocumentsPage />);
      expect(screen.getByRole("button", { name: /Upload Document/ })).toBeInTheDocument();
      expect(iconButtons("trash")).toBe(1);
    });

    it("shows member controls", () => {
      page(<MembersPage />);
      expect(screen.getByRole("button", { name: /Add Member/ })).toBeInTheDocument();
      expect(iconButtons("trash")).toBe(1);
    });

    it("shows reminder dismissal", () => {
      page(<RemindersPage />);
      expect(iconButtons("x")).toBe(1);
    });
  });
});

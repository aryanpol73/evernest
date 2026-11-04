import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { YourDataSettings } from "./YourDataSettings";
import { useTotpFactors } from "@/hooks/useMfa";
import { deleteAccount } from "@/lib/accountDeletion";
import { buildDataExport, saveDataExport } from "@/lib/dataExport";

const toast = vi.fn();

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1", email: "a@example.com" } }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/hooks/useMfa", () => ({ useTotpFactors: vi.fn() }));
vi.mock("@/lib/accountDeletion", () => ({ deleteAccount: vi.fn() }));
vi.mock("@/lib/dataExport", () => ({ buildDataExport: vi.fn(), saveDataExport: vi.fn() }));

function setup(factors: object[] = []) {
  vi.mocked(useTotpFactors).mockReturnValue({ data: factors } as ReturnType<typeof useTotpFactors>);
  render(<MemoryRouter><YourDataSettings /></MemoryRouter>);
}

const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const deleteButton = () => screen.getByRole("button", { name: /Delete My Account/ });

describe("YourDataSettings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("exports and saves the archive", async () => {
    const archive = new Uint8Array([1]);
    vi.mocked(buildDataExport).mockResolvedValue(archive);
    setup();
    fireEvent.click(screen.getByRole("button", { name: /Download My Data/ }));
    await waitFor(() => expect(saveDataExport).toHaveBeenCalledWith(archive));
  });

  it("saves nothing when the export fails", async () => {
    vi.mocked(buildDataExport).mockRejectedValue(new Error("couldn't read"));
    setup();
    fireEvent.click(screen.getByRole("button", { name: /Download My Data/ }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Export failed" })));
    expect(saveDataExport).not.toHaveBeenCalled();
  });

  it("needs both the password and the exact confirmation word", () => {
    setup();
    expect(deleteButton()).toBeDisabled();
    type("Account password", "pw");
    expect(deleteButton()).toBeDisabled();
    type(/to confirm/, "delete");
    expect(deleteButton()).toBeDisabled();
    type(/to confirm/, "DELETE");
    expect(deleteButton()).toBeEnabled();
  });

  it("asks for a security code only when MFA is on", () => {
    setup([{ id: "factor-1" }]);
    type("Account password", "pw");
    type(/to confirm/, "DELETE");
    expect(deleteButton()).toBeDisabled();
    type("Security code", "123456");
    expect(deleteButton()).toBeEnabled();
  });

  it("deletes with the entered details", async () => {
    vi.mocked(deleteAccount).mockResolvedValue();
    setup();
    type("Account password", "pw");
    type(/to confirm/, "DELETE");
    fireEvent.click(deleteButton());
    await waitFor(() => expect(deleteAccount).toHaveBeenCalledWith({ email: "a@example.com", password: "pw", mfaCode: undefined }));
  });

  it("explains a failure and clears the password", async () => {
    vi.mocked(deleteAccount).mockRejectedValue(new Error("That password is incorrect."));
    setup();
    type("Account password", "wrong");
    type(/to confirm/, "DELETE");
    fireEvent.click(deleteButton());
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Account not deleted", description: "That password is incorrect." })));
    expect(screen.getByLabelText("Account password")).toHaveValue("");
  });
});

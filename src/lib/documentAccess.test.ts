import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchDocumentForPreview, saveDocument } from "./documentAccess";
import { supabase } from "@/integrations/supabase/client";

const download = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { storage: { from: () => ({ download: (path: string) => download(path) }) }, rpc: vi.fn() },
}));

const doc = { id: "doc-1", name: "Passport", file_path: "family/general/a.pdf" };
const file = new Blob(["pdf"]);

describe("document access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    download.mockResolvedValue({ data: file, error: null });
    vi.mocked(supabase.rpc).mockResolvedValue({ error: null } as never);
    URL.createObjectURL = vi.fn(() => "blob:test");
    URL.revokeObjectURL = vi.fn();
  });

  it("records a preview as a view", async () => {
    await expect(fetchDocumentForPreview(doc)).resolves.toBe(file);
    expect(supabase.rpc).toHaveBeenCalledWith("record_document_access", { _document_id: "doc-1", _action: "document_viewed" });
  });

  it("records a save as a download", async () => {
    await saveDocument(doc);
    expect(supabase.rpc).toHaveBeenCalledWith("record_document_access", { _document_id: "doc-1", _action: "document_downloaded" });
  });

  it("records nothing when the file couldn't be fetched", async () => {
    download.mockResolvedValue({ data: null, error: new Error("denied") });
    await expect(saveDocument(doc)).rejects.toThrow("denied");
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("still returns the file if logging fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(supabase.rpc).mockResolvedValue({ error: { message: "offline" } } as never);
    await expect(fetchDocumentForPreview(doc)).resolves.toBe(file);
  });
});

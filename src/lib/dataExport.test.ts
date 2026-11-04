// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { buildDataExport, exportFileName } from "./dataExport";
import { fetchDocumentForDownload } from "@/lib/documentAccess";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/lib/documentAccess", () => ({ fetchDocumentForDownload: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: vi.fn() } }));

const user = { id: "user-1", email: "a@example.com" };
const doc = { id: "doc-1", name: "Passport", file_path: "family/general/abc.pdf" };

const filters: unknown[][] = [];

// A query that resolves however the code chains it.
function query(result: { data: unknown; error: unknown }, onRange?: (from: number) => { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {
    select: () => chain,
    eq: (...filter: unknown[]) => {
      filters.push(filter);
      return chain;
    },
    order: () => chain,
    maybeSingle: () => chain,
    range: (from: number) => (onRange ? Promise.resolve(onRange(from)) : chain),
    then: (resolve: (value: unknown) => void) => resolve(result),
  };
  return chain;
}

function mockTables(tables: Record<string, unknown>, onRange?: (from: number) => { data: unknown; error: unknown }) {
  vi.mocked(supabase.from).mockImplementation(((table: string) =>
    query({ data: tables[table] ?? null, error: null }, table === "audit_events" ? onRange : undefined)) as never);
}

describe("buildDataExport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchDocumentForDownload).mockResolvedValue(new Blob(["file bytes"]));
  });

  it("includes every record and every file", async () => {
    mockTables(
      { profiles: { id: "user-1" }, families: { id: "family" }, family_members: [{ name: "Asha" }], documents: [doc] },
      () => ({ data: [{ action: "pin_set" }], error: null }),
    );

    const archive = unzipSync(await buildDataExport(user));
    const data = JSON.parse(strFromU8(archive["evernest-data.json"]));

    expect(data.account).toEqual(user);
    expect(data.members).toEqual([{ name: "Asha" }]);
    expect(data.activity).toEqual([{ action: "pin_set" }]);
    expect(data.documents[0].export_file).toBe("documents/Passport-doc-1.pdf");
    expect(strFromU8(archive["documents/Passport-doc-1.pdf"])).toBe("file bytes");
  });

  it("covers only the family the user owns, not families they joined", async () => {
    filters.length = 0;
    mockTables({ families: { id: "own-family" }, documents: [] }, () => ({ data: [], error: null }));
    await buildDataExport(user);
    expect(filters).toContainEqual(["owner_id", "user-1"]);
    expect(filters.filter(f => f[0] === "family_id")).toEqual([
      ["family_id", "own-family"],
      ["family_id", "own-family"],
      ["family_id", "own-family"],
    ]);
  });

  it("reads every page of activity", async () => {
    mockTables({ families: { id: "family" }, documents: [] }, from => ({
      data: Array.from({ length: from === 0 ? 1000 : 2 }, (_, i) => ({ id: from + i })),
      error: null,
    }));
    const data = JSON.parse(strFromU8(unzipSync(await buildDataExport(user))["evernest-data.json"]));
    expect(data.activity).toHaveLength(1002);
  });

  it("stops rather than producing an incomplete export", async () => {
    mockTables({ families: { id: "family" }, documents: [doc] }, () => ({ data: [], error: null }));
    vi.mocked(fetchDocumentForDownload).mockRejectedValue(new Error("denied"));
    await expect(buildDataExport(user)).rejects.toThrow(/couldn't read "Passport"/);
  });

  it("stops if a table can't be read", async () => {
    vi.mocked(supabase.from).mockImplementation(((table: string) =>
      table === "family_members" ? query({ data: null, error: new Error("denied") }) : query({ data: [], error: null }, () => ({ data: [], error: null }))) as never);
    await expect(buildDataExport(user)).rejects.toThrow("denied");
  });
});

describe("exportFileName", () => {
  it("keeps names in any script readable", () => {
    expect(exportFileName({ ...doc, name: "आधार कार्ड" })).toBe("documents/आधार कार्ड-doc-1.pdf");
  });

  it("cannot escape the documents folder", () => {
    const name = exportFileName({ ...doc, name: "../../etc/passwd" });
    expect(name).toBe("documents/______etc_passwd-doc-1.pdf");
    expect(name.split("/")).toHaveLength(2);
  });

  it("gives two documents with the same name different files", () => {
    expect(exportFileName(doc)).not.toBe(exportFileName({ ...doc, id: "doc-2" }));
  });

  it("handles a name with nothing usable", () => {
    expect(exportFileName({ ...doc, name: "   " })).toBe("documents/document-doc-1.pdf");
  });
});

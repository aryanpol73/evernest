import { describe, expect, it } from "vitest";
import { buildStoragePath, documentTypeFor, MAX_FILE_SIZE, previewKindFor, validateDocumentFile } from "./documentFiles";

describe("validateDocumentFile", () => {
  it("accepts allowed types regardless of case", () => {
    expect(validateDocumentFile({ name: "Passport.PDF", size: 100 })).toBeNull();
  });

  it.each(["page.html", "image.svg", "script.js", "archive.pdf.exe", "noextension"])("rejects %s", name => {
    expect(validateDocumentFile({ name, size: 100 })).toMatch(/Only PDF/);
  });

  it("rejects files over the size limit", () => {
    expect(validateDocumentFile({ name: "a.pdf", size: MAX_FILE_SIZE + 1 })).toMatch(/10MB/);
  });
});

describe("documentTypeFor", () => {
  it("derives the type from the extension, not the browser", () => {
    expect(documentTypeFor("a.docx")).toContain("wordprocessingml");
    expect(documentTypeFor("a.svg")).toBeNull();
  });
});

describe("buildStoragePath", () => {
  it("keeps the family folder first and drops the original name", () => {
    const path = buildStoragePath("family-1", null, "aadhaar_rahul_sharma.pdf");
    expect(path).toMatch(/^family-1\/general\/[0-9a-f-]{36}\.pdf$/);
    expect(path).not.toContain("rahul");
  });

  it("cannot be redirected by a crafted file name", () => {
    const path = buildStoragePath("family-1", "member-1", "../../other-family/evil.pdf");
    expect(path).toMatch(/^family-1\/member-1\/[0-9a-f-]{36}\.pdf$/);
  });
});

describe("previewKindFor", () => {
  it("allows only inert types", () => {
    expect(previewKindFor("image/png")).toBe("image");
    expect(previewKindFor("application/pdf")).toBe("pdf");
  });

  it.each(["text/html", "image/svg+xml", "application/xhtml+xml", "application/msword", null])("refuses %s", type => {
    expect(previewKindFor(type)).toBeNull();
  });
});

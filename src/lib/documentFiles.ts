export const MAX_FILE_SIZE = 10 * 1024 * 1024;

const TYPE_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export const ACCEPTED_FILE_TYPES = Object.keys(TYPE_BY_EXTENSION).map(ext => `.${ext}`).join(",");

function extensionOf(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

export function documentTypeFor(fileName: string): string | null {
  return TYPE_BY_EXTENSION[extensionOf(fileName)] ?? null;
}

export function validateDocumentFile(file: Pick<File, "name" | "size">): string | null {
  if (!documentTypeFor(file.name)) return "Only PDF, JPG, PNG, DOC, and DOCX files are allowed.";
  if (file.size > MAX_FILE_SIZE) return "Maximum file size is 10MB.";
  return null;
}

// Paths appear in logs and URLs, so they carry no part of the original file name.
export function buildStoragePath(familyId: string, memberId: string | null, fileName: string): string {
  return `${familyId}/${memberId || "general"}/${crypto.randomUUID()}.${extensionOf(fileName)}`;
}

export type PreviewKind = "image" | "pdf";

// Stored files are untrusted. Only these types may be rendered in the app, because
// anything else (HTML, SVG) could run script with access to the user's session.
export function previewKindFor(fileType: string | null): PreviewKind | null {
  if (fileType === "image/jpeg" || fileType === "image/png") return "image";
  if (fileType === "application/pdf") return "pdf";
  return null;
}

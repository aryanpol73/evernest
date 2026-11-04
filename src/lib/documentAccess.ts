import { supabase } from "@/integrations/supabase/client";
import type { Document } from "@/hooks/useFamily";

type StoredDocument = Pick<Document, "id" | "name" | "file_path">;
type AccessAction = "document_viewed" | "document_downloaded";

async function fetchDocument(doc: StoredDocument, action: AccessAction): Promise<Blob> {
  const { data, error } = await supabase.storage.from("family-documents").download(doc.file_path);
  if (error) throw error;

  // A logging failure must not stop someone reaching a document in an emergency.
  const { error: logError } = await supabase.rpc("record_document_access", { _document_id: doc.id, _action: action });
  if (logError) console.warn("Could not record document access", logError.message);

  return data;
}

export function fetchDocumentForPreview(doc: StoredDocument): Promise<Blob> {
  return fetchDocument(doc, "document_viewed");
}

export async function saveDocument(doc: StoredDocument): Promise<void> {
  const data = await fetchDocument(doc, "document_downloaded");
  const url = URL.createObjectURL(data);
  const link = document.createElement("a");
  link.href = url;
  link.download = doc.name;
  link.click();
  URL.revokeObjectURL(url);
}

import { strToU8, zipSync, type Zippable } from "fflate";
import { supabase } from "@/integrations/supabase/client";
import { fetchDocumentForDownload } from "@/lib/documentAccess";

const ACTIVITY_PAGE_SIZE = 1000;

async function fetchAllActivity(familyId: string) {
  const events = [];
  for (let start = 0; ; start += ACTIVITY_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("audit_events")
      .select("*")
      .eq("family_id", familyId)
      .order("id", { ascending: true })
      .range(start, start + ACTIVITY_PAGE_SIZE - 1);
    if (error) throw error;
    events.push(...data);
    if (data.length < ACTIVITY_PAGE_SIZE) return events;
  }
}

// Names come from users and end up as paths when the archive is unpacked.
export function exportFileName(doc: { id: string; name: string; file_path: string }): string {
  // \p{M} keeps combining marks, without which most Indic names would be mangled.
  const safeName = doc.name.replace(/[^\p{L}\p{M}\p{N} _-]/gu, "_").trim().slice(0, 80) || "document";
  const extension = doc.file_path.split(".").pop()?.replace(/[^a-z0-9]/gi, "") ?? "";
  return `documents/${safeName}-${doc.id}${extension ? `.${extension}` : ""}`;
}

async function required<T>(query: PromiseLike<{ data: T | null; error: unknown }>): Promise<T | null> {
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// An incomplete export could pass for a complete backup, so any failure stops it.
export async function buildDataExport(user: { id: string; email?: string }): Promise<Uint8Array> {
  // Only the family the user owns. Families they were invited to belong to someone else.
  const { data: family, error: familyError } = await supabase.from("families").select("*").eq("owner_id", user.id).maybeSingle();
  if (familyError) throw familyError;
  if (!family) throw new Error("We couldn't find your family. Please try again.");

  const [profile, members, documents, activity] = await Promise.all([
    required(supabase.from("profiles").select("*").eq("id", user.id).maybeSingle()),
    required(supabase.from("family_members").select("*").eq("family_id", family.id).order("created_at")),
    required(supabase.from("documents").select("*").eq("family_id", family.id).order("created_at")),
    fetchAllActivity(family.id),
  ]);

  const files: Zippable = {};
  const exportedDocuments = [];
  for (const doc of documents ?? []) {
    let blob: Blob;
    try {
      blob = await fetchDocumentForDownload(doc);
    } catch {
      throw new Error(`Export stopped: couldn't read "${doc.name}". Nothing was saved. Please try again.`);
    }
    const fileName = exportFileName(doc);
    // Already-compressed formats gain nothing from being compressed again.
    files[fileName] = [new Uint8Array(await blob.arrayBuffer()), { level: 0 }];
    exportedDocuments.push({ ...doc, export_file: fileName });
  }

  const data = {
    exported_at: new Date().toISOString(),
    account: { id: user.id, email: user.email },
    profile,
    family,
    members,
    documents: exportedDocuments,
    activity,
  };
  files["evernest-data.json"] = strToU8(JSON.stringify(data, null, 2));

  return zipSync(files);
}

export function saveDataExport(archive: Uint8Array): void {
  const url = URL.createObjectURL(new Blob([archive as BlobPart], { type: "application/zip" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `evernest-export-${new Date().toISOString().slice(0, 10)}.zip`;
  link.click();
  URL.revokeObjectURL(url);
}

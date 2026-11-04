import { useState } from "react";
import { FileText, Plus, Download, Trash2, Eye, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { DocumentUploadModal, type DocumentFormData } from "@/components/DocumentUploadModal";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { PdfPreview } from "@/components/PdfPreview";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCanEdit, useFamily, useFamilyMembers, useDocuments, useAddDocument, useDeleteDocument, type Document as VaultDocument } from "@/hooks/useFamily";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { previewKindFor, type PreviewKind } from "@/lib/documentFiles";
import { fetchDocumentForPreview, saveDocument } from "@/lib/documentAccess";

const categories = ["All", "Identity", "Medical", "Insurance", "Property", "Education", "Financial"];

export default function DocumentsPage() {
  const { user } = useAuth();
  const { data: family } = useFamily();
  const canEdit = useCanEdit();
  const { data: members } = useFamilyMembers();
  const { data: docs, isLoading } = useDocuments();
  const addDocument = useAddDocument();
  const deleteDocument = useDeleteDocument();
  const { toast } = useToast();

  const [uploadOpen, setUploadOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; filePath: string } | null>(null);
  const [preview, setPreview] = useState<{ file: Blob; url: string; name: string; kind: PreviewKind } | null>(null);

  const filtered = docs?.filter(d => {
    if (activeCategory !== "All" && d.category !== activeCategory) return false;
    if (search && !d.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }) || [];

  const getMemberName = (memberId: string | null) => memberId ? members?.find(m => m.id === memberId)?.name || null : null;

  const handleUpload = (data: DocumentFormData) => {
    if (!family || !user) return;
    addDocument.mutate({
      file: data.file,
      metadata: {
        family_id: family.id,
        member_id: data.memberId === "none" ? null : data.memberId,
        user_id: user.id, name: data.name, category: data.category,
        expiry_date: data.expiryDate, tags: data.tags, dismissed_reminder: false,
      },
    }, { onSuccess: () => setUploadOpen(false) });
  };

  const handleDownload = async (doc: VaultDocument) => {
    try {
      await saveDocument(doc);
    } catch (e) {
      toast({ title: "Download failed", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    }
  };

  const handlePreview = async (doc: VaultDocument) => {
    const kind = previewKindFor(doc.file_type);
    if (!kind) { toast({ title: "Preview not available", description: "Download this file to open it." }); return; }
    try {
      const data = await fetchDocumentForPreview(doc);
      // The type comes from the allowlist, never from the downloaded response.
      const file = new Blob([data], { type: doc.file_type ?? undefined });
      setPreview({ file, url: URL.createObjectURL(file), name: doc.name, kind });
    } catch (e) {
      toast({ title: "Preview failed", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    }
  };

  const closePreview = () => {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Document Vault"
        subtitle="Your family's important documents, organized and secure."
        actions={canEdit ? <Button className="gap-2" onClick={() => setUploadOpen(true)}><Plus className="h-4 w-4" /> Upload Document</Button> : undefined}
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search documents..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {categories.map(cat => (
          <button key={cat} onClick={() => setActiveCategory(cat)}
            className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${activeCategory === cat ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
          >{cat}</button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => (
          <div key={i} className="rounded-lg border bg-card p-4"><Skeleton className="h-5 w-48 mb-2" /><Skeleton className="h-4 w-32" /></div>
        ))}</div>
      ) : !filtered.length ? (
        <EmptyState
          icon={FileText}
          illustration={!search && activeCategory === "All" ? "folder" : undefined}
          title={search || activeCategory !== "All" ? "No matching documents" : "Your document vault is empty"}
          description={search || activeCategory !== "All" ? "Try a different search or category." : "Start by uploading an important document for any family member."}
          ctaLabel={canEdit && !search && activeCategory === "All" ? "Upload First Document" : undefined}
          onCta={canEdit && !search && activeCategory === "All" ? () => setUploadOpen(true) : undefined}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map(doc => (
            <div key={doc.id} className="flex items-center justify-between rounded-lg border bg-card p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-center gap-3 min-w-0">
                <div className="rounded-lg bg-primary/10 p-2"><FileText className="h-4 w-4 text-primary" /></div>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{doc.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {doc.category}{getMemberName(doc.member_id) && ` · ${getMemberName(doc.member_id)}`}{doc.expiry_date && ` · Expires ${doc.expiry_date}`}
                  </p>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handlePreview(doc)}><Eye className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload(doc)}><Download className="h-4 w-4" /></Button>
                {canEdit && <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget({ id: doc.id, filePath: doc.file_path })}><Trash2 className="h-4 w-4" /></Button>}
              </div>
            </div>
          ))}
        </div>
      )}

      <DocumentUploadModal open={uploadOpen} onOpenChange={setUploadOpen} onSubmit={handleUpload} members={members || []} loading={addDocument.isPending} />
      <DeleteConfirmDialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)} onConfirm={() => { if (deleteTarget) deleteDocument.mutate(deleteTarget, { onSuccess: () => setDeleteTarget(null) }); }} title="Delete Document?" loading={deleteDocument.isPending} />

      <Dialog open={!!preview} onOpenChange={v => { if (!v) closePreview(); }}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader><DialogTitle>{preview?.name}</DialogTitle></DialogHeader>
          {preview && (
            <div className="overflow-auto max-h-[65vh]">
              {preview.kind === "image"
                ? <img src={preview.url} alt={preview.name} className="max-w-full mx-auto rounded border" />
                : <PdfPreview file={preview.file} />}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

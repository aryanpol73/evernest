import { useState } from "react";
import { FileText, Plus, Download, Trash2, Eye, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { DocumentUploadModal } from "@/components/DocumentUploadModal";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useFamily, useFamilyMembers, useDocuments, useAddDocument, useDeleteDocument } from "@/hooks/useFamily";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const categories = ["All", "Identity", "Medical", "Insurance", "Property", "Education", "Financial"];

export default function DocumentsPage() {
  const { user } = useAuth();
  const { data: family } = useFamily();
  const { data: members } = useFamilyMembers();
  const { data: docs, isLoading } = useDocuments();
  const addDocument = useAddDocument();
  const deleteDocument = useDeleteDocument();
  const { toast } = useToast();

  const [uploadOpen, setUploadOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; filePath: string } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState("");

  const filtered = docs?.filter(d => {
    if (activeCategory !== "All" && d.category !== activeCategory) return false;
    if (search && !d.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }) || [];

  const getMemberName = (memberId: string | null) => {
    if (!memberId) return null;
    return members?.find(m => m.id === memberId)?.name || null;
  };

  const handleUpload = (data: any) => {
    if (!family || !user) return;
    addDocument.mutate({
      file: data.file,
      metadata: {
        family_id: family.id,
        member_id: data.memberId === "none" ? null : data.memberId,
        user_id: user.id,
        name: data.name,
        category: data.category,
        expiry_date: data.expiryDate,
        tags: data.tags,
        dismissed_reminder: false,
      },
    }, { onSuccess: () => setUploadOpen(false) });
  };

  const handleDownload = async (filePath: string, fileName: string) => {
    const { data, error } = await supabase.storage.from("family-documents").download(filePath);
    if (error) { toast({ title: "Download failed", description: error.message, variant: "destructive" }); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a"); a.href = url; a.download = fileName; a.click();
    URL.revokeObjectURL(url);
  };

  const handlePreview = async (filePath: string, name: string) => {
    const { data, error } = await supabase.storage.from("family-documents").download(filePath);
    if (error) { toast({ title: "Preview failed", description: error.message, variant: "destructive" }); return; }
    setPreviewUrl(URL.createObjectURL(data));
    setPreviewName(name);
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Document Vault"
        subtitle="Your family's important documents, organized and secure."
        actions={<Button className="gap-2" onClick={() => setUploadOpen(true)}><Plus className="h-4 w-4" /> Upload Document</Button>}
      />

      {/* Search + Category Tabs */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search documents..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
              activeCategory === cat ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
      ) : !filtered.length ? (
        <EmptyState
          icon={FileText}
          title={search || activeCategory !== "All" ? "No matching documents" : "No documents uploaded"}
          description={search || activeCategory !== "All" ? "Try a different search or category." : "Upload your first document to start building your secure vault."}
          ctaLabel={!search && activeCategory === "All" ? "Upload Document" : undefined}
          onCta={!search && activeCategory === "All" ? () => setUploadOpen(true) : undefined}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map(doc => (
            <div key={doc.id} className="flex items-center justify-between rounded-lg border bg-card p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="h-5 w-5 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{doc.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {doc.category}
                    {getMemberName(doc.member_id) && ` · ${getMemberName(doc.member_id)}`}
                    {doc.expiry_date && ` · Expires ${doc.expiry_date}`}
                  </p>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handlePreview(doc.file_path, doc.name)}><Eye className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload(doc.file_path, doc.name)}><Download className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget({ id: doc.id, filePath: doc.file_path })}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <DocumentUploadModal open={uploadOpen} onOpenChange={setUploadOpen} onSubmit={handleUpload} members={members || []} loading={addDocument.isPending} />
      <DeleteConfirmDialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)} onConfirm={() => { if (deleteTarget) deleteDocument.mutate(deleteTarget, { onSuccess: () => setDeleteTarget(null) }); }} title="Delete Document?" loading={deleteDocument.isPending} />

      {/* Preview Dialog */}
      <Dialog open={!!previewUrl} onOpenChange={v => { if (!v) { if (previewUrl) URL.revokeObjectURL(previewUrl); setPreviewUrl(null); } }}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader><DialogTitle>{previewName}</DialogTitle></DialogHeader>
          {previewUrl && (
            <div className="overflow-auto max-h-[65vh]">
              {previewUrl && <iframe src={previewUrl} className="w-full h-[60vh] rounded border" />}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

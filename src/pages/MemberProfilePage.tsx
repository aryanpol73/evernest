import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { DocumentUploadModal } from "@/components/DocumentUploadModal";
import { useFamilyMembers, useUpdateMember, useDocuments, useFamily, useAddDocument, useDeleteDocument, FamilyMember, type Document as VaultDocument } from "@/hooks/useFamily";
import { saveDocument } from "@/lib/documentAccess";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { FileText, Download, Trash2 } from "lucide-react";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const RELATIONS = ["Self", "Spouse", "Father", "Mother", "Son", "Daughter", "Brother", "Sister", "Grandfather", "Grandmother", "Uncle", "Aunt", "Cousin", "Other"];

export default function MemberProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: members, isLoading } = useFamilyMembers();
  const { data: family } = useFamily();
  const { data: allDocs } = useDocuments();
  const updateMember = useUpdateMember();
  const addDocument = useAddDocument();
  const deleteDocument = useDeleteDocument();
  const { toast } = useToast();

  const member = members?.find(m => m.id === id);
  const memberDocs = allDocs?.filter(d => d.member_id === id) || [];

  const [name, setName] = useState("");
  const [relation, setRelation] = useState("");
  const [dob, setDob] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteDoc, setDeleteDoc] = useState<{ id: string; filePath: string } | null>(null);

  if (member && !initialized) {
    setName(member.name);
    setRelation(member.relation || "");
    setDob(member.date_of_birth || "");
    setBloodGroup(member.blood_group || "");
    setPhone(member.phone || "");
    setNotes(member.notes || "");
    setInitialized(true);
  }

  const handleSave = () => {
    if (!member) return;
    updateMember.mutate({
      id: member.id,
      name, relation: relation || null, date_of_birth: dob || null,
      blood_group: bloodGroup || null, phone: phone || null, notes: notes || null,
    });
  };

  const handleSaveNotes = () => {
    if (!member) return;
    updateMember.mutate({ id: member.id, notes: notes || null });
  };

  const handleUpload = (data: any) => {
    if (!family || !user) return;
    addDocument.mutate({
      file: data.file,
      metadata: {
        family_id: family.id,
        member_id: data.memberId === "none" ? null : (data.memberId || id || null),
        user_id: user.id,
        name: data.name,
        category: data.category,
        expiry_date: data.expiryDate,
        tags: data.tags,
        dismissed_reminder: false,
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

  if (isLoading) return <div className="space-y-4 animate-fade-in"><Skeleton className="h-8 w-48" /><Skeleton className="h-64" /></div>;
  if (!member) return <div className="animate-fade-in"><Button variant="ghost" onClick={() => navigate("/members")}><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button><p className="mt-8 text-center text-muted-foreground">Member not found.</p></div>;

  return (
    <div className="animate-fade-in">
      <Button variant="ghost" className="mb-4 gap-2" onClick={() => navigate("/members")}>
        <ArrowLeft className="h-4 w-4" /> Back to Members
      </Button>
      <h1 className="text-2xl font-bold mb-1">{member.name}</h1>
      {member.relation && <span className="text-sm text-muted-foreground">{member.relation}</span>}

      <Tabs defaultValue="overview" className="mt-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="max-w-lg rounded-lg border bg-card p-6 shadow-sm space-y-4">
            <div><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
            <div><Label>Relation</Label>
              <Select value={relation} onValueChange={setRelation}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{RELATIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Date of Birth</Label><Input type="date" value={dob} onChange={e => setDob(e.target.value)} /></div>
              <div><Label>Blood Group</Label>
                <Select value={bloodGroup} onValueChange={setBloodGroup}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{BLOOD_GROUPS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Phone</Label><Input value={phone} onChange={e => setPhone(e.target.value)} /></div>
            <Button onClick={handleSave} disabled={updateMember.isPending}>
              {updateMember.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save Changes
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <div className="flex justify-end mb-4">
            <Button className="gap-2" onClick={() => setUploadOpen(true)}><Upload className="h-4 w-4" /> Upload Document</Button>
          </div>
          {!memberDocs.length ? (
            <p className="text-center text-muted-foreground py-12">No documents linked to this member yet.</p>
          ) : (
            <div className="space-y-2">
              {memberDocs.map(doc => (
                <div key={doc.id} className="flex items-center justify-between rounded-lg border bg-card p-4">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium text-sm">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">{doc.category}{doc.expiry_date ? ` · Expires ${doc.expiry_date}` : ""}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload(doc)}><Download className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteDoc({ id: doc.id, filePath: doc.file_path })}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <DocumentUploadModal open={uploadOpen} onOpenChange={setUploadOpen} onSubmit={handleUpload} members={members || []} loading={addDocument.isPending} preselectedMemberId={id} />
          <DeleteConfirmDialog open={!!deleteDoc} onOpenChange={v => !v && setDeleteDoc(null)} onConfirm={() => { if (deleteDoc) deleteDocument.mutate(deleteDoc, { onSuccess: () => setDeleteDoc(null) }); }} title="Delete Document?" loading={deleteDocument.isPending} />
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          <div className="max-w-lg rounded-lg border bg-card p-6 shadow-sm space-y-4">
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={8} placeholder="Write notes about this family member..." />
            <Button onClick={handleSaveNotes} disabled={updateMember.isPending}>
              {updateMember.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save Notes
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { useFamily, useUpdateFamily, useAddMember, useAddDocument, useFamilyMembers } from "@/hooks/useFamily";
import { useUpdateSettings } from "@/hooks/useUserSettings";
import { TreePine, Loader2, Check, Upload, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRef } from "react";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const RELATIONS = ["Self", "Spouse", "Father", "Mother", "Son", "Daughter", "Brother", "Sister", "Grandfather", "Grandmother", "Uncle", "Aunt", "Cousin", "Other"];
const CATEGORIES = ["Identity", "Medical", "Insurance", "Property", "Education", "Financial"];

interface Props {
  open: boolean;
  onComplete: () => void;
}

export function OnboardingModal({ open, onComplete }: Props) {
  const { user } = useAuth();
  const { data: family } = useFamily();
  const updateFamily = useUpdateFamily();
  const addMember = useAddMember();
  const updateSettings = useUpdateSettings();
  const { toast } = useToast();
  const addDocument = useAddDocument();
  const { data: members } = useFamilyMembers();

  const [step, setStep] = useState(1);
  const [familyName, setFamilyName] = useState("");
  const [memberName, setMemberName] = useState("");
  const [memberRelation, setMemberRelation] = useState("");
  const [memberDob, setMemberDob] = useState("");
  const [memberBlood, setMemberBlood] = useState("");
  const [addedMembers, setAddedMembers] = useState<string[]>([]);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docCategory, setDocCategory] = useState("Identity");
  const [docName, setDocName] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleStep1 = async () => {
    if (!family || !familyName.trim()) return;
    setLoading(true);
    try {
      await updateFamily.mutateAsync({ id: family.id, name: `The ${familyName.trim()} Family` });
      setStep(2);
    } catch { } finally { setLoading(false); }
  };

  const handleAddMember = async () => {
    if (!family || !user || !memberName.trim()) return;
    setLoading(true);
    try {
      await addMember.mutateAsync({
        family_id: family.id, user_id: user.id, name: memberName, parent_member_id: null,
        relation: memberRelation || null, date_of_birth: memberDob || null,
        blood_group: memberBlood || null, phone: null, notes: null,
      });
      setAddedMembers(prev => [...prev, memberName]);
      setMemberName(""); setMemberRelation(""); setMemberDob(""); setMemberBlood("");
    } catch { } finally { setLoading(false); }
  };

  const handleStep3Upload = async () => {
    if (!family || !user || !docFile) return;
    setLoading(true);
    try {
      await addDocument.mutateAsync({
        file: docFile,
        metadata: {
          family_id: family.id, member_id: null, user_id: user.id,
          name: docName || docFile.name, category: docCategory,
          expiry_date: null, tags: null, dismissed_reminder: false,
        },
      });
      setUploaded(true);
      toast({ title: "Document uploaded! 🎉" });
    } catch { } finally { setLoading(false); }
  };

  const finishOnboarding = async () => {
    if (!user) return;
    await updateSettings.mutateAsync({ id: user.id, onboarding_completed: true });
    onComplete();
  };

  return (
    <Dialog open={open} onOpenChange={() => { }}>
      <DialogContent className="sm:max-w-lg [&>button]:hidden" onPointerDownOutside={e => e.preventDefault()}>
        {/* Header */}
        <div className="text-center mb-2">
          <div className="inline-flex items-center gap-2 mb-3">
            <TreePine className="h-7 w-7 text-primary" />
            <span className="text-xl font-bold">EverNest</span>
          </div>
          <Progress value={(step / 3) * 100} className="h-2 mb-1" />
          <p className="text-xs text-muted-foreground">Step {step} of 3</p>
        </div>

        {/* Step 1: Family Name */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="text-center">
              <h2 className="text-xl font-bold">Name Your Family Workspace</h2>
              <p className="text-sm text-muted-foreground mt-1">This is how your workspace will be identified.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-medium text-muted-foreground whitespace-nowrap">The</span>
              <Input value={familyName} onChange={e => setFamilyName(e.target.value)} placeholder="Sharma" className="text-lg" autoFocus />
              <span className="text-lg font-medium text-muted-foreground whitespace-nowrap">Family</span>
            </div>
            <Button className="w-full" onClick={handleStep1} disabled={loading || !familyName.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Continue
            </Button>
          </div>
        )}

        {/* Step 2: Add Members */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="text-center">
              <h2 className="text-xl font-bold">Add Your First Family Member</h2>
              <p className="text-sm text-muted-foreground mt-1">You can always add more later.</p>
            </div>
            {addedMembers.length > 0 && (
              <div className="space-y-1">
                {addedMembers.map((n, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-success bg-success/10 rounded-md px-3 py-2">
                    <Check className="h-4 w-4" /> {n} added
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-3">
              <div><Label>Name *</Label><Input value={memberName} onChange={e => setMemberName(e.target.value)} placeholder="Full name" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Relation</Label>
                  <Select value={memberRelation} onValueChange={setMemberRelation}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{RELATIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Blood Group</Label>
                  <Select value={memberBlood} onValueChange={setMemberBlood}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{BLOOD_GROUPS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Date of Birth</Label><Input type="date" value={memberDob} onChange={e => setMemberDob(e.target.value)} /></div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 gap-2" onClick={handleAddMember} disabled={loading || !memberName.trim()}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {addedMembers.length > 0 ? "Add Another" : "Add Member"}
              </Button>
              <Button className="flex-1" onClick={() => setStep(3)}>
                {addedMembers.length > 0 ? "Continue" : "Do this later"}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Upload Document */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="text-center">
              <h2 className="text-xl font-bold">Upload Your First Document</h2>
              <p className="text-sm text-muted-foreground mt-1">Start building your secure vault.</p>
            </div>
            {uploaded ? (
              <div className="text-center py-6">
                <div className="inline-flex rounded-full bg-success/10 p-4 mb-3">
                  <Check className="h-8 w-8 text-success" />
                </div>
                <p className="font-semibold text-lg">Document uploaded! 🎉</p>
                <Button className="w-full mt-4" onClick={finishOnboarding}>Go to Dashboard</Button>
              </div>
            ) : (
              <>
                <div
                  className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => fileRef.current?.click()}
                >
                  {docFile ? (
                    <p className="text-sm font-medium">{docFile.name}</p>
                  ) : (
                    <>
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">Click to browse files</p>
                      <p className="text-xs text-muted-foreground mt-1">PDF, JPG, PNG, DOC — Max 10MB</p>
                    </>
                  )}
                  <input ref={fileRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) { setDocFile(f); if (!docName) setDocName(f.name.replace(/\.[^/.]+$/, "")); }
                  }} />
                </div>
                {docFile && (
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Name</Label><Input value={docName} onChange={e => setDocName(e.target.value)} /></div>
                    <div><Label>Category</Label>
                      <Select value={docCategory} onValueChange={setDocCategory}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  {docFile && (
                    <Button className="flex-1" onClick={handleStep3Upload} disabled={loading}>
                      {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Upload
                    </Button>
                  )}
                  <Button variant="ghost" className="flex-1" onClick={finishOnboarding}>Skip for now</Button>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

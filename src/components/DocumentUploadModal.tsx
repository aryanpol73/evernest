import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FamilyMember } from "@/hooks/useFamily";
import { Loader2, Upload, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ACCEPTED_FILE_TYPES, validateDocumentFile } from "@/lib/documentFiles";

const CATEGORIES = ["Identity", "Medical", "Insurance", "Property", "Education", "Financial"];

export interface DocumentFormData {
  file: File;
  name: string;
  category: string;
  memberId: string | null;
  expiryDate: string | null;
  tags: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: DocumentFormData) => void;
  members: FamilyMember[];
  loading?: boolean;
  preselectedMemberId?: string | null;
}

export function DocumentUploadModal({ open, onOpenChange, onSubmit, members, loading, preselectedMemberId }: Props) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Identity");
  const [memberId, setMemberId] = useState(preselectedMemberId || "");
  const [expiryDate, setExpiryDate] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFile = (f: File) => {
    const problem = validateDocumentFile(f);
    if (problem) {
      toast({ title: "File not accepted", description: problem, variant: "destructive" });
      return;
    }
    setFile(f);
    if (!name) setName(f.name.replace(/\.[^/.]+$/, ""));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    onSubmit({
      file,
      name,
      category,
      memberId: memberId || null,
      expiryDate: expiryDate || null,
      tags: tagsInput ? tagsInput.split(",").map(t => t.trim()).filter(Boolean) : [],
    });
  };

  const reset = () => {
    setName(""); setCategory("Identity"); setMemberId(preselectedMemberId || ""); setExpiryDate(""); setTagsInput(""); setFile(null);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Drop zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
          >
            {file ? (
              <div className="flex items-center justify-center gap-2">
                <span className="text-sm font-medium truncate">{file.name}</span>
                <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={e => { e.stopPropagation(); setFile(null); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Drag & drop or click to browse</p>
                <p className="text-xs text-muted-foreground mt-1">PDF, JPG, PNG, DOC, DOCX — Max 10MB</p>
              </>
            )}
            <input ref={inputRef} type="file" className="hidden" accept={ACCEPTED_FILE_TYPES} onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </div>

          <div>
            <Label>Document Name *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Passport — John" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Assign to Member</Label>
              <Select value={memberId} onValueChange={setMemberId}>
                <SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No member</SelectItem>
                  {members.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Expiry Date</Label>
              <Input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} />
            </div>
            <div>
              <Label>Tags</Label>
              <Input value={tagsInput} onChange={e => setTagsInput(e.target.value)} placeholder="tag1, tag2" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !file || !name.trim()}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Upload Document
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

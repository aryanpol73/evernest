import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FamilyMember } from "@/hooks/useFamily";
import { Loader2 } from "lucide-react";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const RELATIONS = ["Self", "Spouse", "Father", "Mother", "Son", "Daughter", "Brother", "Sister", "Grandfather", "Grandmother", "Uncle", "Aunt", "Cousin", "Other"];

export type MemberFormData = Pick<FamilyMember, "name" | "relation" | "date_of_birth" | "blood_group" | "phone" | "notes">;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: MemberFormData) => void;
  member?: FamilyMember | null;
  loading?: boolean;
}

export function MemberFormModal({ open, onOpenChange, onSubmit, member, loading }: Props) {
  const [name, setName] = useState("");
  const [relation, setRelation] = useState("");
  const [dob, setDob] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (member) {
      setName(member.name);
      setRelation(member.relation || "");
      setDob(member.date_of_birth || "");
      setBloodGroup(member.blood_group || "");
      setPhone(member.phone || "");
      setNotes(member.notes || "");
    } else {
      setName(""); setRelation(""); setDob(""); setBloodGroup(""); setPhone(""); setNotes("");
    }
  }, [member, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      relation: relation || null,
      date_of_birth: dob || null,
      blood_group: bloodGroup || null,
      phone: phone || null,
      notes: notes || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{member ? "Edit Member" : "Add Family Member"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Name *</Label>
            <Input id="name" value={name} onChange={e => setName(e.target.value)} required placeholder="Full name" />
          </div>
          <div>
            <Label htmlFor="relation">Relation</Label>
            <Select value={relation} onValueChange={setRelation}>
              <SelectTrigger><SelectValue placeholder="Select relation" /></SelectTrigger>
              <SelectContent>{RELATIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="dob">Date of Birth</Label>
              <Input id="dob" type="date" value={dob} onChange={e => setDob(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="blood">Blood Group</Label>
              <Select value={bloodGroup} onValueChange={setBloodGroup}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{BLOOD_GROUPS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone number" />
          </div>
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional notes..." rows={3} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {member ? "Save Changes" : "Add Member"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

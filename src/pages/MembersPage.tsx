import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Plus, Edit, Trash2, Phone, Droplets, Calendar } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MemberFormModal } from "@/components/MemberFormModal";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { useFamily, useFamilyMembers, useAddMember, useUpdateMember, useDeleteMember, FamilyMember } from "@/hooks/useFamily";
import { useAuth } from "@/contexts/AuthContext";

export default function MembersPage() {
  const { user } = useAuth();
  const { data: family } = useFamily();
  const { data: members, isLoading } = useFamilyMembers();
  const addMember = useAddMember();
  const updateMember = useUpdateMember();
  const deleteMember = useDeleteMember();
  const navigate = useNavigate();

  const [formOpen, setFormOpen] = useState(false);
  const [editMember, setEditMember] = useState<FamilyMember | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FamilyMember | null>(null);

  const handleAdd = (data: any) => {
    if (!family || !user) return;
    addMember.mutate({ ...data, family_id: family.id, user_id: user.id, parent_member_id: null }, {
      onSuccess: () => setFormOpen(false),
    });
  };

  const handleEdit = (data: any) => {
    if (!editMember) return;
    updateMember.mutate({ id: editMember.id, ...data }, {
      onSuccess: () => setEditMember(null),
    });
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMember.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    });
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Family Members"
        subtitle="Manage profiles for everyone in your family."
        actions={<Button className="gap-2" onClick={() => setFormOpen(true)}><Plus className="h-4 w-4" /> Add Member</Button>}
      />

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 rounded-lg" />)}
        </div>
      ) : !members?.length ? (
        <EmptyState
          icon={Users}
          title="No family members yet"
          description="Add your first member to get started."
          ctaLabel="Add First Member"
          onCta={() => setFormOpen(true)}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {members.map(m => (
            <div key={m.id} className="rounded-lg border bg-card p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer group" onClick={() => navigate(`/members/${m.id}`)}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-lg">{m.name}</h3>
                  {m.relation && <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{m.relation}</span>}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={e => { e.stopPropagation(); setEditMember(m); }}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={e => { e.stopPropagation(); setDeleteTarget(m); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5 text-sm text-muted-foreground">
                {m.blood_group && <div className="flex items-center gap-2"><Droplets className="h-3.5 w-3.5" /> {m.blood_group}</div>}
                {m.phone && <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" /> {m.phone}</div>}
                {m.date_of_birth && <div className="flex items-center gap-2"><Calendar className="h-3.5 w-3.5" /> {m.date_of_birth}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      <MemberFormModal open={formOpen} onOpenChange={setFormOpen} onSubmit={handleAdd} loading={addMember.isPending} />
      <MemberFormModal open={!!editMember} onOpenChange={v => !v && setEditMember(null)} onSubmit={handleEdit} member={editMember} loading={updateMember.isPending} />
      <DeleteConfirmDialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)} onConfirm={handleDelete} title="Delete Member?" description={`This will permanently delete ${deleteTarget?.name} and all their linked data.`} loading={deleteMember.isPending} />
    </div>
  );
}

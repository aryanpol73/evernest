import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { TreePine, Plus, Info } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MemberFormModal } from "@/components/MemberFormModal";
import { useFamilyMembers, useFamily, useAddMember } from "@/hooks/useFamily";
import { useAuth } from "@/contexts/AuthContext";

export default function FamilyTreePage() {
  const { user } = useAuth();
  const { data: family } = useFamily();
  const { data: members, isLoading } = useFamilyMembers();
  const addMember = useAddMember();
  const navigate = useNavigate();
  const [formOpen, setFormOpen] = useState(false);

  const handleAdd = (data: any) => {
    if (!family || !user) return;
    addMember.mutate({ ...data, family_id: family.id, user_id: user.id, parent_member_id: null }, { onSuccess: () => setFormOpen(false) });
  };

  const hasRelationships = members?.some(m => m.parent_member_id) || false;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Family Tree"
        subtitle="Visualize your family connections."
        actions={<Button className="gap-2" onClick={() => setFormOpen(true)}><Plus className="h-4 w-4" /> Add Member</Button>}
      />

      {isLoading ? (
        <Skeleton className="h-96 rounded-lg" />
      ) : !members?.length ? (
        <EmptyState
          icon={TreePine}
          title="Your family tree starts here"
          description="Add your first family member to begin building your tree."
          ctaLabel="Add First Member"
          onCta={() => setFormOpen(true)}
        />
      ) : (
        <div>
          {!hasRelationships && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3 mb-6">
              <Info className="h-4 w-4 shrink-0" />
              <span>Connect members by editing their parent relationship in their profile page.</span>
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {members.map(m => (
              <div
                key={m.id}
                className="rounded-lg border bg-card p-4 text-center hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/members/${m.id}`)}
              >
                <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary mx-auto mb-3">
                  {m.name.charAt(0).toUpperCase()}
                </div>
                <p className="font-semibold text-sm truncate">{m.name}</p>
                {m.relation && <p className="text-xs text-muted-foreground">{m.relation}</p>}
                {m.blood_group && <p className="text-xs text-muted-foreground mt-1">{m.blood_group}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      <MemberFormModal open={formOpen} onOpenChange={setFormOpen} onSubmit={handleAdd} loading={addMember.isPending} />
    </div>
  );
}

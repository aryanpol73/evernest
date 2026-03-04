import { Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function MembersPage() {
  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Family Members"
        subtitle="Manage profiles for everyone in your family."
        actions={<Button className="gap-2"><Plus className="h-4 w-4" /> Add Member</Button>}
      />
      <EmptyState
        icon={Users}
        title="No family members yet"
        description="Start by adding your family members to organize their profiles and documents."
        ctaLabel="Add First Member"
        onCta={() => {}}
      />
    </div>
  );
}

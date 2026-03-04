import { TreePine } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default function FamilyTreePage() {
  return (
    <div className="animate-fade-in">
      <PageHeader title="Family Tree" subtitle="Visualize your family connections." />
      <EmptyState
        icon={TreePine}
        title="Your family tree starts here"
        description="Add your first family member to begin building your tree."
        ctaLabel="Add First Member"
        onCta={() => {}}
      />
    </div>
  );
}

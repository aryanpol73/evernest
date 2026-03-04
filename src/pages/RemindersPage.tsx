import { Bell } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default function RemindersPage() {
  return (
    <div className="animate-fade-in">
      <PageHeader title="Reminders" subtitle="Stay on top of important dates and expirations." />
      <EmptyState
        icon={Bell}
        title="No upcoming reminders"
        description="You're all caught up! Reminders will appear here when documents with expiry dates are added. ✅"
      />
    </div>
  );
}

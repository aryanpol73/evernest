import { useNavigate } from "react-router-dom";
import { Bell, Eye, X } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDocuments, useFamilyMembers, useDismissReminder } from "@/hooks/useFamily";
import { differenceInDays } from "date-fns";

export default function RemindersPage() {
  const { data: docs, isLoading } = useDocuments();
  const { data: members } = useFamilyMembers();
  const dismiss = useDismissReminder();
  const navigate = useNavigate();

  const expiringDocs = docs?.filter(d => d.expiry_date && !d.dismissed_reminder && differenceInDays(new Date(d.expiry_date), new Date()) >= 0) || [];
  const urgent = expiringDocs.filter(d => differenceInDays(new Date(d.expiry_date!), new Date()) <= 30);
  const upcoming = expiringDocs.filter(d => { const days = differenceInDays(new Date(d.expiry_date!), new Date()); return days > 30 && days <= 90; });
  const future = expiringDocs.filter(d => differenceInDays(new Date(d.expiry_date!), new Date()) > 90);

  const getMemberName = (id: string | null) => id ? members?.find(m => m.id === id)?.name || "Unknown" : "Unassigned";

  const renderSection = (title: string, items: typeof expiringDocs, colorClass: string) => {
    if (!items.length) return null;
    return (
      <div className="mb-6">
        <h2 className={`font-semibold text-sm mb-3 ${colorClass}`}>{title} ({items.length})</h2>
        <div className="space-y-2">
          {items.map(doc => {
            const days = differenceInDays(new Date(doc.expiry_date!), new Date());
            return (
              <div key={doc.id} className="flex items-center justify-between rounded-lg border bg-card p-4 shadow-sm">
                <div>
                  <p className="font-medium text-sm">{doc.name}</p>
                  <p className="text-xs text-muted-foreground">{getMemberName(doc.member_id)} · Expires {doc.expiry_date}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${days <= 30 ? "bg-destructive/10 text-destructive" : days <= 90 ? "bg-accent/10 text-accent-foreground" : "bg-success/10 text-success"}`}>
                    {days}d left
                  </span>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/documents")}><Eye className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => dismiss.mutate(doc.id)}><X className="h-4 w-4" /></Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="animate-fade-in">
      <PageHeader title="Reminders" subtitle="Stay on top of important dates and expirations." />

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => (
          <div key={i} className="rounded-lg border bg-card p-4 shadow-sm"><Skeleton className="h-5 w-48 mb-2" /><Skeleton className="h-4 w-32" /></div>
        ))}</div>
      ) : !expiringDocs.length ? (
        <EmptyState
          icon={Bell}
          illustration="bell"
          title="You're all caught up!"
          description="No documents expiring soon. Add expiry dates to your documents to get timely reminders."
          ctaLabel="Go to Documents"
          onCta={() => navigate("/documents")}
        />
      ) : (
        <>
          {renderSection("🔴 Urgent — Expiring within 30 days", urgent, "text-destructive")}
          {renderSection("🟠 Upcoming — 31 to 90 days", upcoming, "text-accent-foreground")}
          {renderSection("🟢 Future — More than 90 days", future, "text-success")}
        </>
      )}
    </div>
  );
}

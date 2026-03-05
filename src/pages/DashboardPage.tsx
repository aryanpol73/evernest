import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, FileText, Clock, Bell, Plus, Upload, UserPlus } from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useFamilyMembers, useDocuments, useFamily, useAddMember, useAddDocument } from "@/hooks/useFamily";
import { MemberFormModal } from "@/components/MemberFormModal";
import { DocumentUploadModal } from "@/components/DocumentUploadModal";
import { HealthScoreWidget } from "@/components/HealthScoreWidget";
import { differenceInDays } from "date-fns";

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: family } = useFamily();
  const { data: members, isLoading: membersLoading } = useFamilyMembers();
  const { data: docs, isLoading: docsLoading } = useDocuments();
  const addMember = useAddMember();
  const addDocument = useAddDocument();
  const navigate = useNavigate();

  const [memberOpen, setMemberOpen] = useState(false);
  const [docOpen, setDocOpen] = useState(false);

  const firstName = user?.user_metadata?.full_name?.split(" ")[0] || "there";
  const isLoading = membersLoading || docsLoading;

  const expiringSoon = docs?.filter(d => {
    if (!d.expiry_date) return false;
    const days = differenceInDays(new Date(d.expiry_date), new Date());
    return days >= 0 && days <= 90;
  }) || [];

  const recentDocs = docs?.slice(0, 5) || [];

  const handleAddMember = (data: any) => {
    if (!family || !user) return;
    addMember.mutate({ ...data, family_id: family.id, user_id: user.id, parent_member_id: null }, { onSuccess: () => setMemberOpen(false) });
  };

  const handleUpload = (data: any) => {
    if (!family || !user) return;
    addDocument.mutate({
      file: data.file,
      metadata: {
        family_id: family.id,
        member_id: data.memberId === "none" ? null : data.memberId,
        user_id: user.id, name: data.name, category: data.category,
        expiry_date: data.expiryDate, tags: data.tags, dismissed_reminder: false,
      },
    }, { onSuccess: () => setDocOpen(false) });
  };

  return (
    <div className="animate-fade-in">
      <PageHeader title={`Welcome back, ${firstName}!`} subtitle="Here's your family overview." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {isLoading ? (
          [1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)
        ) : (
          <>
            <StatCard icon={Users} label="Family Members" value={members?.length || 0} />
            <StatCard icon={FileText} label="Documents" value={docs?.length || 0} />
            <StatCard icon={Clock} label="Expiring Soon" value={expiringSoon.length} variant="accent" />
            <StatCard icon={Bell} label="Reminders" value={expiringSoon.length} />
          </>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Actions */}
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <h2 className="font-semibold text-lg mb-4">Quick Actions</h2>
            <div className="grid grid-cols-3 gap-3">
              <Button variant="outline" className="flex flex-col h-auto py-4 gap-2 hover:shadow-md transition-shadow" onClick={() => setMemberOpen(true)}>
                <UserPlus className="h-5 w-5 text-primary" />
                <span className="text-xs">Add Member</span>
              </Button>
              <Button variant="outline" className="flex flex-col h-auto py-4 gap-2 hover:shadow-md transition-shadow" onClick={() => setDocOpen(true)}>
                <Upload className="h-5 w-5 text-primary" />
                <span className="text-xs">Upload Doc</span>
              </Button>
              <Button variant="outline" className="flex flex-col h-auto py-4 gap-2 hover:shadow-md transition-shadow" onClick={() => navigate("/reminders")}>
                <Plus className="h-5 w-5 text-primary" />
                <span className="text-xs">Reminders</span>
              </Button>
            </div>
          </div>

          {/* Recent Documents */}
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <h2 className="font-semibold text-lg mb-4">Recent Documents</h2>
            {isLoading ? (
              <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10 rounded-md" />)}</div>
            ) : !recentDocs.length ? (
              <p className="text-sm text-muted-foreground text-center py-8">No documents yet. Upload your first document to get started.</p>
            ) : (
              <div className="space-y-2">
                {recentDocs.map(d => (
                  <div key={d.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => navigate("/documents")}>
                    <FileText className="h-4 w-4 text-primary" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{d.name}</p>
                      <p className="text-xs text-muted-foreground">{d.category}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Expiring Documents */}
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <h2 className="font-semibold text-lg mb-4">Expiring Documents</h2>
            {!expiringSoon.length ? (
              <p className="text-sm text-muted-foreground text-center py-8">No expiring documents. You're all set! ✅</p>
            ) : (
              <div className="space-y-2">
                {expiringSoon.slice(0, 5).map(d => {
                  const days = differenceInDays(new Date(d.expiry_date!), new Date());
                  return (
                    <div key={d.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{d.name}</p>
                        <p className="text-xs text-muted-foreground">{d.expiry_date}</p>
                      </div>
                      <span className={`text-xs font-medium px-2 py-1 rounded-full shrink-0 ${days <= 30 ? "bg-destructive/10 text-destructive" : "bg-accent/10 text-accent-foreground"}`}>
                        {days}d left
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Health Score */}
          <HealthScoreWidget />

          {/* Family Members */}
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <h2 className="font-semibold text-lg mb-4">Family Members</h2>
            {isLoading ? (
              <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-10 rounded-md" />)}</div>
            ) : !members?.length ? (
              <p className="text-sm text-muted-foreground text-center py-8">No members yet. Add your first family member.</p>
            ) : (
              <div className="space-y-2">
                {members.slice(0, 5).map(m => (
                  <div key={m.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => navigate(`/members/${m.id}`)}>
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{m.name}</p>
                      {m.relation && <p className="text-xs text-muted-foreground">{m.relation}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <MemberFormModal open={memberOpen} onOpenChange={setMemberOpen} onSubmit={handleAddMember} loading={addMember.isPending} />
      <DocumentUploadModal open={docOpen} onOpenChange={setDocOpen} onSubmit={handleUpload} members={members || []} loading={addDocument.isPending} />
    </div>
  );
}

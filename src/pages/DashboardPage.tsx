import { Users, FileText, Clock, Bell, Plus, Upload, UserPlus } from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

export default function DashboardPage() {
  const { user } = useAuth();
  const firstName = user?.user_metadata?.full_name?.split(" ")[0] || "there";

  return (
    <div className="animate-fade-in">
      <PageHeader title={`Welcome back, ${firstName}!`} subtitle="Here's your family overview." />

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Users} label="Family Members" value={0} />
        <StatCard icon={FileText} label="Documents" value={0} />
        <StatCard icon={Clock} label="Expiring Soon" value={0} variant="accent" />
        <StatCard icon={Bell} label="Reminders" value={0} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <h2 className="font-semibold text-lg mb-4">Quick Actions</h2>
            <div className="grid grid-cols-3 gap-3">
              <Button variant="outline" className="flex flex-col h-auto py-4 gap-2">
                <UserPlus className="h-5 w-5 text-primary" />
                <span className="text-xs">Add Member</span>
              </Button>
              <Button variant="outline" className="flex flex-col h-auto py-4 gap-2">
                <Upload className="h-5 w-5 text-primary" />
                <span className="text-xs">Upload Doc</span>
              </Button>
              <Button variant="outline" className="flex flex-col h-auto py-4 gap-2">
                <Plus className="h-5 w-5 text-primary" />
                <span className="text-xs">Add Reminder</span>
              </Button>
            </div>
          </div>

          {/* Recent Documents */}
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <h2 className="font-semibold text-lg mb-4">Recent Documents</h2>
            <p className="text-sm text-muted-foreground text-center py-8">No documents yet. Upload your first document to get started.</p>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Expiring Documents */}
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <h2 className="font-semibold text-lg mb-4">Expiring Documents</h2>
            <p className="text-sm text-muted-foreground text-center py-8">No expiring documents. You're all set! ✅</p>
          </div>

          {/* Family Members */}
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <h2 className="font-semibold text-lg mb-4">Family Members</h2>
            <p className="text-sm text-muted-foreground text-center py-8">No members yet. Add your first family member.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

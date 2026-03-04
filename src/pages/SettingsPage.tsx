import { PageHeader } from "@/components/ui/page-header";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  const { user } = useAuth();

  const tabs = ["Profile", "Workspace", "Notifications", "Security", "Billing"];

  return (
    <div className="animate-fade-in">
      <PageHeader title="Settings" subtitle="Manage your account and workspace." />

      <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
        {tabs.map((tab, i) => (
          <button
            key={tab}
            className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
              i === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="max-w-lg rounded-lg border bg-card p-6 shadow-sm space-y-4">
        <div>
          <Label>Full Name</Label>
          <Input defaultValue={user?.user_metadata?.full_name || ""} />
        </div>
        <div>
          <Label>Email</Label>
          <Input defaultValue={user?.email || ""} disabled />
        </div>
        <Button>Save Changes</Button>
      </div>
    </div>
  );
}

import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useFamily, useUpdateFamily } from "@/hooks/useFamily";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { Switch } from "@/components/ui/switch";

export default function SettingsPage() {
  const { user } = useAuth();
  const { data: family, isLoading } = useFamily();
  const updateFamily = useUpdateFamily();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();

  const [activeTab, setActiveTab] = useState("Profile");
  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || "");
  const [familyName, setFamilyName] = useState("");
  const [familyInitialized, setFamilyInitialized] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  if (family && !familyInitialized) {
    setFamilyName(family.name);
    setFamilyInitialized(true);
  }

  const tabs = ["Profile", "Workspace", "Security", "Appearance"];

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ data: { full_name: fullName } });
      if (error) throw error;
      toast({ title: "Profile updated", description: "Your name has been saved." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFamily = () => {
    if (!family) return;
    updateFamily.mutate({ id: family.id, name: familyName });
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({ title: "Error", description: "Passwords do not match.", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Error", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword("");
      setConfirmPassword("");
      toast({ title: "Password updated", description: "Your password has been changed." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader title="Settings" subtitle="Manage your account and workspace." />

      <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Skeleton className="h-48 max-w-lg rounded-lg" />
      ) : (
        <>
          {activeTab === "Profile" && (
            <div className="max-w-lg rounded-lg border bg-card p-6 shadow-sm space-y-4">
              <div><Label>Full Name</Label><Input value={fullName} onChange={e => setFullName(e.target.value)} /></div>
              <div><Label>Email</Label><Input value={user?.email || ""} disabled /></div>
              <Button onClick={handleSaveProfile} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Save Changes
              </Button>
            </div>
          )}

          {activeTab === "Workspace" && (
            <div className="max-w-lg rounded-lg border bg-card p-6 shadow-sm space-y-4">
              <div><Label>Family Workspace Name</Label><Input value={familyName} onChange={e => setFamilyName(e.target.value)} /></div>
              <Button onClick={handleSaveFamily} disabled={updateFamily.isPending}>
                {updateFamily.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Save Changes
              </Button>
            </div>
          )}

          {activeTab === "Security" && (
            <div className="max-w-lg rounded-lg border bg-card p-6 shadow-sm space-y-4">
              <h3 className="font-semibold">Change Password</h3>
              <div><Label>New Password</Label><Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" /></div>
              <div><Label>Confirm Password</Label><Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" /></div>
              <Button onClick={handleChangePassword} disabled={saving || !newPassword}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Update Password
              </Button>
            </div>
          )}

          {activeTab === "Appearance" && (
            <div className="max-w-lg rounded-lg border bg-card p-6 shadow-sm space-y-4">
              <h3 className="font-semibold">Theme</h3>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {theme === "dark" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                  <span className="text-sm">{theme === "dark" ? "Dark Mode" : "Light Mode"}</span>
                </div>
                <Switch checked={theme === "dark"} onCheckedChange={v => setTheme(v ? "dark" : "light")} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

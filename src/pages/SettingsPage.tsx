import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useFamily, useUpdateFamily } from "@/hooks/useFamily";
import { useQueryClient } from "@tanstack/react-query";
import { usePinStatus, setPin, removePin, type PinResult } from "@/hooks/useUserSettings";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sun, Moon, Shield, Lock } from "lucide-react";
import { useTheme } from "next-themes";
import { Switch } from "@/components/ui/switch";

export default function SettingsPage() {
  const { user } = useAuth();
  const { data: family, isLoading } = useFamily();
  const { data: pinStatus } = usePinStatus();
  const hasPin = !!pinStatus?.has_pin;
  const updateFamily = useUpdateFamily();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();

  const [activeTab, setActiveTab] = useState("Profile");
  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || "");
  const [familyName, setFamilyName] = useState("");
  const [familyInitialized, setFamilyInitialized] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

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
    } finally { setSaving(false); }
  };

  const handleSaveFamily = () => {
    if (!family) return;
    updateFamily.mutate({ id: family.id, name: familyName });
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) { toast({ title: "Error", description: "Passwords do not match.", variant: "destructive" }); return; }
    if (newPassword.length < 6) { toast({ title: "Error", description: "Password must be at least 6 characters.", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword(""); setConfirmPassword("");
      toast({ title: "Password updated", description: "Your password has been changed." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const showPinFailure = (result: PinResult) => {
    setCurrentPin("");
    const description = result.locked_until
      ? "Too many attempts. Try again in 30 minutes."
      : `Wrong current PIN. ${result.attempts_remaining} attempts left.`;
    toast({ title: "PIN not changed", description, variant: "destructive" });
  };

  const handleSetPin = async () => {
    if (newPin.length !== 6 || !/^\d{6}$/.test(newPin)) { toast({ title: "Error", description: "PIN must be exactly 6 digits.", variant: "destructive" }); return; }
    if (newPin !== confirmPin) { toast({ title: "Error", description: "PINs do not match.", variant: "destructive" }); return; }
    if (hasPin && currentPin.length !== 6) { toast({ title: "Error", description: "Enter your current PIN.", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const result = await setPin(newPin, hasPin ? currentPin : undefined);
      if (!result.ok) { showPinFailure(result); return; }
      setCurrentPin(""); setNewPin(""); setConfirmPin("");
      await qc.invalidateQueries({ queryKey: ["pin_status"] });
      toast({ title: "PIN updated", description: "Your app PIN has been changed." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleRemovePin = async () => {
    if (currentPin.length !== 6) { toast({ title: "Error", description: "Enter your current PIN.", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const result = await removePin(currentPin);
      if (!result.ok) { showPinFailure(result); return; }
      setCurrentPin("");
      await qc.invalidateQueries({ queryKey: ["pin_status"] });
      toast({ title: "PIN removed", description: "App PIN lock has been disabled." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader title="Settings" subtitle="Manage your account and workspace." />

      <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
        {tabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${activeTab === tab ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
          >{tab}</button>
        ))}
      </div>

      {isLoading ? <Skeleton className="h-48 max-w-lg rounded-lg" /> : (
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
            <div className="max-w-lg space-y-6">
              <div className="rounded-lg border bg-card p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2"><Lock className="h-5 w-5 text-primary" /><h3 className="font-semibold">Change Password</h3></div>
                <div><Label>New Password</Label><Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" /></div>
                <div><Label>Confirm Password</Label><Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" /></div>
                <Button onClick={handleChangePassword} disabled={saving || !newPassword}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Update Password
                </Button>
              </div>

              <div className="rounded-lg border bg-card p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2"><Shield className="h-5 w-5 text-primary" /><h3 className="font-semibold">App PIN Lock</h3></div>
                <p className="text-sm text-muted-foreground">
                  {hasPin ? "Your app is protected with a PIN. You can change or remove it below." : "Set a 6-digit PIN to lock your app after inactivity."}
                </p>
                {hasPin && <div><Label>Current PIN</Label><Input type="password" maxLength={6} value={currentPin} onChange={e => setCurrentPin(e.target.value.replace(/\D/g, ""))} placeholder="••••••" /></div>}
                <div><Label>New PIN (6 digits)</Label><Input type="password" maxLength={6} value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, ""))} placeholder="••••••" /></div>
                <div><Label>Confirm PIN</Label><Input type="password" maxLength={6} value={confirmPin} onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ""))} placeholder="••••••" /></div>
                <div className="flex gap-2">
                  <Button onClick={handleSetPin} disabled={saving || newPin.length !== 6}>
                    {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} {hasPin ? "Change PIN" : "Set PIN"}
                  </Button>
                  {hasPin && (
                    <Button variant="outline" onClick={handleRemovePin} disabled={saving}>Remove PIN</Button>
                  )}
                </div>
              </div>
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

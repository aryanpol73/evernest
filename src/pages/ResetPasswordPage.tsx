import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MfaChallenge } from "@/components/MfaChallenge";
import { useAuth } from "@/contexts/AuthContext";
import { useMfaGate } from "@/hooks/useMfa";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { MIN_PASSWORD_LENGTH, validateNewPassword } from "@/lib/passwordPolicy";

export default function ResetPasswordPage() {
  const { session, user, loading, recovering, clearRecovery } = useAuth();
  const gate = useMfaGate();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    const problem = validateNewPassword(password, user?.email);
    if (problem) { setError(problem); return; }

    setSaving(true);
    setError("");
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      // Whoever prompted this reset may have had a session open elsewhere.
      await supabase.auth.signOut({ scope: "others" });
      clearRecovery();
      toast({ title: "Password updated", description: "You're signed in with your new password." });
      navigate("/dashboard", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn't update your password. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading || (session && gate.isLoading)) {
    return <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">Loading...</div>;
  }

  if (!recovering || !session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background p-4 text-center">
        <h1 className="text-xl font-bold">This reset link isn't valid</h1>
        <p className="text-sm text-muted-foreground">It may have expired or already been used.</p>
        <Button asChild><Link to="/auth">Back to Sign In</Link></Button>
      </div>
    );
  }

  if (gate.data?.needsCode) return <MfaChallenge />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-lg border bg-card p-6 shadow-sm space-y-4">
        <h1 className="text-xl font-bold">Choose a new password</h1>
        <div>
          <Label htmlFor="new-password">New password</Label>
          <Input id="new-password" type="password" autoComplete="new-password" required minLength={MIN_PASSWORD_LENGTH} value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="confirm-password">Confirm password</Label>
          <Input id="confirm-password" type="password" autoComplete="new-password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={saving}>{saving ? "Saving..." : "Update Password"}</Button>
      </form>
    </div>
  );
}

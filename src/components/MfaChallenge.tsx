import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { redeemRecoveryCode, verifyTotpCode } from "@/hooks/useMfa";
import { useToast } from "@/hooks/use-toast";

export function MfaChallenge() {
  const { signOut } = useAuth();
  const { toast } = useToast();
  const [recovering, setRecovering] = useState(false);
  const [code, setCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const switchMode = (next: boolean) => {
    setRecovering(next);
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      // On success the session changes, and the gate above this component clears.
      await verifyTotpCode(code);
    } catch {
      setCode("");
      setError("That code didn't work. Check your authenticator app and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await redeemRecoveryCode(recoveryCode);
      if (result.ok) {
        toast({ title: "Two-step verification is off", description: "Set it up again in Settings to keep your family's documents protected." });
      } else if (result.locked_until) {
        setError("Too many attempts. Try again in 30 minutes.");
      } else {
        setError("That recovery code didn't work.");
      }
    } catch {
      setError("For your security, sign out and sign in with your password again, then use your recovery code.");
    } finally {
      setRecoveryCode("");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <form onSubmit={recovering ? handleRecover : handleSubmit} className="w-full max-w-sm rounded-lg border bg-card p-6 shadow-sm space-y-4">
        <div className="text-center space-y-2">
          <ShieldCheck className="h-8 w-8 text-primary mx-auto" />
          <h1 className="text-xl font-bold">{recovering ? "Use a recovery code" : "Enter your security code"}</h1>
          <p className="text-sm text-muted-foreground">
            {recovering
              ? "Enter one of the codes you saved. This turns off two-step verification, so you'll need to set it up again."
              : "Open your authenticator app and enter the 6-digit code for EverNest."}
          </p>
        </div>

        {recovering ? (
          <div>
            <Label htmlFor="mfa-recovery-code">Recovery code</Label>
            <Input id="mfa-recovery-code" autoComplete="off" autoFocus className="font-mono" value={recoveryCode} onChange={e => setRecoveryCode(e.target.value)} />
          </div>
        ) : (
          <div>
            <Label htmlFor="mfa-code">Security code</Label>
            <Input
              id="mfa-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={6}
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ""))}
            />
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" className="w-full" disabled={loading || (recovering ? !recoveryCode.trim() : code.length !== 6)}>
          {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} {recovering ? "Use Recovery Code" : "Verify"}
        </Button>
        <Button type="button" variant="ghost" className="w-full" onClick={() => switchMode(!recovering)}>
          {recovering ? "Use my authenticator app" : "Lost your device?"}
        </Button>
        <Button type="button" variant="ghost" className="w-full" onClick={() => signOut()}>Sign out</Button>
      </form>
    </div>
  );
}

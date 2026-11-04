import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { verifyTotpCode } from "@/hooks/useMfa";

export function MfaChallenge() {
  const { signOut } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-lg border bg-card p-6 shadow-sm space-y-4">
        <div className="text-center space-y-2">
          <ShieldCheck className="h-8 w-8 text-primary mx-auto" />
          <h1 className="text-xl font-bold">Enter your security code</h1>
          <p className="text-sm text-muted-foreground">Open your authenticator app and enter the 6-digit code for EverNest.</p>
        </div>
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
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading || code.length !== 6}>
          {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Verify
        </Button>
        <Button type="button" variant="ghost" className="w-full" onClick={() => signOut()}>Sign out</Button>
      </form>
    </div>
  );
}

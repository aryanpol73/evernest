import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { confirmTotpEnrollment, removeTotpFactor, startTotpEnrollment, useTotpFactors, type TotpEnrollment } from "@/hooks/useMfa";
import { verifyCurrentPassword } from "@/lib/reauth";

export function MfaSettings() {
  const { user } = useAuth();
  const { data: factors, isLoading, isError } = useTotpFactors();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const factor = factors?.[0];

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Something went wrong.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleStart = () => run(async () => setEnrollment(await startTotpEnrollment()));

  const handleConfirm = () => run(async () => {
    if (!enrollment) return;
    try {
      await confirmTotpEnrollment(enrollment.factorId, code);
    } finally {
      setCode("");
    }
    setEnrollment(null);
    await qc.invalidateQueries({ queryKey: ["mfa_factors"] });
    toast({ title: "Two-step verification on", description: "You'll need a code from your app each time you sign in." });
  });

  const handleRemove = () => run(async () => {
    if (!factor || !user?.email) return;
    const confirmed = await verifyCurrentPassword(user.email, password);
    setPassword("");
    if (!confirmed) throw new Error("That password is incorrect.");
    await removeTotpFactor(factor.id);
    await qc.invalidateQueries({ queryKey: ["mfa_factors"] });
    toast({ title: "Two-step verification off", description: "Your account now relies on your password alone." });
  });

  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm space-y-4">
      <div className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" /><h3 className="font-semibold">Two-Step Verification</h3></div>

      {isLoading && <Skeleton className="h-10" />}
      {isError && <p className="text-sm text-destructive">We couldn't load your two-step verification settings.</p>}

      {factors && factor && (
        <>
          <p className="text-sm text-muted-foreground">On. You enter a code from your authenticator app when you sign in.</p>
          <div>
            <Label htmlFor="mfa-remove-password">Account password</Label>
            <Input id="mfa-remove-password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <Button variant="outline" onClick={handleRemove} disabled={busy || !password}>Turn Off</Button>
        </>
      )}

      {factors && !factor && !enrollment && (
        <>
          <p className="text-sm text-muted-foreground">Add a code from an authenticator app, so a stolen password alone can't open your family's documents.</p>
          <Button onClick={handleStart} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Set Up
          </Button>
        </>
      )}

      {enrollment && (
        <>
          <p className="text-sm text-muted-foreground">Scan this code with your authenticator app, then enter the 6-digit code it shows.</p>
          <img src={enrollment.qrCode} alt="QR code for your authenticator app" className="h-44 w-44 rounded border bg-white p-2" />
          <div>
            <Label htmlFor="mfa-secret">Can't scan? Enter this key instead</Label>
            <Input id="mfa-secret" readOnly value={enrollment.secret} className="font-mono text-xs" />
          </div>
          <div>
            <Label htmlFor="mfa-enroll-code">6-digit code</Label>
            <Input id="mfa-enroll-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))} />
          </div>
          <p className="text-sm text-muted-foreground">If you lose this device, you'll need to contact support to get back in. Save the key above somewhere safe.</p>
          <div className="flex gap-2">
            <Button onClick={handleConfirm} disabled={busy || code.length !== 6}>
              {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Turn On
            </Button>
            <Button variant="outline" onClick={() => { setEnrollment(null); setCode(""); }} disabled={busy}>Cancel</Button>
          </div>
        </>
      )}
    </div>
  );
}

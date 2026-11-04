import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useTotpFactors } from "@/hooks/useMfa";
import { useToast } from "@/hooks/use-toast";
import { deleteAccount, deleteAccountWithCurrentSession } from "@/lib/accountDeletion";
import { confirmWithGoogle, hasRecentSignIn, usesPassword } from "@/lib/freshSignIn";
import { buildDataExport, saveDataExport } from "@/lib/dataExport";

const CONFIRMATION_WORD = "DELETE";

export function YourDataSettings() {
  const { session, user } = useAuth();
  const { data: factors } = useTotpFactors();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [confirmation, setConfirmation] = useState("");

  const needsMfaCode = !!factors?.length;
  const hasPassword = usesPassword(user);
  const canDelete = hasPassword
    ? !deleting && !!password && confirmation === CONFIRMATION_WORD && (!needsMfaCode || mfaCode.length === 6)
    : !deleting && hasRecentSignIn(session) && confirmation === CONFIRMATION_WORD;

  const handleConfirmWithGoogle = async () => {
    try {
      await confirmWithGoogle("/settings?tab=Your%20Data");
    } catch (e) {
      toast({ title: "Couldn't confirm it's you", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    }
  };

  const handleExport = async () => {
    if (!user) return;
    setExporting(true);
    try {
      saveDataExport(await buildDataExport({ id: user.id, email: user.email }));
      toast({ title: "Export ready", description: "Your data has been downloaded." });
    } catch (e) {
      toast({ title: "Export failed", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email || !canDelete) return;
    setDeleting(true);
    try {
      if (hasPassword) await deleteAccount({ email: user.email, password, mfaCode: mfaCode || undefined });
      else await deleteAccountWithCurrentSession();
      toast({ title: "Account deleted", description: "Your account and documents have been removed." });
      navigate("/", { replace: true });
    } catch (e) {
      setPassword("");
      setMfaCode("");
      toast({ title: "Account not deleted", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-lg space-y-6">
      <div className="rounded-lg border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2"><Download className="h-5 w-5 text-primary" /><h3 className="font-semibold">Download Your Data</h3></div>
        <p className="text-sm text-muted-foreground">Get one file with the records, activity history, and documents of the family you own. Large vaults can take a few minutes.</p>
        <p className="text-sm text-muted-foreground">The download contains sensitive documents and is not encrypted, so keep it somewhere safe.</p>
        <Button onClick={handleExport} disabled={exporting}>
          {exporting && <Loader2 className="h-4 w-4 animate-spin mr-2" />} {exporting ? "Preparing..." : "Download My Data"}
        </Button>
      </div>

      <form onSubmit={handleDelete} className="rounded-lg border border-destructive/30 bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2"><Trash2 className="h-5 w-5 text-destructive" /><h3 className="font-semibold">Delete Your Account</h3></div>
        <p className="text-sm text-muted-foreground">This permanently deletes your account, family records, activity history, and every document. It can't be undone, so download your data first.</p>
        <p className="text-sm text-muted-foreground">Everyone you've invited loses access to your family. Anything you added to a family you were invited to stays with that family.</p>
        {hasPassword ? (
          <div>
            <Label htmlFor="delete-password">Account password</Label>
            <Input id="delete-password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
        ) : !hasRecentSignIn(session) && (
          <Button type="button" variant="outline" onClick={handleConfirmWithGoogle}>Confirm It's You With Google</Button>
        )}
        {hasPassword && needsMfaCode && (
          <div>
            <Label htmlFor="delete-code">Security code</Label>
            <Input id="delete-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={mfaCode} onChange={e => setMfaCode(e.target.value.replace(/\D/g, ""))} />
          </div>
        )}
        <div>
          <Label htmlFor="delete-confirm">Type {CONFIRMATION_WORD} to confirm</Label>
          <Input id="delete-confirm" autoComplete="off" value={confirmation} onChange={e => setConfirmation(e.target.value)} />
        </div>
        <Button type="submit" variant="destructive" disabled={!canDelete}>
          {deleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Delete My Account
        </Button>
      </form>
    </div>
  );
}

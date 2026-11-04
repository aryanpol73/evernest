import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useActiveFamily } from "@/contexts/ActiveFamilyContext";
import { useAuth } from "@/contexts/AuthContext";
import { acceptInvite, previewInvite } from "@/hooks/useFamilyAccess";
import { ROLE_LABELS } from "@/lib/familyRoles";
import { clearPendingInvite, readPendingInvite, savePendingInvite, tokenFromFragment } from "@/lib/pendingInvite";

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-lg border bg-card p-6 shadow-sm space-y-4 text-center">{children}</div>
    </div>
  );
}

function AcceptInvite({ token }: { token: string }) {
  const { user, signOut } = useAuth();
  const { setActiveFamilyId } = useActiveFamily();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [accepting, setAccepting] = useState(false);
  const [failed, setFailed] = useState(false);

  const { data: preview, isLoading, isError } = useQuery({
    queryKey: ["invite_preview", user?.id],
    queryFn: () => previewInvite(token),
    retry: false,
  });

  const leave = (path: string) => {
    clearPendingInvite();
    navigate(path, { replace: true });
  };

  const handleAccept = async () => {
    setAccepting(true);
    try {
      const familyId = await acceptInvite(token);
      await qc.invalidateQueries({ queryKey: ["families"] });
      setActiveFamilyId(familyId);
      leave("/dashboard");
    } catch {
      setFailed(true);
      setAccepting(false);
    }
  };

  if (isLoading) return <Screen><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></Screen>;

  if (isError || failed || !preview) {
    return (
      <Screen>
        <h1 className="text-xl font-bold">This invite can't be used</h1>
        <p className="text-sm text-muted-foreground">
          You're signed in as {user?.email}. It may have expired or been revoked, or it may be for a different email address.
        </p>
        <Button className="w-full" onClick={() => leave("/dashboard")}>Go to My Family</Button>
        <Button variant="ghost" className="w-full" onClick={() => signOut()}>Sign In With Another Account</Button>
      </Screen>
    );
  }

  return (
    <Screen>
      <Users className="h-8 w-8 text-primary mx-auto" />
      <h1 className="text-xl font-bold">Join {preview.family_name}?</h1>
      <p className="text-sm text-muted-foreground">
        You've been invited as {preview.role === "editor" ? "an" : "a"} {ROLE_LABELS[preview.role]}.
        The family owner will be able to see when you view or download documents.
      </p>
      <Button className="w-full" onClick={handleAccept} disabled={accepting}>
        {accepting && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Accept Invite
      </Button>
      <Button variant="ghost" className="w-full" onClick={() => leave("/dashboard")} disabled={accepting}>Not Now</Button>
    </Screen>
  );
}

export default function InvitePage() {
  // Runs before the first render, so the token leaves the address bar immediately.
  const [token] = useState(() => {
    const fromLink = tokenFromFragment(window.location.hash);
    if (fromLink) {
      savePendingInvite(fromLink);
      window.history.replaceState(null, "", window.location.pathname);
    }
    return fromLink ?? readPendingInvite();
  });

  if (!token) {
    return (
      <Screen>
        <h1 className="text-xl font-bold">This invite link isn't complete</h1>
        <p className="text-sm text-muted-foreground">Open the full link you were sent, or ask for a new one.</p>
        <Button asChild className="w-full"><Link to="/">Go to EverNest</Link></Button>
      </Screen>
    );
  }

  return <ProtectedRoute><AcceptInvite token={token} /></ProtectedRoute>;
}

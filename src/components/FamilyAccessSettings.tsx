import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Copy, Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useFamily } from "@/hooks/useFamily";
import { createInvite, removeAccess, revokeInvite, setMemberRole, useFamilyAccess, usePendingInvites, type InvitableRole } from "@/hooks/useFamilyAccess";
import { useToast } from "@/hooks/use-toast";
import { ROLE_LABELS } from "@/lib/familyRoles";
import { inviteLink } from "@/lib/pendingInvite";
import { errorMessage } from "@/lib/utils";

const ROLE_HELP: Record<InvitableRole, string> = {
  editor: "Can add, change, and delete members and documents.",
  viewer: "Can see and download everything, but can't change anything.",
};

export function FamilyAccessSettings() {
  const { user } = useAuth();
  const { data: family } = useFamily();
  const isOwner = family?.role === "owner";
  const { data: people, isLoading, isError } = useFamilyAccess(family?.id);
  const { data: invites } = usePendingInvites(family?.id, isOwner);
  const { toast } = useToast();
  const qc = useQueryClient();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InvitableRole>("viewer");
  const [created, setCreated] = useState<{ email: string; link: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["family_access"] }),
        qc.invalidateQueries({ queryKey: ["family_invites"] }),
      ]);
    } catch (e) {
      toast({ title: "Error", description: errorMessage(e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!family) return;
    run(async () => {
      const token = await createInvite(family.id, email, role);
      setCreated({ email, link: inviteLink(token) });
      setEmail("");
    });
  };

  const handleCopy = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.link);
      toast({ title: "Link copied" });
    } catch {
      toast({ title: "Couldn't copy", description: "Select the link and copy it yourself.", variant: "destructive" });
    }
  };

  const handleLeave = () => {
    if (!family || !user) return;
    run(async () => {
      await removeAccess(family.id, user.id);
      await qc.invalidateQueries({ queryKey: ["families"] });
      toast({ title: "You left this family" });
    });
  };

  if (!family) return <Skeleton className="h-48 max-w-2xl rounded-lg" />;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="rounded-lg border bg-card p-6 shadow-sm space-y-4">
        <div>
          <h3 className="font-semibold">Who Has Access</h3>
          <p className="text-sm text-muted-foreground">People with access to {family.name}.</p>
        </div>

        {isLoading && <Skeleton className="h-16" />}
        {isError && <p className="text-sm text-destructive">We couldn't load this list.</p>}

        <ul className="divide-y">
          {people?.map(person => (
            <li key={person.user_id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{person.full_name || person.email}</p>
                {person.full_name && <p className="text-xs text-muted-foreground truncate">{person.email}</p>}
              </div>
              {isOwner && person.role !== "owner" ? (
                <div className="flex items-center gap-2 shrink-0">
                  <Select
                    value={person.role}
                    disabled={busy}
                    onValueChange={value => run(() => setMemberRole(family.id, person.user_id, value as InvitableRole))}
                  >
                    <SelectTrigger className="h-8 w-28 text-xs" aria-label={`Role for ${person.email}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="editor">Editor</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="sm" className="text-destructive" disabled={busy} onClick={() => run(() => removeAccess(family.id, person.user_id))}>Remove</Button>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground shrink-0">{ROLE_LABELS[person.role as keyof typeof ROLE_LABELS]}</span>
              )}
            </li>
          ))}
        </ul>

        {!isOwner && <Button variant="outline" onClick={handleLeave} disabled={busy}>Leave This Family</Button>}
      </div>

      {isOwner && (
        <form onSubmit={handleInvite} className="rounded-lg border bg-card p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2"><UserPlus className="h-5 w-5 text-primary" /><h3 className="font-semibold">Invite Someone</h3></div>
          <p className="text-sm text-muted-foreground">Create a link and send it to them yourself. It lasts 7 days and only works for this email address.</p>
          <div>
            <Label htmlFor="invite-email">Their email</Label>
            <Input id="invite-email" type="email" required value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="invite-role">Access</Label>
            <Select value={role} onValueChange={value => setRole(value as InvitableRole)}>
              <SelectTrigger id="invite-role"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">Viewer</SelectItem>
                <SelectItem value="editor">Editor</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">{ROLE_HELP[role]}</p>
          </div>
          <Button type="submit" disabled={busy || !email}>
            {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Create Invite Link
          </Button>

          {created && (
            <div className="rounded-md border bg-muted/50 p-3 space-y-2">
              <p className="text-sm font-medium">Invite link for {created.email}</p>
              <Input readOnly aria-label="Invite link" value={created.link} className="font-mono text-xs" />
              <Button type="button" variant="outline" size="sm" className="gap-2" onClick={handleCopy}><Copy className="h-4 w-4" /> Copy Link</Button>
              <p className="text-xs text-muted-foreground">You won't see this link again. If you lose it, create a new invite.</p>
            </div>
          )}
        </form>
      )}

      {isOwner && !!invites?.length && (
        <div className="rounded-lg border bg-card p-6 shadow-sm space-y-3">
          <h3 className="font-semibold">Pending Invites</h3>
          <ul className="divide-y">
            {invites.map(invite => (
              <li key={invite.id} className="flex items-center justify-between gap-3 py-2">
                <span className="text-sm min-w-0 truncate">{invite.email} <span className="text-muted-foreground">· {ROLE_LABELS[invite.role as keyof typeof ROLE_LABELS]}</span></span>
                <Button variant="ghost" size="sm" className="text-destructive shrink-0" disabled={busy} onClick={() => run(() => revokeInvite(invite.id))}>Revoke</Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

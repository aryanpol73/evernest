import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { FamilyRole } from "@/hooks/useFamily";

export type InvitableRole = Exclude<FamilyRole, "owner">;

export interface InvitePreview {
  family_name: string;
  role: InvitableRole;
}

export function useFamilyAccess(familyId: string | undefined) {
  return useQuery({
    queryKey: ["family_access", familyId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_family_access", { _family_id: familyId! });
      if (error) throw error;
      return data;
    },
    enabled: !!familyId,
  });
}

export function usePendingInvites(familyId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["family_invites", familyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("family_invites")
        .select("id, email, role, expires_at")
        .eq("family_id", familyId!)
        .is("accepted_at", null)
        .is("revoked_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!familyId && enabled,
  });
}

export async function createInvite(familyId: string, email: string, role: InvitableRole): Promise<string> {
  const { data, error } = await supabase.rpc("create_family_invite", { _family_id: familyId, _email: email, _role: role });
  if (error) throw error;
  return data;
}

export async function revokeInvite(inviteId: string): Promise<void> {
  const { error } = await supabase.rpc("revoke_family_invite", { _invite_id: inviteId });
  if (error) throw error;
}

export async function setMemberRole(familyId: string, userId: string, role: InvitableRole): Promise<void> {
  const { error } = await supabase.rpc("set_family_role", { _family_id: familyId, _user_id: userId, _role: role });
  if (error) throw error;
}

export async function removeAccess(familyId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc("remove_family_access", { _family_id: familyId, _user_id: userId });
  if (error) throw error;
}

export async function previewInvite(token: string): Promise<InvitePreview> {
  const { data, error } = await supabase.rpc("preview_family_invite", { _token: token });
  if (error) throw error;
  return data as unknown as InvitePreview;
}

export async function acceptInvite(token: string): Promise<string> {
  const { data, error } = await supabase.rpc("accept_family_invite", { _token: token });
  if (error) throw error;
  return data;
}

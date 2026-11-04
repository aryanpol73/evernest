import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveFamily } from "@/contexts/ActiveFamilyContext";
import { useToast } from "@/hooks/use-toast";
import { buildStoragePath, documentTypeFor, validateDocumentFile } from "@/lib/documentFiles";

export type FamilyRole = "owner" | "editor" | "viewer";

export interface Family {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
  role: FamilyRole;
}

export interface FamilyMember {
  id: string;
  family_id: string;
  user_id: string | null;
  name: string;
  relation: string | null;
  date_of_birth: string | null;
  blood_group: string | null;
  phone: string | null;
  notes: string | null;
  parent_member_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  family_id: string;
  member_id: string | null;
  user_id: string | null;
  name: string;
  category: string;
  file_path: string;
  file_size: number | null;
  file_type: string | null;
  expiry_date: string | null;
  tags: string[] | null;
  dismissed_reminder: boolean;
  created_at: string;
  updated_at: string;
}

export function useFamilies() {
  const { user } = useAuth();
  return useQuery<Family[]>({
    queryKey: ["families", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("family_memberships")
        .select("role, families(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data.flatMap(m => (m.families ? [{ ...m.families, role: m.role as FamilyRole }] : []));
    },
    enabled: !!user,
  });
}

// The family being shown. A remembered family the user has left falls back to their own.
export function useFamily() {
  const families = useFamilies();
  const { activeFamilyId } = useActiveFamily();
  const list = families.data ?? [];
  const family = list.find(f => f.id === activeFamilyId) ?? list.find(f => f.role === "owner") ?? list[0] ?? null;
  return { ...families, data: family };
}

// The family a user owns, whichever one they are viewing.
export function useOwnFamily() {
  const families = useFamilies();
  return { ...families, data: families.data?.find(f => f.role === "owner") ?? null };
}

// Decides what to show. RLS is what actually enforces the role.
export function useCanEdit(): boolean {
  const { data: family } = useFamily();
  return family?.role === "owner" || family?.role === "editor";
}

export function useUpdateFamily() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from("families").update({ name, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["families"] });
      toast({ title: "Family updated", description: "Workspace name saved." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

export function useFamilyMembers() {
  const { data: family } = useFamily();
  return useQuery<FamilyMember[]>({
    queryKey: ["family_members", family?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("family_members")
        .select("*")
        .eq("family_id", family!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as FamilyMember[];
    },
    enabled: !!family,
  });
}

export function useAddMember() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (member: Omit<FamilyMember, "id" | "created_at" | "updated_at" | "user_id"> & { user_id: string }) => {
      const { error } = await supabase.from("family_members").insert(member);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["family_members"] });
      toast({ title: "Member added", description: "Family member has been added successfully." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

export function useUpdateMember() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Omit<FamilyMember, "user_id">> & { id: string }) => {
      const { error } = await supabase.from("family_members").update({ ...data, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["family_members"] });
      toast({ title: "Member updated", description: "Changes saved successfully." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

export function useDeleteMember() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("family_members").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["family_members"] });
      qc.invalidateQueries({ queryKey: ["documents"] });
      toast({ title: "Member deleted", description: "Family member has been removed." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

export function useDocuments() {
  const { data: family } = useFamily();
  return useQuery<Document[]>({
    queryKey: ["documents", family?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("family_id", family!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Document[];
    },
    enabled: !!family,
  });
}

export function useAddDocument() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ file, metadata }: { file: File; metadata: Omit<Document, "id" | "created_at" | "updated_at" | "file_path" | "file_size" | "file_type" | "user_id"> & { user_id: string } }) => {
      const problem = validateDocumentFile(file);
      if (problem) throw new Error(problem);
      const fileType = documentTypeFor(file.name);
      const filePath = buildStoragePath(metadata.family_id, metadata.member_id, file.name);
      const bucket = supabase.storage.from("family-documents");
      const { error: uploadError } = await bucket.upload(filePath, file, { contentType: fileType ?? undefined });
      if (uploadError) throw uploadError;
      const { error } = await supabase.from("documents").insert({
        ...metadata,
        file_path: filePath,
        file_size: file.size,
        file_type: fileType,
      });
      if (error) {
        // Leave no file behind that no document row points to.
        await bucket.remove([filePath]);
        throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents"] });
      toast({ title: "Document uploaded", description: "Document has been saved to your vault." });
    },
    onError: (e: Error) => toast({ title: "Upload failed", description: e.message, variant: "destructive" }),
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, filePath }: { id: string; filePath: string }) => {
      const { error: storageError } = await supabase.storage.from("family-documents").remove([filePath]);
      if (storageError) throw storageError;
      const { error } = await supabase.from("documents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents"] });
      toast({ title: "Document deleted", description: "Document has been removed." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

export function useDismissReminder() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("documents").update({ dismissed_reminder: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents"] });
      toast({ title: "Reminder dismissed" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface Family {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface FamilyMember {
  id: string;
  family_id: string;
  user_id: string;
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
  user_id: string;
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

export function useFamily() {
  const { user } = useAuth();
  return useQuery<Family | null>({
    queryKey: ["family", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("families")
        .select("*")
        .eq("owner_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data as Family | null;
    },
    enabled: !!user,
  });
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
      qc.invalidateQueries({ queryKey: ["family"] });
      toast({ title: "Family updated", description: "Workspace name saved." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

export function useFamilyMembers() {
  const { user } = useAuth();
  return useQuery<FamilyMember[]>({
    queryKey: ["family_members", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("family_members")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as FamilyMember[];
    },
    enabled: !!user,
  });
}

export function useAddMember() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (member: Omit<FamilyMember, "id" | "created_at" | "updated_at">) => {
      const { error } = await supabase.from("family_members").insert(member);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["family_members"] });
      toast({ title: "Member added", description: "Family member has been added successfully." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

export function useUpdateMember() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<FamilyMember> & { id: string }) => {
      const { error } = await supabase.from("family_members").update({ ...data, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["family_members"] });
      toast({ title: "Member updated", description: "Changes saved successfully." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
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
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

export function useDocuments() {
  const { user } = useAuth();
  return useQuery<Document[]>({
    queryKey: ["documents", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Document[];
    },
    enabled: !!user,
  });
}

export function useAddDocument() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ file, metadata }: { file: File; metadata: Omit<Document, "id" | "created_at" | "updated_at" | "file_path" | "file_size" | "file_type"> }) => {
      const filePath = `${metadata.family_id}/${metadata.member_id || "general"}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from("family-documents").upload(filePath, file);
      if (uploadError) throw uploadError;
      const { error } = await supabase.from("documents").insert({
        ...metadata,
        file_path: filePath,
        file_size: file.size,
        file_type: file.type,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents"] });
      toast({ title: "Document uploaded", description: "Document has been saved to your vault." });
    },
    onError: (e: any) => toast({ title: "Upload failed", description: e.message, variant: "destructive" }),
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
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
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
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

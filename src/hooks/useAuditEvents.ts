import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFamily } from "@/hooks/useFamily";

const RECENT_EVENT_LIMIT = 50;

export function useAuditEvents() {
  const { data: family } = useFamily();
  return useQuery({
    queryKey: ["audit_events", family?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_events")
        .select("id, action, target_name, created_at")
        .eq("family_id", family!.id)
        .order("created_at", { ascending: false })
        .limit(RECENT_EVENT_LIMIT);
      if (error) throw error;
      return data;
    },
    enabled: !!family,
    staleTime: 0,
  });
}

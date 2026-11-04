import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const RECENT_EVENT_LIMIT = 50;

export function useAuditEvents() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["audit_events", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_events")
        .select("id, action, target_name, created_at")
        .order("created_at", { ascending: false })
        .limit(RECENT_EVENT_LIMIT);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    staleTime: 0,
  });
}

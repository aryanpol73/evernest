import type { FamilyRole } from "@/hooks/useFamily";

export const ROLE_LABELS: Record<FamilyRole, string> = {
  owner: "Owner",
  editor: "Editor",
  viewer: "Viewer",
};

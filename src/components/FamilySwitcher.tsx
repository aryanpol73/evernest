import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useActiveFamily } from "@/contexts/ActiveFamilyContext";
import { useFamilies, useFamily } from "@/hooks/useFamily";
import { ROLE_LABELS } from "@/lib/familyRoles";

export function FamilySwitcher() {
  const { data: families } = useFamilies();
  const { data: family } = useFamily();
  const { setActiveFamilyId } = useActiveFamily();

  if (!family || !families || families.length < 2) return null;

  return (
    <Select value={family.id} onValueChange={setActiveFamilyId}>
      <SelectTrigger className="h-8 max-w-[220px] text-xs" aria-label="Switch family">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {families.map(f => (
          <SelectItem key={f.id} value={f.id}>{f.name} · {ROLE_LABELS[f.role]}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

import { useNavigate } from "react-router-dom";
import { useFamilyMembers, useDocuments } from "@/hooks/useFamily";
import { differenceInDays } from "date-fns";

interface Suggestion {
  text: string;
  path: string;
}

export function HealthScoreWidget() {
  const { data: members } = useFamilyMembers();
  const { data: docs } = useDocuments();
  const navigate = useNavigate();

  const m = members || [];
  const d = docs || [];

  // Calculate score
  let score = 0;
  let maxScore = 0;
  const suggestions: Suggestion[] = [];

  // Blood groups: +5 each
  const withBlood = m.filter(x => x.blood_group);
  const missingBlood = m.length - withBlood.length;
  score += withBlood.length * 5;
  maxScore += m.length * 5;
  if (missingBlood > 0) suggestions.push({ text: `Add blood group for ${missingBlood} member${missingBlood > 1 ? "s" : ""}`, path: "/members" });

  // Phone: +3 each
  const withPhone = m.filter(x => x.phone);
  const missingPhone = m.length - withPhone.length;
  score += withPhone.length * 3;
  maxScore += m.length * 3;
  if (missingPhone > 0) suggestions.push({ text: `Add phone for ${missingPhone} member${missingPhone > 1 ? "s" : ""}`, path: "/members" });

  // At least one doc per member: +10 each
  m.forEach(member => {
    const hasDocs = d.some(doc => doc.member_id === member.id);
    if (hasDocs) score += 10;
    else suggestions.push({ text: `Upload a document for ${member.name}`, path: "/documents" });
    maxScore += 10;
  });

  // No docs expiring within 30 days: +10
  maxScore += 10;
  const expiringSoon = d.filter(doc => doc.expiry_date && differenceInDays(new Date(doc.expiry_date), new Date()) <= 30 && differenceInDays(new Date(doc.expiry_date), new Date()) >= 0);
  if (expiringSoon.length === 0) score += 10;
  else {
    expiringSoon.slice(0, 2).forEach(doc => {
      const days = differenceInDays(new Date(doc.expiry_date!), new Date());
      suggestions.push({ text: `${doc.name} expires in ${days} days`, path: "/reminders" });
    });
  }

  // Emergency contacts: +10
  maxScore += 10;
  if (withPhone.length > 0) score += 10;

  const finalScore = maxScore > 0 ? Math.round((score / maxScore) * 100) : (m.length === 0 ? 0 : 100);
  const color = finalScore >= 70 ? "hsl(var(--success))" : finalScore >= 40 ? "hsl(var(--accent))" : "hsl(var(--destructive))";

  const circumference = 2 * Math.PI * 52;
  const offset = circumference - (finalScore / 100) * circumference;

  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <div className="flex flex-col items-center">
        {/* SVG ring */}
        <div className="relative w-32 h-32 mb-4">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="52" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
            <circle cx="60" cy="60" r="52" fill="none" stroke={color} strokeWidth="8" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-1000" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-3xl font-bold">{finalScore}</span>
          </div>
        </div>
        <h3 className="font-semibold text-sm mb-3">Family Health Score</h3>

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="w-full space-y-2">
            {suggestions.slice(0, 3).map((s, i) => (
              <button key={i} onClick={() => navigate(s.path)} className="w-full text-left text-xs p-2.5 rounded-md bg-muted/50 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                💡 {s.text}
              </button>
            ))}
          </div>
        )}
        {suggestions.length === 0 && m.length > 0 && (
          <p className="text-xs text-success text-center">Great job! Your family info is complete. ✅</p>
        )}
        {m.length === 0 && (
          <button onClick={() => navigate("/members")} className="text-xs text-primary hover:underline">Add your first member to get started</button>
        )}
      </div>
    </div>
  );
}

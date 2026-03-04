import { LucideIcon } from "lucide-react";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  trend?: string;
  variant?: "default" | "accent" | "destructive";
}

export function StatCard({ icon: Icon, label, value, trend, variant = "default" }: StatCardProps) {
  const iconColors = {
    default: "bg-primary/10 text-primary",
    accent: "bg-accent/20 text-accent-foreground",
    destructive: "bg-destructive/10 text-destructive",
  };

  return (
    <div className="rounded-lg border bg-card p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-4">
        <div className={`rounded-lg p-2.5 ${iconColors[variant]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
          {trend && <p className="text-xs text-muted-foreground mt-0.5">{trend}</p>}
        </div>
      </div>
    </div>
  );
}

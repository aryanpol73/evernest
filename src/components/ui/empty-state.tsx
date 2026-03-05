import { LucideIcon } from "lucide-react";
import { Button } from "./button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  ctaLabel?: string;
  onCta?: () => void;
  illustration?: "people" | "folder" | "bell";
}

const illustrations: Record<string, JSX.Element> = {
  people: (
    <svg width="120" height="100" viewBox="0 0 120 100" fill="none" className="mb-2">
      <circle cx="40" cy="30" r="14" fill="hsl(var(--primary) / 0.15)" />
      <circle cx="40" cy="30" r="8" fill="hsl(var(--primary) / 0.3)" />
      <path d="M20 75 C20 55 60 55 60 75" fill="hsl(var(--primary) / 0.15)" />
      <circle cx="80" cy="35" r="12" fill="hsl(var(--accent) / 0.15)" />
      <circle cx="80" cy="35" r="7" fill="hsl(var(--accent) / 0.3)" />
      <path d="M62 80 C62 62 98 62 98 80" fill="hsl(var(--accent) / 0.15)" />
    </svg>
  ),
  folder: (
    <svg width="120" height="100" viewBox="0 0 120 100" fill="none" className="mb-2">
      <rect x="15" y="30" width="90" height="60" rx="8" fill="hsl(var(--primary) / 0.1)" stroke="hsl(var(--primary) / 0.3)" strokeWidth="2" />
      <path d="M15 38 L15 30 C15 25.58 18.58 22 23 22 H45 L55 30 H97 C101.42 30 105 33.58 105 38" fill="hsl(var(--primary) / 0.15)" stroke="hsl(var(--primary) / 0.3)" strokeWidth="2" />
      <rect x="40" y="50" width="40" height="4" rx="2" fill="hsl(var(--primary) / 0.2)" />
      <rect x="45" y="60" width="30" height="4" rx="2" fill="hsl(var(--primary) / 0.15)" />
    </svg>
  ),
  bell: (
    <svg width="120" height="100" viewBox="0 0 120 100" fill="none" className="mb-2">
      <path d="M60 15 C40 15 30 30 30 50 V65 H90 V50 C90 30 80 15 60 15Z" fill="hsl(var(--success) / 0.15)" stroke="hsl(var(--success) / 0.3)" strokeWidth="2" />
      <rect x="25" y="65" width="70" height="6" rx="3" fill="hsl(var(--success) / 0.2)" />
      <circle cx="60" cy="80" r="6" fill="hsl(var(--success) / 0.25)" />
      <path d="M52 13 L60 5 L68 13" stroke="hsl(var(--success) / 0.3)" strokeWidth="2" fill="none" />
    </svg>
  ),
};

export function EmptyState({ icon: Icon, title, description, ctaLabel, onCta, illustration }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {illustration && illustrations[illustration] ? (
        illustrations[illustration]
      ) : (
        <div className="rounded-full bg-muted p-4 mb-4">
          <Icon className="h-8 w-8 text-muted-foreground" />
        </div>
      )}
      <h3 className="text-lg font-semibold mb-1">{title}</h3>
      <p className="text-muted-foreground text-sm max-w-sm mb-6">{description}</p>
      {ctaLabel && onCta && (
        <Button size="lg" onClick={onCta}>{ctaLabel}</Button>
      )}
    </div>
  );
}

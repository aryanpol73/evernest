import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useMfaGate } from "@/hooks/useMfa";
import { MfaChallenge } from "@/components/MfaChallenge";
import { Button } from "@/components/ui/button";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const gate = useMfaGate();

  if (loading || (user && gate.isLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  if (gate.isError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <p className="text-muted-foreground">We couldn't check your sign-in status.</p>
        <Button onClick={() => gate.refetch()}>Try Again</Button>
      </div>
    );
  }

  if (gate.data?.needsCode) return <MfaChallenge />;

  return <>{children}</>;
}

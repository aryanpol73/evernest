import { useState, useCallback, useEffect } from "react";
import { TreePine, Delete, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { usePinStatus, verifyPin, resetPinWithPassword } from "@/hooks/useUserSettings";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  onUnlock: () => void;
}

export function PinLockScreen({ onUnlock }: Props) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [password, setPassword] = useState("");
  const { data: status } = usePinStatus();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const lockExpiry = lockedUntil ?? status?.locked_until;
  const isLocked = !!lockExpiry && new Date(lockExpiry) > new Date();

  const handleDigit = useCallback((digit: string) => {
    if (pin.length >= 6 || isLocked) return;
    const newPin = pin + digit;
    setPin(newPin);
    setError("");

    if (newPin.length === 6) {
      verifyPinCode(newPin);
    }
  }, [pin, isLocked]);

  const verifyPinCode = async (code: string) => {
    setLoading(true);
    try {
      const result = await verifyPin(code);
      if (result.ok) {
        onUnlock();
        return;
      }
      setPin("");
      if (result.locked_until) {
        setLockedUntil(result.locked_until);
        setError("Too many attempts. Try again in 30 minutes.");
        toast({ title: "Account Locked", description: "Too many wrong PIN attempts.", variant: "destructive" });
      } else {
        setError(`Wrong PIN. ${result.attempts_remaining} attempts left.`);
      }
    } catch {
      setPin("");
      setError("We couldn't check your PIN. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) return;
    setLoading(true);
    setError("");
    try {
      await resetPinWithPassword(user.email, password);
      await qc.invalidateQueries({ queryKey: ["pin_status"] });
      toast({ title: "PIN removed", description: "You can set a new PIN in Settings." });
      onUnlock();
    } catch {
      setError("We couldn't verify that password. Please try again.");
    } finally {
      setPassword("");
      setLoading(false);
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
    setError("");
  };

  // Keyboard support
  useEffect(() => {
    if (resetting) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") handleDigit(e.key);
      else if (e.key === "Backspace") handleDelete();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleDigit, resetting]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center" style={{ background: "#1A1A2E" }}>
      {/* Logo */}
      <div className="flex items-center gap-2 mb-6">
        <TreePine className="h-10 w-10 text-primary" />
        <span className="text-2xl font-bold text-white">EverNest</span>
      </div>
      <p className="text-sm text-white/50 mb-8">Your family's documents are protected</p>

      {/* PIN dots */}
      <div className="flex gap-3 mb-6">
        {[0, 1, 2, 3, 4, 5].map(i => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full border-2 transition-all ${
              i < pin.length ? "bg-primary border-primary scale-110" : "border-white/30"
            }`}
          />
        ))}
      </div>

      {/* Status */}
      {loading && <Loader2 className="h-5 w-5 text-primary animate-spin mb-4" />}
      {error && <p className="text-sm text-red-400 mb-4 text-center px-8">{error}</p>}
      {isLocked && <p className="text-sm text-red-400 mb-4">Account is temporarily locked.</p>}

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-3 max-w-[260px]">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"].map((key, i) => {
          if (key === "") return <div key={i} />;
          if (key === "del") {
            return (
              <button key={i} onClick={handleDelete} className="h-16 w-20 rounded-xl flex items-center justify-center text-white/60 hover:bg-white/10 transition-colors active:scale-95">
                <Delete className="h-6 w-6" />
              </button>
            );
          }
          return (
            <button
              key={i}
              onClick={() => handleDigit(key)}
              disabled={!!isLocked}
              className="h-16 w-20 rounded-xl bg-white/10 text-white text-2xl font-semibold hover:bg-white/20 transition-all active:scale-95 disabled:opacity-30"
            >
              {key}
            </button>
          );
        })}
      </div>

      {/* Forgot PIN */}
      {resetting ? (
        <form onSubmit={handleResetPin} className="mt-6 flex w-full max-w-[260px] flex-col gap-2">
          <p className="text-center text-sm text-white/60">Enter your account password to remove your PIN.</p>
          <Input type="password" autoComplete="current-password" autoFocus required aria-label="Account password" value={password} onChange={e => setPassword(e.target.value)} />
          <Button type="submit" disabled={loading || !password}>Remove PIN</Button>
          <button type="button" className="text-sm text-white/40 hover:text-white/60 transition-colors" onClick={() => { setResetting(false); setPassword(""); setError(""); }}>
            Back to PIN
          </button>
        </form>
      ) : (
        <button className="mt-8 text-sm text-white/40 hover:text-white/60 transition-colors" onClick={() => { setResetting(true); setError(""); }}>
          Forgot PIN?
        </button>
      )}
    </div>
  );
}

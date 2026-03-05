import { useState, useCallback, useEffect } from "react";
import { TreePine, Delete, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserSettings, verifyPin, useUpdateSettings } from "@/hooks/useUserSettings";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Props {
  onUnlock: () => void;
}

export function PinLockScreen({ onUnlock }: Props) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { data: settings } = useUserSettings();
  const updateSettings = useUpdateSettings();
  const { user } = useAuth();
  const { toast } = useToast();

  const MAX_ATTEMPTS = 5;
  const isLocked = settings && settings.pin_locked_until && new Date(settings.pin_locked_until) > new Date();

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
    if (!settings?.pin_hash || !settings.pin_salt || !user) return;
    setLoading(true);
    try {
      const valid = await verifyPin(code, settings.pin_hash, settings.pin_salt);
      if (valid) {
        await updateSettings.mutateAsync({ id: user.id, pin_attempts: 0 });
        onUnlock();
      } else {
        const attempts = (settings.pin_attempts || 0) + 1;
        if (attempts >= MAX_ATTEMPTS) {
          const lockedUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString();
          await updateSettings.mutateAsync({ id: user.id, pin_attempts: attempts, pin_locked_until: lockedUntil });
          setError("Too many attempts. Try again in 30 minutes.");
          toast({ title: "Account Locked", description: "Too many wrong PIN attempts.", variant: "destructive" });
        } else {
          await updateSettings.mutateAsync({ id: user.id, pin_attempts: attempts });
          setError(`Wrong PIN. ${MAX_ATTEMPTS - attempts} attempts left.`);
        }
        setPin("");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
    setError("");
  };

  // Keyboard support
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") handleDigit(e.key);
      else if (e.key === "Backspace") handleDelete();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleDigit]);

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
      <button
        className="mt-8 text-sm text-white/40 hover:text-white/60 transition-colors"
        onClick={async () => {
          if (!user?.email) return;
          await supabase.auth.resetPasswordForEmail(user.email, { redirectTo: window.location.origin + "/reset-password" });
          toast({ title: "Reset link sent", description: "Check your email to reset your PIN." });
        }}
      >
        Forgot PIN?
      </button>
    </div>
  );
}

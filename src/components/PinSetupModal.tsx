import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TreePine, Shield, Loader2, Check, Delete } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { setPin as savePinOnServer } from "@/hooks/useUserSettings";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

export function PinSetupModal({ open, onComplete, onSkip }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [stage, setStage] = useState<"prompt" | "enter" | "confirm" | "done">("prompt");
  const [pin, setPin] = useState("");
  const [firstPin, setFirstPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleDigit = (d: string) => {
    if (pin.length >= 6) return;
    const newPin = pin + d;
    setPin(newPin);
    setError("");

    if (newPin.length === 6) {
      if (stage === "enter") {
        setFirstPin(newPin);
        setPin("");
        setStage("confirm");
      } else if (stage === "confirm") {
        if (newPin === firstPin) {
          savePin(newPin);
        } else {
          setError("PINs don't match. Try again.");
          setPin("");
          setFirstPin("");
          setStage("enter");
        }
      }
    }
  };

  const savePin = async (pinCode: string) => {
    setLoading(true);
    try {
      await savePinOnServer(pinCode);
      await qc.invalidateQueries({ queryKey: ["pin_status"] });
      setStage("done");
      toast({ title: "PIN set! 🔒", description: "EverNest will ask for it on this device." });
    } catch {
      setError("Failed to set PIN. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const Keypad = () => (
    <div className="grid grid-cols-3 gap-2 max-w-[220px] mx-auto mt-4">
      {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"].map((key, i) => {
        if (key === "") return <div key={i} />;
        if (key === "del") return (
          <button key={i} onClick={() => { setPin(p => p.slice(0, -1)); setError(""); }} className="h-14 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors">
            <Delete className="h-5 w-5" />
          </button>
        );
        return (
          <button key={i} onClick={() => handleDigit(key)} className="h-14 rounded-lg bg-muted text-lg font-semibold hover:bg-muted/80 transition-all active:scale-95">
            {key}
          </button>
        );
      })}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={() => { }}>
      <DialogContent className="sm:max-w-sm [&>button]:hidden" onPointerDownOutside={e => e.preventDefault()}>
        {stage === "prompt" && (
          <div className="text-center space-y-4 py-4">
            <div className="inline-flex rounded-full bg-primary/10 p-4">
              <Shield className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-xl font-bold">Lock EverNest With a PIN</h2>
            <p className="text-sm text-muted-foreground">A PIN stops someone using EverNest on your device when you step away.</p>
            <Button className="w-full" onClick={() => setStage("enter")}>Set PIN Now</Button>
            <Button variant="ghost" className="w-full" onClick={onSkip}>Maybe Later</Button>
          </div>
        )}

        {(stage === "enter" || stage === "confirm") && (
          <div className="text-center space-y-3 py-2">
            <h2 className="text-lg font-bold">{stage === "enter" ? "Enter a 6-digit PIN" : "Confirm Your PIN"}</h2>
            <p className="text-sm text-muted-foreground">{stage === "enter" ? "Choose a PIN you'll remember" : "Enter the same PIN again"}</p>
            <div className="flex gap-2.5 justify-center my-4">
              {[0, 1, 2, 3, 4, 5].map(i => (
                <div key={i} className={`w-3.5 h-3.5 rounded-full border-2 transition-all ${i < pin.length ? "bg-primary border-primary" : "border-border"}`} />
              ))}
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {loading ? <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /> : <Keypad />}
          </div>
        )}

        {stage === "done" && (
          <div className="text-center space-y-4 py-6">
            <div className="inline-flex rounded-full bg-success/10 p-4">
              <Check className="h-10 w-10 text-success" />
            </div>
            <h2 className="text-xl font-bold">Your PIN Is Set 🔒</h2>
            <p className="text-sm text-muted-foreground">Your PIN will be required after periods of inactivity.</p>
            <Button className="w-full" onClick={onComplete}>Continue to Dashboard</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TreePine } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { errorMessage } from "@/lib/utils";
import { readPendingInvite } from "@/lib/pendingInvite";
import { MIN_PASSWORD_LENGTH, validateNewPassword } from "@/lib/passwordPolicy";

export default function AuthPage() {
  const [searchParams] = useSearchParams();
  const [isSignUp, setIsSignUp] = useState(searchParams.get("mode") === "signup");
  const [isForgot, setIsForgot] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // The reply is the same either way, so this can't reveal who has an account.
  const handleForgotPassword = async () => {
    setLoading(true);
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    setLoading(false);
    setIsForgot(false);
    toast({ title: "Check your email", description: "If that address has an account, we've sent a reset link." });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isForgot) {
      await handleForgotPassword();
      return;
    }
    if (isSignUp) {
      const problem = validateNewPassword(password, email);
      if (problem) {
        toast({ title: "Choose a stronger password", description: problem, variant: "destructive" });
        return;
      }
    }
    setLoading(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName }, emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast({ title: "Account created!", description: "Check your email to confirm your account." });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate(readPendingInvite() ? "/invite" : "/dashboard");
      }
    } catch (err) {
      toast({ title: "Error", description: errorMessage(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <TreePine className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold">EverNest</span>
          </div>
          <h1 className="text-2xl font-bold">{isForgot ? "Reset your password" : isSignUp ? "Create your account" : "Welcome back"}</h1>
          <p className="text-muted-foreground mt-1">{isForgot ? "We'll email you a reset link" : isSignUp ? "Start organizing your family's life" : "Sign in to your family workspace"}</p>
        </div>

        {readPendingInvite() && (
          <p className="mb-4 rounded-md border bg-muted/50 p-3 text-sm text-muted-foreground">
            You've been invited to a family. Use the email address the invite was sent to. If you create an account, confirm your email, then open your invite link again.
          </p>
        )}

        <form onSubmit={handleSubmit} className="rounded-lg border bg-card p-6 shadow-sm space-y-4">
          {isSignUp && !isForgot && (
            <div>
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" required />
            </div>
          )}
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
          </div>
          {!isForgot && (
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete={isSignUp ? "new-password" : "current-password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={isSignUp ? MIN_PASSWORD_LENGTH : undefined}
              />
              {isSignUp && <p className="text-xs text-muted-foreground mt-1">At least {MIN_PASSWORD_LENGTH} characters, with letters and numbers.</p>}
            </div>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Loading..." : isForgot ? "Send Reset Link" : isSignUp ? "Create Account" : "Sign In"}
          </Button>
          {!isSignUp && (
            <button type="button" onClick={() => setIsForgot(!isForgot)} className="block w-full text-center text-sm text-primary hover:underline">
              {isForgot ? "Back to sign in" : "Forgot password?"}
            </button>
          )}
        </form>

        <p className="text-center text-sm text-muted-foreground mt-4">
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
          <button onClick={() => { setIsSignUp(!isSignUp); setIsForgot(false); }} className="text-primary font-medium hover:underline">
            {isSignUp ? "Sign in" : "Sign up"}
          </button>
        </p>
      </div>
    </div>
  );
}

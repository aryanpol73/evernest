import { useState, useEffect, useRef } from "react";
import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bell, TreePine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BottomNav } from "@/components/BottomNav";
import { OnboardingModal } from "@/components/OnboardingModal";
import { PinSetupModal } from "@/components/PinSetupModal";
import { PinLockScreen } from "@/components/PinLockScreen";
import { FamilySwitcher } from "@/components/FamilySwitcher";
import { isFilePickerOpen, watchFilePickers } from "@/lib/filePickerLock";
import { usePinStatus, useUserSettings } from "@/hooks/useUserSettings";
import { useFamily } from "@/hooks/useFamily";
import { Skeleton } from "@/components/ui/skeleton";

const INACTIVITY_TIMEOUT = 3 * 60 * 1000; // 3 minutes

export default function AppLayout() {
  const { user } = useAuth();
  const { data: settings, isLoading: settingsLoading } = useUserSettings();
  const { data: pinStatus, isLoading: pinLoading, isError: pinError, refetch: refetchPinStatus } = usePinStatus();
  const { data: family, isLoading: familyLoading } = useFamily();
  const hasPin = !!pinStatus?.has_pin;
  const initials = user?.user_metadata?.full_name?.split(" ").map((n: string) => n[0]).join("").toUpperCase() || "U";

  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [pinLocked, setPinLocked] = useState(false);
  const [welcomeBanner, setWelcomeBanner] = useState(false);
  const [flowDone, setFlowDone] = useState(false);
  const initialLockChecked = useRef(false);

  // Determine if onboarding/PIN setup needed
  useEffect(() => {
    if (settingsLoading || pinLoading || !settings) return;
    if (!settings.onboarding_completed) {
      setShowOnboarding(true);
    } else if (hasPin && !initialLockChecked.current) {
      // Lock on initial load only, so setting a PIN mid-session doesn't lock the user out.
      setPinLocked(true);
    }
    initialLockChecked.current = true;
    setFlowDone(true);
  }, [settings, settingsLoading, pinLoading, hasPin]);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    setShowPinSetup(true);
    setWelcomeBanner(true);
  };

  const handlePinSetupComplete = () => {
    setShowPinSetup(false);
  };

  const handlePinSkip = () => {
    setShowPinSetup(false);
  };

  // Inactivity timer for PIN lock
  useEffect(() => {
    if (!hasPin || !flowDone) return;
    let timer: ReturnType<typeof setTimeout>;

    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (isFilePickerOpen()) resetTimer();
        else setPinLocked(true);
      }, INACTIVITY_TIMEOUT);
    };

    const events = ["mousedown", "keydown", "touchstart", "scroll"];
    events.forEach(e => document.addEventListener(e, resetTimer));
    resetTimer();

    // Lock on visibility change
    const handleVisibility = () => {
      if (document.hidden && !isFilePickerOpen()) setPinLocked(true);
    };
    document.addEventListener("visibilitychange", handleVisibility);
    const stopWatchingPickers = watchFilePickers();

    return () => {
      stopWatchingPickers();
      clearTimeout(timer);
      events.forEach(e => document.removeEventListener(e, resetTimer));
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [hasPin, flowDone]);

  // Show loading while settings are loading
  if (settingsLoading || familyLoading || pinLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-3">
          <TreePine className="h-8 w-8 text-primary animate-pulse" />
          <span className="text-lg font-semibold text-muted-foreground">Loading...</span>
        </div>
      </div>
    );
  }

  // Without a PIN status the lock can't be evaluated, so keep the app closed.
  if (pinError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <p className="text-muted-foreground">We couldn't check your security settings.</p>
        <Button onClick={() => refetchPinStatus()}>Try Again</Button>
      </div>
    );
  }

  // PIN lock screen
  if (pinLocked && hasPin) {
    return <PinLockScreen onUnlock={() => setPinLocked(false)} />;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b bg-card flex items-center justify-between px-4 sticky top-0 z-30">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <div className="flex items-center gap-2 md:hidden">
                <TreePine className="h-5 w-5 text-primary" />
                <span className="font-bold text-sm">EverNest</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {family?.role === "viewer" && <span className="text-xs text-muted-foreground">View only</span>}
              <FamilySwitcher />
              <ThemeToggle />
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-4 w-4" />
              </Button>
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">{initials}</AvatarFallback>
              </Avatar>
            </div>
          </header>

          {/* Welcome banner */}
          {welcomeBanner && (
            <div className="bg-primary/10 border-b border-primary/20 px-4 py-3 flex items-center justify-between">
              <p className="text-sm font-medium text-primary">🎉 Welcome to EverNest! Your family workspace is ready.</p>
              <button onClick={() => setWelcomeBanner(false)} className="text-xs text-primary/60 hover:text-primary">Dismiss</button>
            </div>
          )}

          <main className="flex-1 p-4 md:p-6 overflow-auto pb-24 lg:pb-6">
            <Outlet />
          </main>
        </div>
      </div>
      <BottomNav />

      {/* Onboarding */}
      <OnboardingModal open={showOnboarding} onComplete={handleOnboardingComplete} />
      {/* PIN Setup */}
      <PinSetupModal open={showPinSetup} onComplete={handlePinSetupComplete} onSkip={handlePinSkip} />
    </SidebarProvider>
  );
}

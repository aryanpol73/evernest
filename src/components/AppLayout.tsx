import { useState, useEffect, useCallback } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bell, TreePine, Home, FileText, Siren, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OnboardingModal } from "@/components/OnboardingModal";
import { PinSetupModal } from "@/components/PinSetupModal";
import { PinLockScreen } from "@/components/PinLockScreen";
import { useUserSettings } from "@/hooks/useUserSettings";
import { useFamily } from "@/hooks/useFamily";
import { Skeleton } from "@/components/ui/skeleton";

const INACTIVITY_TIMEOUT = 3 * 60 * 1000; // 3 minutes

export default function AppLayout() {
  const { user } = useAuth();
  const { data: settings, isLoading: settingsLoading } = useUserSettings();
  const { data: family, isLoading: familyLoading } = useFamily();
  const initials = user?.user_metadata?.full_name?.split(" ").map((n: string) => n[0]).join("").toUpperCase() || "U";

  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [pinLocked, setPinLocked] = useState(false);
  const [welcomeBanner, setWelcomeBanner] = useState(false);
  const [flowDone, setFlowDone] = useState(false);

  // Determine if onboarding/PIN setup needed
  useEffect(() => {
    if (settingsLoading || !settings) return;
    if (!settings.onboarding_completed) {
      setShowOnboarding(true);
    } else if (settings.pin_hash) {
      // Has PIN, check if we should lock (on initial load)
      setPinLocked(true);
    }
    setFlowDone(true);
  }, [settings, settingsLoading]);

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
    if (!settings?.pin_hash || !flowDone) return;
    let timer: ReturnType<typeof setTimeout>;

    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setPinLocked(true), INACTIVITY_TIMEOUT);
    };

    const events = ["mousedown", "keydown", "touchstart", "scroll"];
    events.forEach(e => document.addEventListener(e, resetTimer));
    resetTimer();

    // Lock on visibility change
    const handleVisibility = () => {
      if (document.hidden) setPinLocked(true);
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearTimeout(timer);
      events.forEach(e => document.removeEventListener(e, resetTimer));
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [settings?.pin_hash, flowDone]);

  // Show loading while settings are loading
  if (settingsLoading || familyLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-3">
          <TreePine className="h-8 w-8 text-primary animate-pulse" />
          <span className="text-lg font-semibold text-muted-foreground">Loading...</span>
        </div>
      </div>
    );
  }

  // PIN lock screen
  if (pinLocked && settings?.pin_hash) {
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

          <main className="flex-1 p-4 md:p-6 overflow-auto pb-20 md:pb-6">
            <Outlet />
          </main>
        </div>
      </div>
      <MobileTabBar />

      {/* Onboarding */}
      <OnboardingModal open={showOnboarding} onComplete={handleOnboardingComplete} />
      {/* PIN Setup */}
      <PinSetupModal open={showPinSetup} onComplete={handlePinSetupComplete} onSkip={handlePinSkip} />
    </SidebarProvider>
  );
}

const mobileItems = [
  { icon: Home, label: "Home", path: "/dashboard" },
  { icon: TreePine, label: "Tree", path: "/family-tree" },
  { icon: FileText, label: "Docs", path: "/documents" },
  { icon: Siren, label: "SOS", path: "/emergency" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

function MobileTabBar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t bg-card">
      <div className="flex justify-around py-2">
        {mobileItems.map(item => {
          const active = pathname.startsWith(item.path);
          return (
            <button key={item.path} onClick={() => navigate(item.path)} className={`flex flex-col items-center gap-0.5 px-3 py-1 transition-colors ${active ? "text-primary" : "text-muted-foreground"}`}>
              <item.icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

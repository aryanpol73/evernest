import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Home,
  FileText,
  Users,
  Bell,
  TreePine,
  Siren,
  Settings,
  Menu,
  LogOut,
} from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";

const primaryItems = [
  { icon: Home, label: "Home", path: "/dashboard" },
  { icon: FileText, label: "Docs", path: "/documents" },
  { icon: Users, label: "Members", path: "/members" },
  { icon: Bell, label: "Reminders", path: "/reminders" },
];

const moreItems = [
  { icon: TreePine, label: "Family Tree", path: "/family-tree" },
  { icon: Siren, label: "Emergency", path: "/emergency" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

function isActive(pathname: string, path: string) {
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function BottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { signOut } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);

  const go = (path: string) => {
    setMoreOpen(false);
    navigate(path);
  };

  const handleSignOut = async () => {
    setMoreOpen(false);
    await signOut();
    navigate("/");
  };

  return (
    <>
      <nav
        aria-label="Main navigation"
        className="fixed bottom-0 left-0 right-0 z-50 lg:hidden border-t bg-card pb-[env(safe-area-inset-bottom)]"
      >
        <div className="flex justify-around py-2">
          {primaryItems.map((item) => {
            const active = isActive(pathname, item.path);
            return (
              <button
                key={item.path}
                onClick={() => go(item.path)}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            );
          })}
          <button
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${
              moreItems.some((i) => isActive(pathname, i.path))
                ? "text-primary"
                : "text-muted-foreground"
            }`}
          >
            <Menu className="h-5 w-5" />
            <span className="text-[10px] font-medium">More</span>
          </button>
        </div>
      </nav>

      <Drawer open={moreOpen} onOpenChange={setMoreOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>More</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
            {moreItems.map((item) => {
              const active = isActive(pathname, item.path);
              return (
                <button
                  key={item.path}
                  onClick={() => go(item.path)}
                  aria-current={active ? "page" : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </button>
              );
            })}
            <Separator className="my-2" />
            <div className="w-full flex items-center justify-between px-3 py-3">
              <span className="text-sm font-medium">Appearance</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  Light / Dark
                </span>
                <ThemeToggle />
              </div>
            </div>
            <Separator className="my-2" />
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="h-5 w-5" />
              Sign Out
            </button>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

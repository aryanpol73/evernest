// Registers the app's generated service worker (vite-plugin-pwa) only in safe,
// production contexts — never in dev, iframes, or Lovable preview hosts.
// See the PWA skill rules this implements.

const PREVIEW_LABEL = /^(?:id-preview|preview)(?:-[a-z0-9]+)?--/;
const MANAGED_SUFFIXES = [".lovable.app", ".gpt-eng.com", ".gptengineer.run"];

function isPreviewHostname(hostname: string): boolean {
  const firstLabel = hostname.split(".")[0];
  if (PREVIEW_LABEL.test(firstLabel)) return true;
  if (hostname === "lovableproject.com" || hostname.endsWith(".lovableproject.com")) return true;
  if (hostname === "lovableproject-dev.com" || hostname.endsWith(".lovableproject-dev.com")) return true;
  if (hostname === "beta.lovable.dev" || hostname.endsWith(".beta.lovable.dev")) return true;
  if (MANAGED_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
    return PREVIEW_LABEL.test(firstLabel);
  }
  return false;
}

export async function registerServiceWorker(): Promise<void> {
  if (typeof window === "undefined") return;

  const hostname = window.location.hostname.toLowerCase();
  const params = new URLSearchParams(window.location.search);
  const refused =
    !import.meta.env.PROD ||
    window.self !== window.top ||
    params.has("sw=off") ||
    isPreviewHostname(hostname);

  if (refused) {
    await unregisterAppServiceWorker();
    return;
  }

  if ("serviceWorker" in navigator) {
    const { registerSW } = await import("virtual:pwa-register");
    registerSW({ immediate: true });
  }
}

async function unregisterAppServiceWorker(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      registrations
        .filter((registration) => {
          try {
            return new URL(registration.scriptURL).pathname === "/sw.js";
          } catch {
            return false;
          }
        })
        .map((registration) => registration.unregister()),
    );
  } catch {
    // Best effort — nothing to clean up.
  }
}

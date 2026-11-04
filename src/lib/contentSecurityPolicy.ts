// Limits the damage of any script injection: the session token is in localStorage,
// so this policy is what stops injected code running or sending the token elsewhere.
// Delivered as a meta tag, which browsers ignore frame-ancestors in, so clickjacking
// protection still needs a real response header from the host.
export function buildContentSecurityPolicy(supabaseUrl: string | undefined): string {
  if (!supabaseUrl?.startsWith("https://")) {
    throw new Error("VITE_SUPABASE_URL must be an https URL to build the Content-Security-Policy.");
  }

  const directives: Record<string, string[]> = {
    "default-src": ["'none'"],
    "script-src": ["'self'"],
    // Radix and the chart component inject <style> elements at runtime.
    "style-src": ["'self'", "'unsafe-inline'"],
    "font-src": ["'self'"],
    // blob: is document previews, and data: is the MFA QR code.
    "img-src": ["'self'", "data:", "blob:"],
    // Not 'self', on purpose. The app only talks to Supabase, and Lovable's hosting
    // injects same-origin analytics that report the full URL, including the fragment
    // where password reset links carry login tokens.
    "connect-src": [new URL(supabaseUrl).origin],
    "worker-src": ["'self'"],
    "manifest-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'none'"],
    "form-action": ["'self'"],
  };

  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");
}

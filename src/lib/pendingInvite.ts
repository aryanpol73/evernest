const KEY = "evernest-pending-invite";

// Kept for this tab only, to survive the trip through the sign-in page. A token on
// its own is useless, because it only works for the invited, confirmed address.
export function savePendingInvite(token: string): void {
  sessionStorage.setItem(KEY, token);
}

export function readPendingInvite(): string | null {
  return sessionStorage.getItem(KEY);
}

export function clearPendingInvite(): void {
  sessionStorage.removeItem(KEY);
}

// The token travels in the fragment, which browsers never send to a server.
export function inviteLink(token: string): string {
  return `${window.location.origin}/invite#token=${token}`;
}

export function tokenFromFragment(fragment: string): string | null {
  return new URLSearchParams(fragment.replace(/^#/, "")).get("token");
}

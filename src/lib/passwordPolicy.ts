export const MIN_PASSWORD_LENGTH = 10;

// bcrypt ignores anything past 72 bytes, and Supabase Auth rejects longer passwords.
const MAX_PASSWORD_BYTES = 72;

const COMMON_PASSWORDS = new Set([
  "password12", "password123", "password1234", "qwerty12345", "qwertyuiop1",
  "1234567890a", "a1234567890", "abcd123456", "abc1234567", "iloveyou123",
  "welcome1234", "admin12345", "letmein1234", "evernest123", "evernest1234",
]);

// Applies to new passwords only, so existing users can still sign in.
// Keep in step with [auth] in supabase/config.toml, which enforces this on the server.
export function validateNewPassword(password: string, email?: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) return "Password is too long.";
  if (!/\p{L}/u.test(password) || !/\p{N}/u.test(password)) return "Password must include letters and numbers.";

  const lowered = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lowered)) return "That password is too common. Please choose another.";

  const emailName = email?.split("@")[0]?.toLowerCase();
  if (emailName && emailName.length >= 4 && lowered.includes(emailName)) return "Password must not contain your email name.";

  return null;
}

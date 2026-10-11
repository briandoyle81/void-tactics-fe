/** Persists a per-user "don't ask about passkeys again" choice for PasskeyEnablePrompt.tsx. */
const PASSKEY_PROMPT_DISMISS_FOREVER_KEY =
  "void-tactics-passkey-prompt-dismiss-forever-v1";

export function isPasskeyPromptPermanentlyDismissed(userId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(PASSKEY_PROMPT_DISMISS_FOREVER_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    return parsed[userId] === true;
  } catch {
    return false;
  }
}

export function persistPasskeyPromptPermanentlyDismissed(userId: string): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(PASSKEY_PROMPT_DISMISS_FOREVER_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    parsed[userId] = true;
    localStorage.setItem(
      PASSKEY_PROMPT_DISMISS_FOREVER_KEY,
      JSON.stringify(parsed),
    );
  } catch {
    // Quota or disabled storage
  }
}

/**
 * Per-user "this device has a passkey" marks for PasskeyEnablePrompt.tsx.
 * An account's passkeys are listed on the user, but not which device holds
 * them, so a second device would otherwise never be offered one. Set when
 * the user signs in with a passkey here or registers one here.
 */
const PASSKEY_ON_DEVICE_KEY = "void-tactics-passkey-on-device-v1";

export function isPasskeyMarkedOnDevice(userId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(PASSKEY_ON_DEVICE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    return parsed[userId] === true;
  } catch {
    return false;
  }
}

export function markPasskeyOnDevice(userId: string): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(PASSKEY_ON_DEVICE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    if (parsed[userId] === true) return;
    parsed[userId] = true;
    localStorage.setItem(PASSKEY_ON_DEVICE_KEY, JSON.stringify(parsed));
  } catch {
    // Quota or disabled storage
  }
}

"use client";

import React from "react";
import {
  useDynamicContext,
  useRefreshUser,
  useStepUpAuthentication,
} from "@dynamic-labs/sdk-react-core";
import {
  JwtVerifiedCredentialFormatEnum,
  TokenScope,
  WalletProviderEnum,
} from "@dynamic-labs/sdk-api-core";
import {
  getMfaRecoveryCodes,
  registerPasskey,
  NoWebAuthNSupportError,
} from "@dynamic-labs-sdk/client";
import { toast } from "react-hot-toast";
import {
  isPasskeyMarkedOnDevice,
  isPasskeyPromptPermanentlyDismissed,
  markPasskeyOnDevice,
  persistPasskeyPromptPermanentlyDismissed,
} from "../utils/passkeyPromptStorage";
import { openRecoveryCodes, type RecoveryCodesReason } from "./RecoveryCodesModal";

function isWebAuthnSupported(): boolean {
  return typeof window !== "undefined" && typeof window.PublicKeyCredential !== "undefined";
}

// Nudges a user who just authenticated with a non-passkey method (email,
// social, wallet) to also register a passkey for faster sign-in next time.
//
// [ENABLE PASSKEY] calls registerPasskey() from @dynamic-labs-sdk/client
// directly — NOT the legacy @dynamic-labs/sdk-react-core useRegisterPasskey
// hook. That hook wraps the same underlying call in Dynamic's internal
// completeAuth()/view-state machinery (pushView, setShowAuthFlow, etc.),
// which swallows any error and never rethrows — so when called from custom
// UI outside Dynamic's own widget flow, it silently no-ops (no browser
// passkey dialog, no error, nothing). Calling registerPasskey() from the new
// SDK package directly skips that machinery: it goes straight to
// core.passkey.register(...), the actual WebAuthn call, and real
// errors/successes propagate normally. The two SDKs share one underlying
// client (DynamicContextProvider bootstraps it via useInitializeSdkClient),
// so this still operates on the same authenticated session as the rest of
// the app — useRefreshUser() afterward syncs the legacy user object's
// verifiedCredentials so alreadyHasPasskey below sees it without a reload.
//
// Registering a passkey is server-gated behind an elevated access token
// (TokenScope.Credentiallink — same scope "register a passkey MFA device"
// needs per Dynamic's step-up docs), so a plain sign-in session isn't enough;
// registerPasskey() alone fails with APIError "Elevated access token
// required". useStepUpAuthentication's promptStepUpAuth shows Dynamic's own
// re-auth UI (whatever the user already has — email/SMS OTP, wallet, social)
// to mint that token first. Our own modal closes while that's on screen to
// avoid stacking two overlays.
//
// Evaluated once per mount (Header.tsx renders this once, high in the tree);
// skipped entirely if this device already has a passkey for the user (they
// signed in with one here or registered one here, marked per device via
// passkeyPromptStorage.ts), they signed in with a browser extension wallet,
// the browser doesn't support WebAuthn, or they previously checked "don't
// show this again" (persisted per Dynamic userId). An account can hold one
// passkey per device, so a user whose passkey lives on another device is
// offered one for this device ("Add a passkey for this device").
//
// A second device: once the account has a passkey, Dynamic only accepts an
// existing MFA factor (that passkey, or a recovery code), not the email
// code, to add another. So on [ENABLE PASSKEY] we first try verifying with
// one of the account's recovery codes read from this device, so the player
// never sees one; if Dynamic won't hand them over here, the prompt asks for
// a code (found under Settings (gear icon) › Recovery codes on the device with the
// passkey, see RecoveryCodesModal.tsx) or offers the existing passkey
// (e.g. on a phone via the browser's QR option).

// Verification methods that don't need a device-bound factor (re-auth:
// an email/SMS code, social, or an external wallet signature).
const REAUTH_FORMATS = new Set<JwtVerifiedCredentialFormatEnum>([
  JwtVerifiedCredentialFormatEnum.Email,
  JwtVerifiedCredentialFormatEnum.PhoneNumber,
  JwtVerifiedCredentialFormatEnum.Oauth,
  JwtVerifiedCredentialFormatEnum.Blockchain,
]);

export function PasskeyEnablePrompt() {
  const { user } = useDynamicContext();
  const refreshUser = useRefreshUser();
  const { checkStepUpAuth, promptStepUpAuth, verifyRecoveryCode } = useStepUpAuthentication();
  const [isOpen, setIsOpen] = React.useState(false);
  const [dontShowAgain, setDontShowAgain] = React.useState(false);
  const [isRegistering, setIsRegistering] = React.useState(false);
  const [hasPasskeyElsewhere, setHasPasskeyElsewhere] = React.useState(false);
  // Dynamic will only accept an existing MFA factor (passkey, authenticator
  // app or recovery code) to add this passkey, not an email code, and the
  // automatic recovery-code route didn't work: ask for a code.
  const [needsExistingFactor, setNeedsExistingFactor] = React.useState(false);
  const [recoveryCode, setRecoveryCode] = React.useState("");
  const [codeError, setCodeError] = React.useState<string | null>(null);
  const hasEvaluatedRef = React.useRef(false);

  React.useEffect(() => {
    if (hasEvaluatedRef.current) return;
    if (!user?.userId) return;
    hasEvaluatedRef.current = true;

    if (!isWebAuthnSupported()) return;
    if (isPasskeyPromptPermanentlyDismissed(user.userId)) return;

    const lastCredential = user.verifiedCredentials?.find(
      (vc) => vc.id === user.lastVerifiedCredentialId,
    );
    if (lastCredential?.format === "passkey") {
      markPasskeyOnDevice(user.userId);
      return;
    }
    if (isPasskeyMarkedOnDevice(user.userId)) return;
    // A browser extension wallet (MetaMask etc.) already is the user's fast
    // sign-in; a passkey adds nothing for them.
    if (lastCredential?.walletProvider === WalletProviderEnum.BrowserExtension) return;

    setHasPasskeyElsewhere(user.verifiedCredentials?.some((vc) => vc.format === "passkey") ?? false);
    setIsOpen(true);
  }, [user]);

  const dismiss = () => {
    if (dontShowAgain && user?.userId) {
      persistPasskeyPromptPermanentlyDismissed(user.userId);
    }
    setIsOpen(false);
  };

  const verifyWithCode = async (code: string): Promise<boolean> => {
    const response = await verifyRecoveryCode({
      code,
      requestedScopes: [TokenScope.Credentiallink],
    });
    return response != null;
  };

  /** The direct route: verify with one of the account's codes, read from this device. */
  const tryAccountRecoveryCode = async (): Promise<boolean> => {
    try {
      const [code] = (await getMfaRecoveryCodes()).recoveryCodes;
      return code != null && (await verifyWithCode(code));
    } catch (error) {
      console.warn("Recovery codes aren't readable from this device:", error);
      return false;
    }
  };

  /** Creates the passkey once verified; `showCodes` opens the recovery codes after. */
  const createPasskey = async (showCodes: RecoveryCodesReason | null) => {
    await registerPasskey();
    if (user?.userId) markPasskeyOnDevice(user.userId);
    try {
      await refreshUser();
    } catch (refreshError) {
      // The passkey itself registered fine — a failed resync here just
      // means the legacy `user` object stays stale until next reload, not
      // that anything actually failed.
      console.error("Failed to refresh user after registering passkey:", refreshError);
    }
    toast.success("Passkey added — you can use it to sign in next time.");
    if (dontShowAgain && user?.userId) {
      persistPasskeyPromptPermanentlyDismissed(user.userId);
    }
    setIsOpen(false);
    if (showCodes) openRecoveryCodes(showCodes);
  };

  const run = async (step: () => Promise<void>) => {
    setIsRegistering(true);
    try {
      await step();
    } catch (error) {
      console.error("Failed to register passkey:", error);
      const isCancelledReauth =
        error instanceof Error && error.message === "Reauthentication flow closed";
      const message = isCancelledReauth
        ? "Verification was cancelled — passkey wasn't set up."
        : error instanceof NoWebAuthNSupportError
          ? "This browser or device doesn't support passkeys."
          : "Couldn't set up a passkey. You can try again anytime from My Account.";
      toast.error(message);
    } finally {
      setIsRegistering(false);
    }
  };

  const handleEnable = () =>
    run(async () => {
      // Adding a passkey links a credential, which needs a fresh
      // verification. Dynamic picks the method: re-auth (the email code)
      // when allowed, otherwise an existing MFA factor — it blocks re-auth
      // once the account has MFA devices (docs: /auth/step-up-auth).
      const { isRequired, credentials } = await checkStepUpAuth({
        scope: TokenScope.Credentiallink,
      });
      if (isRequired && !credentials.some((c) => REAUTH_FORMATS.has(c.format))) {
        if (await tryAccountRecoveryCode()) {
          await createPasskey(null);
        } else {
          setNeedsExistingFactor(true);
        }
        return;
      }
      if (isRequired) {
        setIsOpen(false);
        // Resolves with undefined on a *successful* verification (see
        // Dynamic's useStepUpPromptReauth: onSuccess calls
        // deferred.resolve(undefined)) — cancellation/failure rejects the
        // promise instead, which run() handles. There's no truthy value to
        // check here; reaching this line without throwing means the
        // elevated token is already stored.
        await promptStepUpAuth({ requestedScopes: [TokenScope.Credentiallink] });
      }
      await createPasskey(hasPasskeyElsewhere ? null : "first-passkey");
    });

  const handleUseCode = () =>
    run(async () => {
      const code = recoveryCode.trim();
      if (!code) return;
      setCodeError(null);
      let verified = false;
      try {
        verified = await verifyWithCode(code);
      } catch (error) {
        console.warn("Recovery code rejected:", error);
      }
      if (!verified) {
        setCodeError("That code didn't work. Check it and try again; each code works once.");
        return;
      }
      setRecoveryCode("");
      await createPasskey("used-code");
    });

  /** Verify with the existing passkey (e.g. on a phone via the browser's QR option). */
  const handleUsePasskey = () =>
    run(async () => {
      setIsOpen(false);
      await promptStepUpAuth({ requestedScopes: [TokenScope.Credentiallink] });
      await createPasskey(null);
    });

  if (!isOpen) return null;

  const buttonClass =
    "px-4 py-2 border-2 border-solid uppercase font-semibold tracking-wider text-xs disabled:cursor-not-allowed disabled:opacity-50";
  const secondaryStyle = {
    borderColor: "var(--color-gunmetal)",
    color: "var(--color-text-secondary)",
    backgroundColor: "var(--color-steel)",
  };
  const primaryStyle = {
    borderColor: "var(--color-phosphor-green)",
    color: "var(--color-phosphor-green)",
    backgroundColor: "var(--color-steel)",
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div
        className="bg-near-black border-2 p-6 max-w-md w-full rounded-none font-mono"
        style={{ borderColor: "var(--color-cyan)" }}
      >
        <div className="flex justify-between items-start gap-4 mb-3">
          <h2 className="text-lg font-bold text-cyan tracking-wider">
            {needsExistingFactor
              ? "[CONFIRM IT'S YOU]"
              : hasPasskeyElsewhere
                ? "[ADD A PASSKEY FOR THIS DEVICE?]"
                : "[ENABLE FASTER SIGN-IN?]"}
          </h2>
          <button
            type="button"
            onClick={dismiss}
            className="text-cyan hover:text-cyan/80 transition-all duration-200 text-2xl font-bold leading-none shrink-0"
            aria-label="Close"
            disabled={isRegistering}
          >
            ×
          </button>
        </div>

        {needsExistingFactor ? (
          <>
            <p className="text-sm text-text-secondary leading-relaxed">
              To add a passkey on this device, enter one of your recovery codes.
            </p>
            <form
              className="mt-3"
              onSubmit={(e) => {
                e.preventDefault();
                void handleUseCode();
              }}
            >
              <input
                type="text"
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value)}
                placeholder="Recovery code"
                autoComplete="one-time-code"
                spellCheck={false}
                className="w-full bg-steel border-2 border-gunmetal px-3 py-2 text-sm text-text-primary tracking-wider"
                disabled={isRegistering}
              />
              {codeError && <p className="mt-2 text-xs text-amber">{codeError}</p>}
            </form>
            <p className="mt-3 text-xs text-text-muted leading-relaxed">
              No code? On the device with your passkey, open Settings (gear icon) › Recovery codes. If your
              passkey is on your phone, use it instead: choose &ldquo;Use a phone or tablet&rdquo;
              in the next window and scan the code.
            </p>
          </>
        ) : (
          <p className="text-sm text-text-secondary leading-relaxed">
            {hasPasskeyElsewhere
              ? "Your passkey is on another device. Add one here to sign in on this device with Face ID, a fingerprint, or your device PIN."
              : "Set up a passkey to sign in next time with Face ID, a fingerprint, or your device PIN — no code to type or wait for."}
          </p>
        )}

        <label className="mt-4 flex items-center gap-2 text-xs text-text-muted cursor-pointer">
          <input
            type="checkbox"
            checked={dontShowAgain}
            onChange={(e) => setDontShowAgain(e.target.checked)}
          />
          Don&apos;t show this again
        </label>

        <div className="mt-5 flex flex-wrap gap-2 justify-end">
          <button
            type="button"
            onClick={dismiss}
            disabled={isRegistering}
            className={buttonClass}
            style={secondaryStyle}
          >
            [NOT NOW]
          </button>
          {needsExistingFactor ? (
            <>
              <button
                type="button"
                onClick={() => void handleUsePasskey()}
                disabled={isRegistering}
                className={buttonClass}
                style={secondaryStyle}
              >
                [USE MY PASSKEY]
              </button>
              <button
                type="button"
                onClick={() => void handleUseCode()}
                disabled={isRegistering || !recoveryCode.trim()}
                className={buttonClass}
                style={primaryStyle}
              >
                {isRegistering ? "[FOLLOW THE PROMPT...]" : "[USE CODE]"}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => void handleEnable()}
              disabled={isRegistering}
              className={buttonClass}
              style={primaryStyle}
            >
              {isRegistering ? "[FOLLOW THE PROMPT...]" : "[ENABLE PASSKEY]"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

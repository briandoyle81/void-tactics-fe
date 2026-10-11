"use client";

import React from "react";
import { useStepUpAuthentication } from "@dynamic-labs/sdk-react-core";
import {
  acknowledgeRecoveryCodes,
  createNewMfaRecoveryCodes,
  getMfaRecoveryCodes,
} from "@dynamic-labs-sdk/client";
import { toast } from "react-hot-toast";

// The account's Dynamic recovery codes: 10 single-use codes that verify the
// player in place of their passkey. A device without the passkey uses one
// to add its own (see PasskeyEnablePrompt.tsx), since Dynamic only accepts
// an existing passkey or a recovery code for that once the account has a
// passkey.
//
// Opened with openRecoveryCodes() from anywhere (My Account menu, the
// passkey prompt after it adds a passkey); RecoveryCodesHost, mounted once
// in Header.tsx, owns the modal.
//
// getMfaRecoveryCodes returns the existing set (creating one if there is
// none); createNewMfaRecoveryCodes replaces it. If Dynamic wants the
// player verified first, we run its MFA prompt (their passkey) and retry
// once.

const OPEN_EVENT = "void-tactics-open-recovery-codes";

export type RecoveryCodesReason = "first-passkey" | "used-code" | "manual";

export function openRecoveryCodes(reason: RecoveryCodesReason = "manual"): void {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { reason } }));
}

const INTRO: Record<RecoveryCodesReason, string> = {
  "first-passkey":
    "Save these codes somewhere safe. To add a passkey on another device, you'll confirm with your passkey or one of these codes.",
  "used-code":
    "You used a recovery code to add this passkey. Each code works once, so make sure you still have some left, or generate a new set.",
  manual:
    "Use one of these codes to add a passkey on a device that doesn't have yours. Each code works once.",
};

export function RecoveryCodesHost() {
  const [reason, setReason] = React.useState<RecoveryCodesReason | null>(null);

  React.useEffect(() => {
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ reason?: RecoveryCodesReason }>).detail;
      setReason(detail?.reason ?? "manual");
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  if (!reason) return null;
  return <RecoveryCodesModal reason={reason} onClose={() => setReason(null)} />;
}

function RecoveryCodesModal({
  reason,
  onClose,
}: {
  reason: RecoveryCodesReason;
  onClose: () => void;
}) {
  const { promptMfa } = useStepUpAuthentication();
  const [codes, setCodes] = React.useState<string[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isBusy, setIsBusy] = React.useState(true);
  const [saved, setSaved] = React.useState(false);
  // Dynamic's hook returns a new promptMfa every render; read it through a
  // ref so loading isn't re-triggered by a re-render (that loop opened
  // passkey prompt after passkey prompt).
  const promptMfaRef = React.useRef(promptMfa);
  promptMfaRef.current = promptMfa;
  const isLoadingRef = React.useRef(false);

  // Runs `load`; if Dynamic refuses, verifies with the player's passkey
  // (its MFA prompt) and tries once more. One at a time.
  const withVerification = React.useCallback(
    async (load: () => Promise<{ recoveryCodes: string[] }>) => {
      if (isLoadingRef.current) return;
      isLoadingRef.current = true;
      setIsBusy(true);
      setError(null);
      try {
        try {
          setCodes((await load()).recoveryCodes);
        } catch (firstError) {
          console.warn("Recovery codes need verification:", firstError);
          await promptMfaRef.current();
          setCodes((await load()).recoveryCodes);
        }
        setSaved(false);
      } catch (loadError) {
        console.error("Failed to load recovery codes:", loadError);
        setError("Couldn't load your recovery codes. Try again from Settings (gear icon) › Recovery codes on a device with your passkey.");
      } finally {
        isLoadingRef.current = false;
        setIsBusy(false);
      }
    },
    [],
  );

  // Load once when the window opens.
  React.useEffect(() => {
    void withVerification(() => getMfaRecoveryCodes());
  }, [withVerification]);

  const text = codes?.join("\n") ?? "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Recovery codes copied.");
    } catch {
      toast.error("Couldn't copy. Select the codes and copy them instead.");
    }
  };

  const download = () => {
    const blob = new Blob([`Void Tactics recovery codes\nEach code works once.\n\n${text}\n`], {
      type: "text/plain",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "void-tactics-recovery-codes.txt";
    link.click();
    URL.revokeObjectURL(url);
  };

  const regenerate = () => void withVerification(() => createNewMfaRecoveryCodes());

  const done = async () => {
    if (codes) {
      try {
        await acknowledgeRecoveryCodes();
      } catch (ackError) {
        // Only Dynamic's "codes still pending" flag; the codes are valid either way.
        console.warn("Failed to acknowledge recovery codes:", ackError);
      }
    }
    onClose();
  };

  const buttonClass =
    "px-4 py-2 border-2 border-solid uppercase font-semibold tracking-wider text-xs disabled:cursor-not-allowed disabled:opacity-50";
  const secondaryStyle = {
    borderColor: "var(--color-gunmetal)",
    color: "var(--color-text-secondary)",
    backgroundColor: "var(--color-steel)",
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div
        className="bg-near-black border-2 p-6 max-w-md w-full rounded-none font-mono"
        style={{ borderColor: "var(--color-cyan)" }}
      >
        <div className="flex justify-between items-start gap-4 mb-3">
          <h2 className="text-lg font-bold text-cyan tracking-wider">[RECOVERY CODES]</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-cyan hover:text-cyan/80 transition-all duration-200 text-2xl font-bold leading-none shrink-0"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <p className="text-sm text-text-secondary leading-relaxed">{INTRO[reason]}</p>

        {isBusy && <p className="mt-4 text-sm text-text-muted">[LOADING...]</p>}
        {error && <p className="mt-4 text-sm text-amber">{error}</p>}

        {codes && !isBusy && (
          <>
            <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 border border-gunmetal p-3 text-sm text-text-primary select-all">
              {codes.map((code) => (
                <li key={code}>{code}</li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => void copy()} className={buttonClass} style={secondaryStyle}>
                [COPY]
              </button>
              <button type="button" onClick={download} className={buttonClass} style={secondaryStyle}>
                [DOWNLOAD]
              </button>
              <button type="button" onClick={regenerate} className={buttonClass} style={secondaryStyle}>
                [NEW SET]
              </button>
            </div>
            <p className="mt-2 text-xs text-text-muted">A new set replaces these; the old codes stop working.</p>
            <label className="mt-4 flex items-center gap-2 text-xs text-text-muted cursor-pointer">
              <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
              I&apos;ve saved these codes
            </label>
          </>
        )}

        <div className="mt-5 flex gap-2 justify-end">
          {error ? (
            <>
              <button type="button" onClick={onClose} className={buttonClass} style={secondaryStyle}>
                [CLOSE]
              </button>
              <button
                type="button"
                onClick={() => void withVerification(() => getMfaRecoveryCodes())}
                className={buttonClass}
                style={{
                  borderColor: "var(--color-phosphor-green)",
                  color: "var(--color-phosphor-green)",
                  backgroundColor: "var(--color-steel)",
                }}
              >
                [TRY AGAIN]
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => void done()}
              disabled={!codes || !saved || isBusy}
              className={buttonClass}
              style={{
                borderColor: "var(--color-phosphor-green)",
                color: "var(--color-phosphor-green)",
                backgroundColor: "var(--color-steel)",
              }}
            >
              [DONE]
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

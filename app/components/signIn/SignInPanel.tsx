"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import posthog from "posthog-js";
import {
  useConnectWithOtp,
  useDynamicContext,
  useProjectSettings,
  useSignInWithPasskey,
  useSocialAccounts,
  useWalletOptions,
} from "@dynamic-labs/sdk-react-core";
import { ProviderEnum } from "@dynamic-labs/sdk-api-core";
import { useOpenDynamicAuthFlow, usePrepareSignIn } from "../../hooks/useOpenWalletSignIn";
import { WEB2_SIGN_IN_ENABLED } from "../../config/alpha";
import { isAnyPasskeyMarkedOnDevice } from "../../utils/passkeyPromptStorage";

// The sign-in panel, shared by the play page's sign-in screen (BootScreen)
// and the sign-in modal any other surface opens (SignInModal, via
// openSignIn()). The main path is Dynamic's embedded wallet, driven headless
// from our own UI: an email code (useConnectWithOtp) or Google
// (useSocialAccounts), both of which create the player's embedded wallet on
// sign-up (a Dynamic dashboard setting). A browser wallet is a side route: a
// small link opens a notice steering the player back to the embedded wallet
// (a browser wallet asks them to approve every move), then the browser
// wallets Dynamic finds (useWalletOptions), with Dynamic's own modal for any
// other wallet. A passkey signs in an account that has one
// (useSignInWithPasskey); on a device where one was added before, it's the
// first option. Design: the "Login Screen Redesign" canvas (2026-11-05).

const DISPLAY_FONT = { fontFamily: "var(--font-rajdhani), 'Arial Black', sans-serif" } as const;
const MONO_FONT = { fontFamily: "var(--font-jetbrains-mono), 'Courier New', monospace" } as const;
const PANEL_BG = "rgba(12,17,23,0.9)";
const CODE_LENGTH = 6;
const RESEND_SECONDS = 45;
/** How long "Setting up" waits for the wallet to connect before offering a retry. */
const SETUP_TIMEOUT_MS = 30_000;

export type SignInStep = "email" | "code" | "setup" | "wallets";

function errorText(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : "";
  return message && message.length < 140 ? message : fallback;
}

function Panel({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-4 border-2 border-solid p-5 sm:p-6" style={{ borderColor: color, backgroundColor: PANEL_BG }}>
      {children}
    </div>
  );
}

function PanelHeading({ title, body, color }: { title: string; body?: React.ReactNode; color: string }) {
  return (
    <div className="grid gap-1">
      <h2 className="text-2xl font-bold uppercase tracking-wider sm:text-3xl" style={{ ...DISPLAY_FONT, color }}>
        {title}
      </h2>
      {body && (
        <p className="text-base text-text-secondary" style={DISPLAY_FONT}>
          {body}
        </p>
      )}
    </div>
  );
}

function OrDivider() {
  return (
    <div className="flex items-center gap-3" aria-hidden="true">
      <span className="h-px flex-1 bg-steel" />
      <span className="text-[11px] tracking-[0.12em] text-text-muted" style={MONO_FONT}>
        OR
      </span>
      <span className="h-px flex-1 bg-steel" />
    </div>
  );
}

/** A key, for the passkey buttons. */
function PasskeyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="mr-2">
      <circle cx="8" cy="15" r="4" />
      <path d="M11 12l9-9M17 6l3 3M14 9l2 2" />
    </svg>
  );
}

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="text-[11px] font-bold uppercase tracking-[0.12em] text-text-secondary" style={MONO_FONT}>
      {children}
    </label>
  );
}

function ErrorLine({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-warning-red" style={DISPLAY_FONT}>
      {message}
    </p>
  );
}

const PRIMARY_BUTTON =
  "inline-flex h-12 items-center justify-center bg-cyan px-6 text-[13px] font-bold uppercase tracking-[0.1em] text-near-black transition-[filter] hover:brightness-110 disabled:cursor-wait disabled:opacity-60";
const OUTLINE_BUTTON =
  "inline-flex h-12 items-center justify-center gap-2.5 border border-solid border-cyan px-6 text-[13px] font-bold uppercase tracking-[0.1em] text-cyan transition-colors hover:bg-steel disabled:cursor-wait disabled:opacity-60";
const QUIET_LINK =
  "inline-flex min-h-11 items-center text-xs uppercase tracking-[0.08em] text-text-secondary hover:text-cyan";

/** Shown each time a player picks the browser-wallet route, before the wallet list. */
function BrowserWalletNotice({ onUseEmbedded, onContinue }: { onUseEmbedded: () => void; onContinue: () => void }) {
  const primaryRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    primaryRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onUseEmbedded();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onUseEmbedded]);

  return (
    // Above GameNav (z-250) and SignInModal (z-[450]).
    <div className="fixed inset-0 z-[460] flex items-center justify-center bg-black/75 p-4 backdrop-blur-[3px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="browser-wallet-notice-title"
        className="grid w-full max-w-[480px] gap-5 border-2 border-solid border-cyan bg-near-black px-6 pb-6 pt-7"
        style={{ boxShadow: "0 0 40px rgba(86,214,255,0.18)" }}
      >
        <div className="grid gap-2.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber" style={MONO_FONT}>
            Before you connect
          </span>
          <h2
            id="browser-wallet-notice-title"
            className="text-[28px] font-bold uppercase leading-[1.05] tracking-wider text-cyan"
            style={DISPLAY_FONT}
          >
            For the best experience, use the embedded wallet
          </h2>
          <p className="text-[17px] leading-snug text-text-bright" style={DISPLAY_FONT}>
            If you use a browser wallet, you&apos;ll need to approve{" "}
            <span className="font-bold text-amber">50+ transactions</span> per game.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs tracking-[0.04em]" style={MONO_FONT}>
          <div className="grid content-start gap-1.5 border border-solid border-cyan p-3" style={{ backgroundColor: "rgba(86,214,255,0.06)" }}>
            <span className="font-bold uppercase tracking-[0.1em] text-cyan">Embedded</span>
            <span className="text-text-bright">Moves go through as you play</span>
            <span className="text-text-bright">Sign in with email</span>
          </div>
          <div className="grid content-start gap-1.5 border border-solid border-steel p-3">
            <span className="font-bold uppercase tracking-[0.1em] text-text-secondary">Browser wallet</span>
            <span className="text-text-secondary">A popup for every move</span>
            <span className="text-text-secondary">50+ approvals per game</span>
          </div>
        </div>

        <div className="grid gap-2">
          <button ref={primaryRef} type="button" onClick={onUseEmbedded} className={PRIMARY_BUTTON} style={MONO_FONT}>
            Use the embedded wallet ›
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="min-h-11 text-xs uppercase tracking-[0.08em] text-text-secondary hover:text-cyan"
            style={MONO_FONT}
          >
            Continue with a browser wallet
          </button>
        </div>
      </div>
    </div>
  );
}

function WalletRow({
  label,
  icon,
  tag,
  highlighted,
  disabled,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  tag: React.ReactNode;
  highlighted?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-14 items-center gap-3.5 border border-solid px-4 text-left text-sm font-bold tracking-[0.06em] text-text-primary transition-colors hover:bg-slate disabled:cursor-wait disabled:opacity-60"
      style={{ ...MONO_FONT, backgroundColor: "#0f151c", borderColor: highlighted ? "var(--color-amber)" : "var(--color-steel)" }}
    >
      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {tag}
    </button>
  );
}

/**
 * The sign-in steps (email, code, setup, browser wallets) and the
 * browser-wallet notice. `surface` tags its analytics events;
 * `onStepChange` lets the host show or hide its own chrome per step.
 */
export function SignInPanel({
  surface,
  onStepChange,
}: {
  surface: string;
  onStepChange?: (step: SignInStep, noticeOpen: boolean) => void;
}) {
  const prepare = usePrepareSignIn();
  const openDynamicAuthFlow = useOpenDynamicAuthFlow();
  const { handleLogOut } = useDynamicContext();
  const projectSettings = useProjectSettings();
  const { connectWithEmail, verifyOneTimePassword, retryOneTimePassword } = useConnectWithOtp();
  const { signInWithSocialAccount } = useSocialAccounts();
  const { walletOptions, selectWalletOption } = useWalletOptions();

  const [step, setStep] = useState<SignInStep>("email");
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [setupStalled, setSetupStalled] = useState(false);
  const codeInputRef = useRef<HTMLInputElement>(null);

  const signInWithPasskey = useSignInWithPasskey();
  // Passkey sign-in: enabled in Dynamic's dashboard and supported by this
  // browser. A device that has added a passkey before gets it first. Read
  // after mount (browser-only), so the first render matches the server's.
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [passkeyFirst, setPasskeyFirst] = useState(false);
  useEffect(() => {
    setPasskeySupported(typeof window !== "undefined" && typeof window.PublicKeyCredential !== "undefined");
    setPasskeyFirst(isAnyPasskeyMarkedOnDevice());
  }, []);
  const passkeyEnabled =
    passkeySupported &&
    !!projectSettings?.providers?.some((p) => String(p.provider) === "passkey" && !!p.enabledAt);
  const showPasskeyFirst = passkeyEnabled && passkeyFirst;

  const googleEnabled = useMemo(
    () =>
      !!projectSettings?.sdk?.socialSignIn?.providers?.some(
        (p) => String(p.provider) === "google" && p.enabled !== false,
      ),
    [projectSettings],
  );

  // Browser wallets Dynamic found in this browser (EVM, not the embedded
  // wallet, one per wallet group).
  const installedWallets = useMemo(() => {
    const seen = new Set<string>();
    return walletOptions.filter((o) => {
      const evm = o.chain === "EVM" || o.supportedChains?.includes("EVM");
      if (!evm || !o.isInstalledOnBrowser || o.isWalletConnect) return false;
      const id = o.group ?? o.key;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [walletOptions]);

  // Resend countdown.
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  useEffect(() => {
    if (step === "code") codeInputRef.current?.focus();
  }, [step]);

  // The panel's host takes it away once the wallet connects; if that
  // doesn't happen, offer a retry instead of spinning forever.
  useEffect(() => {
    if (step !== "setup") return;
    setSetupStalled(false);
    const timer = window.setTimeout(() => setSetupStalled(true), SETUP_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [step]);

  const goTo = useCallback((next: SignInStep) => {
    setError(null);
    setStep(next);
  }, []);

  const chooseEmbedded = useCallback(() => {
    posthog.capture("sign_in_browser_wallet_notice", { choice: "embedded" });
    setNoticeOpen(false);
    goTo("email");
  }, [goTo]);

  const continueWithBrowserWallet = useCallback(() => {
    posthog.capture("sign_in_browser_wallet_notice", { choice: "browser" });
    setNoticeOpen(false);
    goTo("wallets");
  }, [goTo]);

  const sendCode = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const address = email.trim();
    if (!address || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (!(await prepare())) return;
      posthog.capture("sign_in_email_code_requested", { surface });
      await connectWithEmail(address);
      setCode("");
      setResendIn(RESEND_SECONDS);
      goTo("code");
    } catch (err) {
      setError(errorText(err, "Couldn't send a code to that email. Check it and try again."));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (value: string) => {
    if (value.length !== CODE_LENGTH || busy) return;
    setBusy(true);
    setError(null);
    try {
      await verifyOneTimePassword(value);
      posthog.capture("sign_in_email_verified", { surface });
      goTo("setup");
    } catch (err) {
      setCode("");
      setError(errorText(err, "That code didn't work. Check it and try again."));
      codeInputRef.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (resendIn > 0 || busy) return;
    setError(null);
    try {
      await retryOneTimePassword();
      setResendIn(RESEND_SECONDS);
    } catch (err) {
      setError(errorText(err, "Couldn't resend the code. Try again in a moment."));
    }
  };

  const signInWithGoogle = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (!(await prepare())) return;
      posthog.capture("sign_in_google_clicked", { surface });
      await signInWithSocialAccount(ProviderEnum.Google);
    } catch (err) {
      setError(errorText(err, "Google sign-in didn't finish. Try again."));
    } finally {
      setBusy(false);
    }
  };

  const signInPasskey = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (!(await prepare())) return;
      posthog.capture("sign_in_passkey_clicked", { surface, passkey_first: showPasskeyFirst });
      await signInWithPasskey();
      goTo("setup");
    } catch (err) {
      // Closing the browser's passkey prompt isn't an error worth a message.
      if (err instanceof Error && err.name === "NotAllowedError") return;
      setError(errorText(err, "That passkey didn't work. Try again, or sign in with email."));
    } finally {
      setBusy(false);
    }
  };

  const connectBrowserWallet = async (key: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (!(await prepare())) return;
      posthog.capture("sign_in_browser_wallet_selected", { surface, wallet: key });
      await selectWalletOption(key);
    } catch (err) {
      setError(errorText(err, "The wallet didn't connect. Open it and try again."));
    } finally {
      setBusy(false);
    }
  };

  const restart = async () => {
    try {
      await handleLogOut();
    } catch (err) {
      console.error("Failed to reset sign-in:", err);
    }
    setCode("");
    goTo("email");
  };

  useEffect(() => {
    onStepChange?.(step, noticeOpen);
  }, [step, noticeOpen, onStepChange]);

  return (
    <>
    {step === "email" && (
      <Panel color="var(--color-cyan)">
        <PanelHeading
          color="var(--color-cyan)"
          title="Sign in"
          body={
            showPasskeyFirst
              ? "Welcome back. Use your passkey, or the email you signed up with."
              : "New or returning, use the same email. Your ships are yours onchain."
          }
        />
        {showPasskeyFirst && (
          <>
            <button type="button" onClick={() => void signInPasskey()} disabled={busy} className={PRIMARY_BUTTON} style={MONO_FONT}>
              <PasskeyIcon />
              Sign in with passkey ›
            </button>
            <OrDivider />
          </>
        )}
        <form onSubmit={sendCode} className="grid gap-2.5">
          <FieldLabel htmlFor="boot-email">Email</FieldLabel>
          <div className="flex flex-wrap gap-2">
            <input
              id="boot-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="h-12 min-w-0 flex-[1_1_240px] border border-solid border-steel bg-near-black px-3.5 text-base text-text-primary outline-none placeholder:text-text-muted focus:border-cyan"
              style={MONO_FONT}
            />
            <button
              type="submit"
              disabled={busy || !email.trim()}
              className={`${showPasskeyFirst ? OUTLINE_BUTTON : PRIMARY_BUTTON} flex-[0_0_auto]`}
              style={MONO_FONT}
            >
              {busy ? "Sending…" : "Send code ›"}
            </button>
          </div>
        </form>
        <ErrorLine message={error} />
        {(googleEnabled || (passkeyEnabled && !showPasskeyFirst)) && <OrDivider />}
        {googleEnabled && (
          <button type="button" onClick={() => void signInWithGoogle()} disabled={busy} className={OUTLINE_BUTTON} style={MONO_FONT}>
            Continue with Google
          </button>
        )}
        {passkeyEnabled && !showPasskeyFirst && (
          <button type="button" onClick={() => void signInPasskey()} disabled={busy} className={OUTLINE_BUTTON} style={MONO_FONT}>
            <PasskeyIcon />
            Sign in with passkey
          </button>
        )}
        {WEB2_SIGN_IN_ENABLED && (
          <button
            type="button"
            onClick={() => {
              posthog.capture("web2_sign_in_clicked", { surface });
              void signIn("google");
            }}
            className="inline-flex h-12 items-center justify-center border border-solid border-amber px-6 text-[13px] font-bold uppercase tracking-[0.1em] text-amber hover:bg-steel"
            style={MONO_FONT}
          >
            Play without a wallet (Web2)
          </button>
        )}
      </Panel>
    )}

    {step === "code" && (
      <Panel color="var(--color-cyan)">
        <PanelHeading
          color="var(--color-cyan)"
          title="Check your email"
          body={
            <>
              We sent a {CODE_LENGTH}-digit code to{" "}
              <span className="text-sm text-text-primary" style={MONO_FONT}>
                {email.trim()}
              </span>
              .
            </>
          }
        />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void verify(code);
          }}
          className="grid gap-2.5"
        >
          <FieldLabel htmlFor="boot-code">Code</FieldLabel>
          <input
            ref={codeInputRef}
            id="boot-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={CODE_LENGTH}
            value={code}
            disabled={busy}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH);
              setCode(digits);
              if (digits.length === CODE_LENGTH) void verify(digits);
            }}
            placeholder={"•".repeat(CODE_LENGTH)}
            className="h-16 w-full border border-solid border-cyan bg-near-black px-4 text-center text-3xl font-bold tracking-[0.6em] text-text-primary outline-none placeholder:text-text-muted focus:border-[#9be7ff] disabled:opacity-60"
            style={MONO_FONT}
          />
          <p className="text-sm text-text-muted" style={DISPLAY_FONT}>
            {busy ? "Checking…" : "It signs you in as soon as the last digit is in."}
          </p>
        </form>
        <ErrorLine message={error} />
        <div className="flex flex-wrap items-center justify-between gap-2" style={MONO_FONT}>
          <button type="button" onClick={() => goTo("email")} className={QUIET_LINK}>
            ‹ Use a different email
          </button>
          <button
            type="button"
            onClick={() => void resend()}
            disabled={resendIn > 0}
            className="min-h-11 text-xs font-bold uppercase tracking-[0.08em] text-cyan disabled:text-text-muted"
          >
            {resendIn > 0 ? `Resend code (0:${String(resendIn).padStart(2, "0")})` : "Resend code"}
          </button>
        </div>
      </Panel>
    )}

    {step === "setup" && (
      <Panel color="var(--color-phosphor-green)">
        <PanelHeading color="var(--color-phosphor-green)" title="Welcome aboard, Commander" />
        {setupStalled ? (
          <>
            <p className="text-base text-text-secondary" style={DISPLAY_FONT}>
              This is taking longer than it should.
            </p>
            <button type="button" onClick={() => void restart()} className={PRIMARY_BUTTON} style={MONO_FONT}>
              Try again
            </button>
          </>
        ) : (
          <>
            <ul className="grid gap-3 text-[13px] uppercase tracking-[0.06em]" style={MONO_FONT}>
              <li className="flex items-center gap-3 text-text-bright">
                <span aria-hidden="true" className="text-phosphor-green">✓</span> Signed in
              </li>
              <li className="flex items-center gap-3 text-cyan">
                <span aria-hidden="true" className="inline-block h-3 w-3 animate-spin border-2 border-solid border-cyan border-t-transparent" />
                Bringing your fleet online…
              </li>
            </ul>
            <p className="text-sm text-text-muted" style={DISPLAY_FONT}>
              Just a few seconds. You won&apos;t need to do this again on this device.
            </p>
          </>
        )}
      </Panel>
    )}

    {step === "wallets" && (
      <Panel color="var(--color-amber)">
        <PanelHeading
          color="var(--color-amber)"
          title="Browser wallet"
          body="You'll approve each move in your wallet."
        />
        {installedWallets.length > 0 && (
          <div className="grid gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-text-secondary" style={MONO_FONT}>
              Found in this browser
            </span>
            {installedWallets.map((option, i) => (
              <WalletRow
                key={option.key}
                label={option.groupName ?? option.name}
                highlighted={i === 0}
                disabled={busy}
                onClick={() => void connectBrowserWallet(option.key)}
                icon={
                  option.metadata?.icon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={option.metadata.icon} alt="" className="h-7 w-7 object-contain" />
                  ) : (
                    <span className="h-7 w-7 bg-steel" />
                  )
                }
                tag={
                  <span className="text-[11px] uppercase tracking-[0.1em] text-phosphor-green">Detected</span>
                }
              />
            ))}
          </div>
        )}
        <div className="grid gap-1.5">
          {installedWallets.length > 0 && (
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-text-secondary" style={MONO_FONT}>
              Other
            </span>
          )}
          <WalletRow
            label={installedWallets.length > 0 ? "More wallets, including phone wallets" : "Choose a wallet"}
            highlighted={installedWallets.length === 0}
            disabled={busy}
            onClick={() => {
              posthog.capture("sign_in_browser_wallet_more", { surface });
              void openDynamicAuthFlow();
            }}
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className="text-text-secondary">
                <circle cx="6" cy="12" r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="18" cy="12" r="1.5" />
              </svg>
            }
            tag={<span className="text-text-muted">›</span>}
          />
        </div>
        <ErrorLine message={error} />
      </Panel>
    )}

    <div className="grid justify-items-center gap-1 text-center" style={MONO_FONT}>
      {step === "email" && (
        <button
          type="button"
          onClick={() => {
            posthog.capture("sign_in_browser_wallet_link_clicked", { surface });
            setNoticeOpen(true);
          }}
          className="inline-flex min-h-11 items-center px-3 text-xs uppercase tracking-[0.08em] text-text-secondary hover:text-text-bright"
        >
          Have a browser wallet?<span className="ml-1.5 text-cyan">Connect it ›</span>
        </button>
      )}
      {step === "wallets" && (
        <button type="button" onClick={() => goTo("email")} className={QUIET_LINK}>
          ‹ Sign in with email instead
        </button>
      )}
    </div>

    {noticeOpen && <BrowserWalletNotice onUseEmbedded={chooseEmbedded} onContinue={continueWithBrowserWallet} />}
    </>
  );
}

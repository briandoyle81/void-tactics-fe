"use client";

import { useOpenWalletSignIn } from "../hooks/useOpenWalletSignIn";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAccount, useBalance, useConfig, useReadContract } from "wagmi";
import { DynamicUserProfile, useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { formatEther } from "viem";
import { toast } from "react-hot-toast";
import { CONTRACT_ADDRESSES, CONTRACT_ABIS } from "../config/contracts";
import type { Abi } from "viem";
import {
  DEFAULT_CHAIN_ID,
  getSelectedChainId,
  getNativeTokenSymbol,
  getVariantForChainId,
  isChainSelectableInUi,
  isSupportedChainId,
  setSelectedChainId,
  SUPPORTED_CHAINS,
  VOID_TACTICS_CHAIN_CHANGED_EVENT,
} from "../config/networks";
import { switchWalletToAppChain } from "../utils/switchWalletChain";
import { readRpcErrorCode } from "../utils/ensureUiChainsInWallet";
import { HeaderAlphaBadge, HeaderDiscordLink, HeaderXLink, VOID_TACTICS_X_URL } from "./BrandLinks";
import { ALPHA_DISCORD_INVITE_URL, WEB2_SIGN_IN_ENABLED } from "../config/alpha";
import { useFreeShipClaimStatus } from "../hooks/useFreeShipClaimStatus";
import type { StoreSection } from "./storeSections";
import { useGameMusic } from "../hooks/useGameMusic";
import { useSoundEffectsSetting } from "../hooks/useSoundEffects";
import { useDebugModeSetting } from "../hooks/useDebugMode";
import { formatDec } from "../utils/formatDec";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useUserBalanceWeb2 } from "../hooks/useUserBalanceWeb2";
import { setAppMode, type AppMode } from "../config/appMode";
import { useAppMode } from "../hooks/useAppMode";
import { signOut } from "next-auth/react";
import posthog from "posthog-js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { navigateToClientTab } from "../utils/clientNavigation";
import { useOpsConsoleAccess } from "../hooks/useOpsConsoleAccess";
import { ADMIN_PATH, WEBSITE_HREF } from "../config/routes";
import { GAME_CONTENT_MAX_WIDTH_CLASS } from "../config/contentWidth";
import AuthSignIn from "./AuthSignIn";
import { PasskeyEnablePrompt } from "./PasskeyEnablePrompt";
import { CopyAddressButton } from "./CopyAddressButton";
import { ETH_DISPLAY_DECIMALS, UTC_DISPLAY_DECIMALS, formatBalance, formatBalanceCompact } from "../utils/formatBalance";
import { openRecoveryCodes, RecoveryCodesHost } from "./RecoveryCodesModal";

function resolveChainIdFromQueryParam(value: string | null): number | null {
  if (!value) return null;
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");
  const numeric = Number(normalized);
  if (Number.isFinite(numeric) && isChainSelectableInUi(numeric)) {
    return numeric;
  }
  const byName: Record<string, number> = {
    flow: 545,
    "flow-testnet": 545,
    ronin: 2021,
    saigon: 2021,
    "ronin-saigon": 2021,
    base: 84532,
    "base-sepolia": 84532,
    xai: 37714555429,
    "xai-testnet": 37714555429,
    "xai-testnet-v2": 37714555429,
  };
  const chainId = byName[normalized];
  return typeof chainId === "number" && isChainSelectableInUi(chainId)
    ? chainId
    : null;
}

function dispatchNavigateToProfile(push: (href: string) => void) {
  navigateToClientTab("Profile", "void-tactics-navigate-to-profile", push);
}

function HeaderMenuItem({
  children,
  onClick,
  title,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="flex h-8 w-full items-center px-3 text-left text-[11px] font-bold uppercase tracking-wider transition-colors duration-150"
      style={{
        fontFamily: "var(--font-jetbrains-mono), 'Courier New', monospace",
        color: danger ? "var(--color-warning-red)" : "var(--color-cyan)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = "var(--color-slate)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "transparent";
      }}
    >
      {children}
    </button>
  );
}

function HeaderLogoutButton({
  onBeforeLogOut,
  className,
  style,
  onMouseEnter,
  onMouseLeave,
  children,
}: {
  onBeforeLogOut?: () => void;
  className?: string;
  style?: React.CSSProperties;
  onMouseEnter?: React.MouseEventHandler<HTMLButtonElement>;
  onMouseLeave?: React.MouseEventHandler<HTMLButtonElement>;
  children: React.ReactNode;
}) {
  const { handleLogOut } = useDynamicContext();

  const handleClick = async () => {
    try {
      onBeforeLogOut?.();
      await handleLogOut();
      toast.success("Successfully disconnected!");
    } catch (error) {
      console.error("Error disconnecting:", error);
      toast.error("Failed to disconnect. Please try again.");
    }
  };

  return (
    <button
      onClick={handleClick}
      className={className}
      style={style}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </button>
  );
}

function HeaderDisconnectedConnect({
  connectButtonClassName,
}: {
  connectButtonClassName: string;
}) {
  const openWalletSignIn = useOpenWalletSignIn();

  return (
    <button
      onClick={() => void openWalletSignIn()}
      type="button"
      className={connectButtonClassName}
      style={{
        fontFamily: "var(--font-rajdhani), 'Arial Black', sans-serif",
        borderColor: "var(--color-cyan)",
        color: "var(--color-cyan, #56d6ff)",
        backgroundColor: "var(--color-steel)",
        borderRadius: 0,
      }}
    >
      Web3 // Wallet
    </button>
  );
}

/** Wallet-connect + Web2 sign-in choice. "What's the difference?" pops the
 * comparison cards up as an anchored overlay right below the buttons — it
 * never pushes the rest of the page down. */
function AuthModeChooser({
  connectButtonClassName,
}: {
  connectButtonClassName: string;
}) {
  const [showComparison, setShowComparison] = useState(false);

  // Google sign-in hidden (WEB2_SIGN_IN_ENABLED): just the wallet.
  if (!WEB2_SIGN_IN_ENABLED) {
    return (
      <div className="relative flex flex-col gap-2 md:ml-auto w-full md:w-auto pt-1 md:pt-0">
        <HeaderDisconnectedConnect connectButtonClassName={connectButtonClassName} />
      </div>
    );
  }

  return (
    <div className="relative flex flex-col gap-2 md:ml-auto w-full md:w-auto pt-1 md:pt-0">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
        <HeaderDisconnectedConnect
          connectButtonClassName={connectButtonClassName}
        />
        <span className="text-center text-xs font-mono text-cyan uppercase tracking-wider">
          or
        </span>
        <AuthSignIn />
      </div>
      <button
        type="button"
        onClick={() => setShowComparison((v) => !v)}
        className="relative z-[351] text-center text-[11px] font-mono uppercase tracking-wider underline"
        style={{ color: "var(--color-cyan)" }}
      >
        What&apos;s the difference?
      </button>

      {showComparison && (
        <>
          <div
            className="fixed inset-0 z-[340]"
            onClick={() => setShowComparison(false)}
            aria-hidden="true"
          />
          <div
            className="absolute right-0 top-full z-[350] mt-2 w-[min(95vw,64rem)] max-h-[75vh] overflow-y-auto border border-solid p-5"
            style={{
              backgroundColor: "var(--color-near-black)",
              borderColor: "var(--color-gunmetal)",
              borderTopColor: "var(--color-steel)",
              borderLeftColor: "var(--color-steel)",
            }}
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="font-mono text-sm uppercase tracking-wider text-text-muted">
                Web3 vs Web2
              </span>
              <button
                type="button"
                onClick={() => setShowComparison(false)}
                className="font-mono text-sm text-text-muted transition-colors duration-150 hover:text-cyan"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                className="border-2 p-4"
                style={{
                  borderColor: "var(--color-cyan)",
                  backgroundColor:
                    "color-mix(in srgb, var(--color-cyan) 6%, transparent)",
                }}
              >
                <h5
                  className="font-mono text-lg font-bold uppercase tracking-wider mb-1"
                  style={{ color: "var(--color-cyan)" }}
                >
                  Web3 // Wallet
                </h5>
                <p className="font-mono text-sm uppercase tracking-wider text-text-muted mb-3">
                  On-chain
                </p>
                <ul className="text-base text-text-secondary space-y-2 list-disc list-inside">
                  <li>True on-chain ownership — every ship is really yours</li>
                  <li>Safe and permissionless modding and data access</li>
                  <li>Permanent, provably fair battle history</li>
                </ul>
              </div>
              <div
                className="border-2 p-4"
                style={{
                  borderColor: "var(--color-amber)",
                  backgroundColor:
                    "color-mix(in srgb, var(--color-amber) 6%, transparent)",
                }}
              >
                <h5
                  className="font-mono text-lg font-bold uppercase tracking-wider mb-1"
                  style={{ color: "var(--color-amber)" }}
                >
                  Web2 // Email
                </h5>
                <p className="font-mono text-sm uppercase tracking-wider text-text-muted mb-3">
                  Hosted
                </p>
                <ul className="text-base text-text-secondary space-y-2 list-disc list-inside">
                  <li>Playing your first battle in under a minute</li>
                  <li>Zero cost to start</li>
                  <li>Just your Google account — nothing else to set up</li>
                </ul>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** Shown when both a wallet and a Web2 session are active, so switching
 * data layers is an explicit player action instead of a silent side effect
 * of whichever login happened most recently. */
function HeaderModeSwitchBadge({
  currentMode,
  identityLabel,
}: {
  currentMode: AppMode;
  identityLabel: string;
}) {
  const otherMode: AppMode = currentMode === "web3" ? "web2" : "web3";
  const otherLabel = otherMode === "web3" ? "Web3" : "Web2";

  const handleSwitch = () => {
    setAppMode(otherMode);
    toast(
      otherMode === "web2"
        ? "Switched to Web2. Your on-chain fleet stays put — switch back to see it."
        : "Switched to Web3. Your Web2 fleet stays put — switch back to see it.",
      { icon: "⚠️", duration: 5000 },
    );
  };

  return (
    <div
      className="flex items-center justify-between gap-2 px-3 py-1.5 border border-solid"
      style={{
        backgroundColor: "var(--color-near-black)",
        borderColor: "var(--color-gunmetal)",
      }}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span
          className="shrink-0 border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider"
          style={{
            borderColor: "var(--color-cyan)",
            color: "var(--color-cyan, #56d6ff)",
          }}
        >
          Mode: {currentMode === "web3" ? "Web3" : "Web2"}
        </span>
        <span className="truncate font-mono text-[10px] text-text-muted">
          {identityLabel}
        </span>
      </div>
      <button
        type="button"
        onClick={handleSwitch}
        className="shrink-0 font-mono text-[10px] text-text-muted underline transition-colors duration-150 hover:text-cyan"
      >
        Switch to {otherLabel} →
      </button>
    </div>
  );
}

/**
 * The VOID TACTICS title. Signed in it opens the Command Deck; signed out
 * (no deck to go to) it goes back to the website, as a full page load
 * since the website can be on another host (WEBSITE_HREF).
 */
function HeaderTitleBlock({ isSignedIn }: { isSignedIn: boolean }) {
  const router = useRouter();
  const content = (
    <>
      <span
        className="block text-xl font-black uppercase leading-none tracking-[0.06em] md:text-2xl"
        style={{
          fontFamily: "var(--font-rajdhani), 'Arial Black', sans-serif",
          color: "var(--color-text-primary, #e2e8f0)",
        }}
      >
        VOID TACTICS
      </span>
      <span
        className="absolute -bottom-1 left-0 right-0 h-0.5"
        style={{ backgroundColor: "var(--color-cyan)" }}
      />
    </>
  );
  const className = "relative block w-fit shrink-0 border-0 bg-transparent p-0 text-left";
  if (!isSignedIn) {
    return (
      <a href={WEBSITE_HREF} aria-label="Void Tactics home" className={className}>
        {content}
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={() =>
        navigateToClientTab("Command Deck", "void-tactics-navigate-to-info", router.push)
      }
      aria-label="Go to the Command Deck"
      className={className}
    >
      {content}
    </button>
  );
}

const MONO_FONT = "var(--font-jetbrains-mono), 'Courier New', monospace";

/** A resource in the HUD: label, balance, and a + that tops it up. */
function ResourcePill({
  label,
  value,
  compactValue,
  color,
  title,
  plus,
  className = "",
}: {
  label: string;
  value: string;
  /** Shown instead of `value` on phones (below sm), e.g. "1.2k". */
  compactValue?: string;
  color: string;
  title: string;
  plus?: { title: string; onClick?: () => void; href?: string; disabled?: boolean };
  className?: string;
}) {
  // The + fills the pill's height (32px tall with the border) for a
  // full-size tap target.
  const plusClass =
    "flex w-8 shrink-0 self-stretch items-center justify-center text-sm font-bold leading-none transition-colors duration-150 hover:bg-slate disabled:cursor-default disabled:opacity-40";
  const plusStyle = {
    backgroundColor: "var(--color-steel)",
    color: "var(--color-phosphor-green)",
  };
  return (
    <div
      className={`flex h-8 shrink-0 items-center gap-1.5 border border-solid pl-2 ${plus ? "" : "pr-2"} ${className}`}
      style={{
        backgroundColor: "var(--color-near-black)",
        borderColor: "var(--color-gunmetal)",
      }}
      title={title}
    >
      {/* Phones show a swatch in the resource's colour instead of the label
          (the full name is in the title). */}
      <span className="h-2 w-2 shrink-0 sm:hidden" style={{ backgroundColor: color }} aria-hidden />
      <span
        className="hidden text-[10px] font-bold uppercase tracking-wider sm:inline"
        style={{ fontFamily: MONO_FONT, color }}
      >
        {label}
      </span>
      <span
        className="text-xs font-semibold tabular-nums"
        style={{ fontFamily: MONO_FONT, color: "var(--color-text-primary)" }}
      >
        {compactValue != null ? (
          <>
            <span className="sm:hidden">{compactValue}</span>
            <span className="hidden sm:inline">{value}</span>
          </>
        ) : (
          value
        )}
      </span>
      {plus &&
        (plus.href ? (
          <a
            href={plus.href}
            target="_blank"
            rel="noopener noreferrer"
            className={plusClass}
            style={plusStyle}
            title={plus.title}
            aria-label={plus.title}
          >
            +
          </a>
        ) : (
          <button
            type="button"
            onClick={plus.onClick}
            disabled={plus.disabled}
            className={plusClass}
            style={plusStyle}
            title={plus.title}
            aria-label={plus.title}
          >
            +
          </button>
        ))}
    </div>
  );
}

/**
 * The HUD's resource pills, scrolling sideways when they don't fit (its
 * scrollbar is hidden). The right edge fades while there's more to scroll
 * to, so a cut-off pill reads as more rather than as the end.
 */
function HudPillRow({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [moreRight, setMoreRight] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setMoreRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    update();
    el.addEventListener("scroll", update, { passive: true });
    // The row resizing, and its pills changing (a balance update, a pill
    // mounting), both change whether it overflows.
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(el);
    const mutationObserver = new MutationObserver(update);
    mutationObserver.observe(el, { childList: true, subtree: true, characterData: true });
    return () => {
      el.removeEventListener("scroll", update);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, []);
  return (
    <div
      ref={ref}
      className="flex min-w-0 items-center gap-1.5 overflow-x-auto md:gap-2 [scrollbar-width:none]"
      style={
        moreRight
          ? {
              maskImage: "linear-gradient(to right, black calc(100% - 1.5rem), transparent)",
              WebkitMaskImage: "linear-gradient(to right, black calc(100% - 1.5rem), transparent)",
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}

function HudIconButton({
  label,
  onClick,
  children,
  badge,
  expanded,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  badge?: number;
  expanded?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-expanded={expanded}
      className="relative flex h-8 w-8 shrink-0 items-center justify-center border border-solid transition-colors duration-150 hover:bg-slate"
      style={{
        color: "var(--color-cyan)",
        backgroundColor: "var(--color-near-black)",
        borderColor: "var(--color-gunmetal)",
      }}
    >
      {children}
      {badge != null && badge > 0 && (
        <span
          className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center px-1 text-[10px] font-bold leading-none"
          style={{
            fontFamily: MONO_FONT,
            backgroundColor: "var(--color-phosphor-green)",
            color: "var(--color-near-black)",
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

/**
 * The HUD's free-ships countdown. Its own component so the countdown's
 * updates re-render only this pill, not the whole HUD.
 */
function HudFreeShipsPill({ onOpen }: { onOpen: () => void }) {
  const freeShips = useFreeShipClaimStatus();
  if (freeShips.isLoading || freeShips.hasError) return null;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex h-8 shrink-0 items-center gap-1.5 border border-solid px-2 transition-colors duration-150 hover:bg-slate"
      style={{
        backgroundColor: "var(--color-near-black)",
        borderColor: freeShips.isEligible ? "var(--color-phosphor-green)" : "var(--color-gunmetal)",
      }}
      title={freeShips.isEligible ? "Free ships ready to claim" : "Time until your next free ships"}
    >
      <span
        className="hidden text-[10px] font-bold uppercase tracking-wider text-phosphor-green sm:inline"
        style={{ fontFamily: MONO_FONT }}
      >
        Free ships
      </span>
      <span className="text-xs font-semibold tabular-nums text-text-primary" style={{ fontFamily: MONO_FONT }}>
        {freeShips.isEligible ? "Ready" : (freeShips.nextClaimInFormatted ?? "—")}
      </span>
    </button>
  );
}

function SettingsHeading({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="px-3 pb-1 pt-3 text-[10px] uppercase tracking-widest text-text-muted"
      style={{ fontFamily: MONO_FONT }}
    >
      {children}
    </div>
  );
}

function SettingsLink({
  href,
  children,
  external,
}: {
  href: string;
  children: React.ReactNode;
  external?: boolean;
}) {
  const className =
    "flex h-8 w-full items-center px-3 text-left text-[11px] font-bold uppercase tracking-wider text-cyan transition-colors duration-150 hover:bg-slate";
  const style = { fontFamily: MONO_FONT };
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className} style={style}>
      {children}
    </a>
  ) : (
    <Link href={href} className={className} style={style}>
      {children}
    </Link>
  );
}

interface HeaderProps {
  /** Games where it's the player's turn — shown on the bell. The bell is
   * hidden where the count isn't known (pages outside the game client). */
  yourTurnCount?: number;
  /** Show the sign-in choice when signed out. The client's boot screen has
   * its own, so it turns this off. */
  showSignIn?: boolean;
}

/**
 * The game client's HUD: identity, resource pills (each + tops that
 * resource up), the your-turn bell and the settings menu (account, network,
 * lottery, Ops Console, community and legal links).
 */
const Header: React.FC<HeaderProps> = ({ yourTurnCount, showSignIn = true }) => {
  const [isHydrated, setIsHydrated] = useState(false);
  const [hasVariantMismatch, setHasVariantMismatch] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [matchViewOpen, setMatchViewOpen] = useState(false);
  const settingsMenuRef = useRef<HTMLDivElement | null>(null);

  const account = useAccount();
  const router = useRouter();
  const { hasAccess: hasOpsConsoleAccess } = useOpsConsoleAccess();
  const config = useConfig();
  const { setShowDynamicUserProfile, user: dynamicUser } = useDynamicContext();
  // Recovery codes only exist once the account has a passkey.
  const hasPasskey = dynamicUser?.verifiedCredentials?.some((vc) => vc.format === "passkey") ?? false;

  const [selectedChainId, setSelectedChainIdState] = useState<number>(() => {
    if (typeof window === "undefined") return DEFAULT_CHAIN_ID;
    return getSelectedChainId();
  });
  const pendingSwitchChainIdRef = useRef<number | null>(null);
  /** When true, do not overwrite the header picker from `account.chainId` while storage still targets another network. */
  const userChoseNetworkThisSessionRef = useRef(false);
  const lastSwitchRequestRef = useRef<{ chainId: number; at: number } | null>(
    null,
  );
  const lastVariantWarningKeyRef = useRef<string | null>(null);
  /** Apply `?chain=` / `?network=` only once so manual picks are not overwritten on every change. */
  const urlChainQueryConsumedRef = useRef(false);

  const nativeTokenSymbol = getNativeTokenSymbol(selectedChainId);
  const selectedChainVariant = getVariantForChainId(selectedChainId);
  const headerReadsEnabled = isHydrated && !matchViewOpen;
  const { data: balance } = useBalance({
    address: account.address,
    chainId: selectedChainId,
    query: {
      enabled: headerReadsEnabled && !!account.address,
      refetchOnWindowFocus: false,
      notifyOnChangeProps: ["data", "error"],
    },
  });

  const maxVariantConfig = useMemo(
    () => ({
      address: CONTRACT_ADDRESSES.SHIPS as `0x${string}`,
      abi: CONTRACT_ABIS.SHIPS as Abi,
      functionName: "maxVariant" as const,
      chainId: selectedChainId,
      query: {
        enabled: headerReadsEnabled && isSupportedChainId(selectedChainId),
        refetchOnWindowFocus: false,
      },
    }),
    [headerReadsEnabled, selectedChainId],
  );

  const { data: maxVariant } = useReadContract(maxVariantConfig);

  // Read UTC balance
  const { data: utcBalance } = useReadContract({
    address: CONTRACT_ADDRESSES.UNIVERSAL_CREDITS as `0x${string}`,
    abi: CONTRACT_ABIS.UNIVERSAL_CREDITS as Abi,
    functionName: "balanceOf",
    args: account.address ? [account.address] : undefined,
    chainId: selectedChainId,
    query: {
      enabled: headerReadsEnabled && !!account.address,
      refetchOnWindowFocus: false,
      notifyOnChangeProps: ["data", "error"],
    },
  });

  // Read Drone Cores balance — DroneEnergyCores is only deployed on Base
  // Sepolia so far (resolves to the zero address on other chains), so gate
  // the read on that rather than firing a doomed call and showing a
  // misleading "0.00" on chains where the contract doesn't exist at all.
  const droneEnergyCoresAddress = CONTRACT_ADDRESSES.DRONE_ENERGY_CORES as
    | `0x${string}`
    | undefined;
  const isDroneEnergyCoresDeployed =
    !!droneEnergyCoresAddress &&
    droneEnergyCoresAddress.toLowerCase() !==
      "0x0000000000000000000000000000000000000000";
  const { data: droneCoresBalance } = useReadContract({
    address: droneEnergyCoresAddress,
    abi: CONTRACT_ABIS.DRONE_ENERGY_CORES as Abi,
    functionName: "balanceOf",
    args: account.address ? [account.address] : undefined,
    chainId: selectedChainId,
    query: {
      enabled: headerReadsEnabled && !!account.address && isDroneEnergyCoresDeployed,
      refetchOnWindowFocus: false,
      notifyOnChangeProps: ["data", "error"],
    },
  });

  // Hydration safety
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    const onDetail = (event: Event) => {
      const custom = event as CustomEvent<{ active?: boolean }>;
      const active = Boolean(custom.detail?.active);
      setMatchViewOpen(active);
      if (active) setIsSettingsOpen(false);
    };
    window.addEventListener("void-tactics-games-detail-active", onDetail);
    return () =>
      window.removeEventListener("void-tactics-games-detail-active", onDetail);
  }, []);

  // Support links like `/?chain=ronin-saigon` to preselect network (once per page load).
  useEffect(() => {
    if (!isHydrated) return;
    if (urlChainQueryConsumedRef.current) return;

    const params = new URLSearchParams(window.location.search);
    const requestedChain =
      resolveChainIdFromQueryParam(params.get("chain")) ??
      resolveChainIdFromQueryParam(params.get("network"));

    if (requestedChain == null) {
      urlChainQueryConsumedRef.current = true;
      return;
    }

    const stored = getSelectedChainId();
    if (requestedChain === stored) {
      urlChainQueryConsumedRef.current = true;
      return;
    }

    urlChainQueryConsumedRef.current = true;
    setSelectedChainId(requestedChain);
    setSelectedChainIdState(requestedChain);
    userChoseNetworkThisSessionRef.current = true;
    pendingSwitchChainIdRef.current = requestedChain;
    lastSwitchRequestRef.current = { chainId: requestedChain, at: Date.now() };
  }, [isHydrated]);

  // Check if wallet is connecting
  const isConnecting =
    account.status === "connecting" || account.status === "reconnecting";

  // Keep selected chain in sync with wallet chain after a successful switch/connect.
  useEffect(() => {
    if (!isHydrated) return;
    if (account.status !== "connected") return;
    if (!isSupportedChainId(account.chainId)) return;
    if (
      pendingSwitchChainIdRef.current &&
      account.chainId !== pendingSwitchChainIdRef.current
    ) {
      return;
    }

    pendingSwitchChainIdRef.current = null;
    if (selectedChainId !== account.chainId) {
      // Only sync app selection to the wallet chain when that chain is enabled in the UI picker.
      if (!isChainSelectableInUi(account.chainId)) return;
      // After the user picks a network here, do not snap the picker back to the old wallet chain
      // while localStorage still matches their choice (switch in flight or MetaMask lag).
      const storedTarget = getSelectedChainId();
      if (
        userChoseNetworkThisSessionRef.current &&
        isChainSelectableInUi(storedTarget) &&
        storedTarget !== account.chainId
      ) {
        return;
      }
      setSelectedChainId(account.chainId);
      setSelectedChainIdState(account.chainId);
    }
  }, [isHydrated, account.status, account.chainId, selectedChainId]);

  // Warn if chain variant mapping is incompatible with deployed contract config.
  useEffect(() => {
    if (!isHydrated || maxVariant == null) {
      setHasVariantMismatch(false);
      return;
    }
    const maxVariantNumber = Number(maxVariant);
    if (!Number.isFinite(maxVariantNumber)) {
      setHasVariantMismatch(false);
      return;
    }
    if (selectedChainVariant <= maxVariantNumber) {
      setHasVariantMismatch(false);
      return;
    }

    setHasVariantMismatch(true);

    const warningKey = `${selectedChainId}:${selectedChainVariant}:${maxVariantNumber}`;
    if (lastVariantWarningKeyRef.current === warningKey) return;
    lastVariantWarningKeyRef.current = warningKey;

    toast.error(
      `Network variant mismatch: selected variant ${selectedChainVariant} exceeds contract maxVariant ${maxVariantNumber}. Claims and purchases may fail until mapping is updated.`,
      { duration: 8000 },
    );
  }, [isHydrated, maxVariant, selectedChainId, selectedChainVariant]);

  // Resolve an explicit user-initiated network switch request.
  useEffect(() => {
    if (!isHydrated) return;
    const pending = pendingSwitchChainIdRef.current;
    if (pending == null) return;
    if (account.status !== "connected") return;
    if (!isSupportedChainId(pending)) return;
    if (account.chainId === pending) {
      pendingSwitchChainIdRef.current = null;
      return;
    }

    // Avoid spamming switch requests while a wallet prompt is pending
    const now = Date.now();
    const last = lastSwitchRequestRef.current;
    if (last && last.chainId === pending && now - last.at < 2000) {
      return;
    }
    lastSwitchRequestRef.current = { chainId: pending, at: now };
    const connector = account.connector;
    if (!connector) return;
    void switchWalletToAppChain(config, connector, pending).catch((err) => {
      console.error("Network switch failed:", err);
      const code = readRpcErrorCode(err);
      toast.error(
        err instanceof Error
          ? `${err.message}${code != null ? ` (code ${code})` : ""}`
          : "Could not switch network",
      );
    });
  }, [account.status, account.chainId, account.connector, config, isHydrated]);

  const handleNetworkChange = (nextId: number) => {
    if (!isChainSelectableInUi(nextId)) {
      toast.error("This network is unavailable for now");
      return;
    }
    setSelectedChainId(nextId);
    setSelectedChainIdState(nextId);
    userChoseNetworkThisSessionRef.current = true;
    pendingSwitchChainIdRef.current = nextId;
    lastSwitchRequestRef.current = { chainId: nextId, at: Date.now() };
    if (
      isHydrated &&
      account.status === "connected" &&
      account.chainId !== nextId &&
      account.connector
    ) {
      void switchWalletToAppChain(config, account.connector, nextId).catch(
        (err) => {
          console.error("Network switch failed:", err);
          const code = readRpcErrorCode(err);
          toast.error(
            err instanceof Error
              ? `${err.message}${code != null ? ` (code ${code})` : ""}`
              : "Could not switch network",
          );
        },
      );
    }
    setIsSettingsOpen(false);
  };

  useEffect(() => {
    const handleChainChanged = () => {
      setIsSettingsOpen(false);
    };
    window.addEventListener(
      VOID_TACTICS_CHAIN_CHANGED_EVENT,
      handleChainChanged,
    );
    return () => {
      window.removeEventListener(
        VOID_TACTICS_CHAIN_CHANGED_EVENT,
        handleChainChanged,
      );
    };
  }, []);

  useEffect(() => {
    if (!isSettingsOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(target)) {
        setIsSettingsOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsSettingsOpen(false);
    };
    window.addEventListener("keydown", handleEscape);

    window.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isSettingsOpen]);

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}…${address.slice(-4)}`;
  };

  const handleBeforeLogOut = React.useCallback(() => {
    userChoseNetworkThisSessionRef.current = false;
  }, []);

  const isConnected = account.isConnected;
  const {
    isLoggedIn: isWeb2LoggedIn,
    username: web2Username,
    email: web2Email,
  } = useCurrentUser();
  const { creditBalance, decBalance } = useUserBalanceWeb2();
  const appMode = useAppMode();

  // True once a wallet is connected AND a Web2 session is also active —
  // the ambiguous case where the mode can no longer be inferred from
  // "whichever login just happened."
  const bothIdentitiesActive = isConnected && isWeb2LoggedIn;
  const showWeb2Panel =
    (!isConnected && isWeb2LoggedIn) ||
    (bothIdentitiesActive && appMode === "web2");
  const showWeb3Panel =
    isConnected && !(bothIdentitiesActive && appMode === "web2");

  // The login method the player actually used is the mode signal — keep the
  // app-mode toggle in sync so the rest of the app renders the right data
  // layer. Only auto-assign when there's no ambiguity (exactly one identity
  // active); when both a wallet and a Web2 session are active, leave the
  // current mode alone — HeaderModeSwitchBadge lets the player switch
  // explicitly instead of the app silently reassigning it out from under them.
  useEffect(() => {
    if (isConnected && isWeb2LoggedIn) return;
    if (isConnected) {
      setAppMode("web3");
    } else if (isWeb2LoggedIn) {
      setAppMode("web2");
    }
  }, [isConnected, isWeb2LoggedIn]);

  const music = useGameMusic();
  const soundEffects = useSoundEffectsSetting();
  const debugMode = useDebugModeSetting();
  const isSignedIn = showWeb2Panel || showWeb3Panel;
  const callsign = showWeb2Panel
    ? (web2Username ?? web2Email ?? "Commander")
    : formatAddress(account.address || "");
  const initials = showWeb2Panel
    ? callsign.slice(0, 2).toUpperCase()
    : (account.address ?? "").slice(2, 4).toUpperCase();

  const openCommandDeck = () =>
    navigateToClientTab("Command Deck", "void-tactics-navigate-to-info", router.push);
  const openBattles = () =>
    navigateToClientTab("Games", "void-tactics-navigate-to-games", router.push);
  /** The HUD's + buttons open the matching Store sub-tab. */
  const openStore = (section: StoreSection) =>
    navigateToClientTab("Store", "void-tactics-navigate-to-store", router.push, { section });

  const closeSettings = () => setIsSettingsOpen(false);

  const utcValue = showWeb2Panel
    ? creditBalance
    : utcBalance
      ? Number(formatEther(utcBalance as bigint))
      : 0;
  const decValue = showWeb2Panel
    ? decBalance
    : droneCoresBalance
      ? Number(formatEther(droneCoresBalance as bigint))
      : 0;
  const nativeValue = balance?.value ? Number(balance.formatted) : 0;

  const menuItemClass =
    "flex h-8 w-full items-center px-3 text-left text-[11px] font-bold uppercase tracking-wider transition-colors duration-150 hover:bg-slate";

  return (
    <header
      className="relative z-[300] border-b-2 border-solid"
      style={{
        backgroundColor: "var(--color-slate, #1a2430)",
        borderColor: "var(--color-gunmetal, #2b2f36)",
        borderTopColor: "var(--color-steel, #223041)",
      }}
    >
      <div
        className={`mx-auto flex ${GAME_CONTENT_MAX_WIDTH_CLASS} items-center gap-2 px-3 py-2 sm:px-6 md:gap-4 lg:px-10`}
      >
        <div className={isSignedIn ? "hidden md:block" : "block"}>
          <HeaderTitleBlock isSignedIn={isSignedIn} />
        </div>

        {isSignedIn && isHydrated && (
          <div className="hidden min-w-0 items-center gap-1 lg:flex">
            <button
              type="button"
              onClick={() => dispatchNavigateToProfile(router.push)}
              className="flex min-w-0 items-center gap-2 text-left"
              title="Profile"
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center border border-solid text-xs font-bold"
                style={{
                  fontFamily: MONO_FONT,
                  borderColor: "var(--color-cyan)",
                  color: "var(--color-cyan)",
                  backgroundColor: "var(--color-steel)",
                }}
                aria-hidden
              >
                {initials}
              </span>
              <span
                className="truncate text-sm font-semibold uppercase tracking-wider text-text-primary"
                style={{ fontFamily: "var(--font-rajdhani), 'Arial Black', sans-serif" }}
              >
                {callsign}
              </span>
            </button>
            {!showWeb2Panel && account.address && <CopyAddressButton address={account.address} />}
          </div>
        )}

        {!isSignedIn && (
          <div className="hidden items-center gap-2 sm:flex">
            <HeaderAlphaBadge compact />
            <HeaderDiscordLink compact />
            <HeaderXLink compact />
          </div>
        )}

        <div className="ml-auto flex min-w-0 items-center gap-1.5 md:gap-2">
          {isHydrated && isConnecting && (
            <span className="font-mono text-sm text-cyan/60">Connecting...</span>
          )}

          {isHydrated && !isConnecting && !isSignedIn && showSignIn && (
            <AuthModeChooser connectButtonClassName="px-4 py-1.5 border-2 border-solid uppercase font-semibold tracking-wider transition-colors duration-150 text-xs w-full md:w-auto" />
          )}

          {isHydrated && isSignedIn && (
            <>
              <HudPillRow>
                <ResourcePill
                  label="UTC"
                  value={formatBalance(utcValue, UTC_DISPLAY_DECIMALS)}
                  compactValue={formatBalanceCompact(utcValue)}
                  color="var(--color-amber)"
                  title="Universal Credits"
                  plus={{
                    title: "Buy UTC",
                    onClick: () => openStore("credits"),
                  }}
                />
                <ResourcePill
                  label="DEC"
                  value={showWeb3Panel && !isDroneEnergyCoresDeployed ? "N/A" : formatDec(decValue)}
                  compactValue={
                    showWeb3Panel && !isDroneEnergyCoresDeployed ? "N/A" : formatBalanceCompact(Math.floor(decValue))
                  }
                  color="var(--color-purple)"
                  title="Drone Energy Cores"
                  plus={{
                    title: "Drone Core storefront",
                    disabled: showWeb3Panel && !isDroneEnergyCoresDeployed,
                    onClick: () => openStore("cores"),
                  }}
                />
                {showWeb3Panel && (
                  <ResourcePill
                    label={nativeTokenSymbol}
                    value={formatBalance(nativeValue, ETH_DISPLAY_DECIMALS)}
                    color="var(--color-phosphor-green)"
                    title={`${nativeTokenSymbol} balance`}
                    className="hidden sm:flex"
                    plus={{
                      title: `Get ${nativeTokenSymbol}`,
                      onClick: () => openStore("credits"),
                    }}
                  />
                )}
                {/* Unmounted during a match so its reads and countdown stop. */}
                {!matchViewOpen && <HudFreeShipsPill onOpen={openCommandDeck} />}
              </HudPillRow>

              {yourTurnCount != null && (
                <HudIconButton
                  label={yourTurnCount > 0 ? `${yourTurnCount} battles waiting on you` : "Battles"}
                  onClick={openBattles}
                  badge={yourTurnCount}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                  </svg>
                </HudIconButton>
              )}

              <div ref={settingsMenuRef} className="relative">
                <HudIconButton
                  label="Settings"
                  onClick={() => setIsSettingsOpen((open) => !open)}
                  expanded={isSettingsOpen}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </HudIconButton>

                {isSettingsOpen && (
                  <div
                    className="absolute right-0 top-[calc(100%+6px)] z-[360] max-h-[80vh] w-[min(92vw,18rem)] overflow-y-auto border border-solid pb-2"
                    style={{
                      backgroundColor: "var(--color-near-black)",
                      borderColor: "var(--color-cyan)",
                      borderTopColor: "var(--color-steel)",
                      borderLeftColor: "var(--color-steel)",
                    }}
                    role="menu"
                    aria-label="Settings"
                  >
                    <SettingsHeading>Account</SettingsHeading>
                    <div className="flex items-center justify-between gap-2 px-3 pb-2">
                      <span className="truncate font-mono text-xs text-text-secondary">{callsign}</span>
                      {showWeb3Panel && (
                        <button
                          type="button"
                          onClick={() => {
                            void navigator.clipboard.writeText(account.address || "");
                            toast.success("Address copied to clipboard!");
                          }}
                          className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-text-muted hover:text-cyan"
                        >
                          Copy
                        </button>
                      )}
                    </div>
                    {bothIdentitiesActive && (
                      <div className="px-3 pb-2">
                        <HeaderModeSwitchBadge
                          currentMode={showWeb2Panel ? "web2" : "web3"}
                          identityLabel={
                            showWeb2Panel
                              ? (web2Username ?? web2Email ?? "Web2 account")
                              : formatAddress(account.address || "")
                          }
                        />
                      </div>
                    )}
                    <HeaderMenuItem
                      onClick={() => {
                        closeSettings();
                        dispatchNavigateToProfile(router.push);
                      }}
                    >
                      Profile
                    </HeaderMenuItem>
                    {showWeb3Panel && (
                      <HeaderMenuItem
                        title="Manage connected wallets, security, and passkeys"
                        onClick={() => {
                          closeSettings();
                          setShowDynamicUserProfile(true);
                        }}
                      >
                        My Account
                      </HeaderMenuItem>
                    )}
                    {showWeb3Panel && hasPasskey && (
                      <HeaderMenuItem
                        title="Codes for adding a passkey on another device"
                        onClick={() => {
                          closeSettings();
                          openRecoveryCodes();
                        }}
                      >
                        Recovery codes
                      </HeaderMenuItem>
                    )}
                    {hasOpsConsoleAccess && (
                      <Link
                        href={ADMIN_PATH}
                        onClick={closeSettings}
                        className={`${menuItemClass} text-amber`}
                        style={{ fontFamily: MONO_FONT }}
                      >
                        Ops Console
                      </Link>
                    )}
                    {showWeb3Panel ? (
                      <HeaderLogoutButton
                        onBeforeLogOut={() => {
                          closeSettings();
                          handleBeforeLogOut();
                        }}
                        className={`${menuItemClass} text-warning-red`}
                        style={{ fontFamily: MONO_FONT }}
                      >
                        Log Out
                      </HeaderLogoutButton>
                    ) : (
                      <HeaderMenuItem
                        danger
                        onClick={() => {
                          closeSettings();
                          posthog.capture("web2_sign_out_clicked");
                          void signOut();
                        }}
                      >
                        Sign Out
                      </HeaderMenuItem>
                    )}

                    {showWeb3Panel && (
                      <>
                        <SettingsHeading>Network</SettingsHeading>
                        {SUPPORTED_CHAINS.map((c) => {
                          const isActive = c.id === selectedChainId;
                          const selectable = isChainSelectableInUi(c.id);
                          return (
                            <button
                              key={c.id}
                              type="button"
                              disabled={!selectable || isConnecting}
                              title={selectable ? undefined : "Unavailable on this build"}
                              onClick={() => handleNetworkChange(c.id)}
                              className={`${menuItemClass} ${
                                isActive ? "bg-cyan text-near-black hover:bg-cyan" : "text-cyan"
                              } ${!selectable ? "cursor-not-allowed opacity-45" : ""}`}
                              style={{ fontFamily: MONO_FONT }}
                            >
                              {c.name}
                            </button>
                          );
                        })}

                        <SettingsHeading>Credits</SettingsHeading>
                        <HeaderMenuItem
                          onClick={() => {
                            closeSettings();
                            openStore("lottery");
                          }}
                        >
                          UTC Lottery
                        </HeaderMenuItem>
                      </>
                    )}

                    <SettingsHeading>Audio</SettingsHeading>
                    <button
                      type="button"
                      role="menuitemcheckbox"
                      aria-checked={music.enabled}
                      onClick={music.toggle}
                      className={`${menuItemClass} justify-between text-cyan`}
                      style={{ fontFamily: MONO_FONT }}
                    >
                      Music
                      <span className={music.enabled ? "text-phosphor-green" : "text-text-muted"}>
                        {music.enabled ? "On" : "Off"}
                      </span>
                    </button>
                    <button
                      type="button"
                      role="menuitemcheckbox"
                      aria-checked={soundEffects.enabled}
                      onClick={soundEffects.toggle}
                      className={`${menuItemClass} justify-between text-cyan`}
                      style={{ fontFamily: MONO_FONT }}
                    >
                      Sound effects
                      <span className={soundEffects.enabled ? "text-phosphor-green" : "text-text-muted"}>
                        {soundEffects.enabled ? "On" : "Off"}
                      </span>
                    </button>

                    <SettingsHeading>Developer</SettingsHeading>
                    <button
                      type="button"
                      role="menuitemcheckbox"
                      aria-checked={debugMode.enabled}
                      onClick={debugMode.toggle}
                      className={`${menuItemClass} justify-between text-cyan`}
                      style={{ fontFamily: MONO_FONT }}
                    >
                      Debug mode
                      <span className={debugMode.enabled ? "text-phosphor-green" : "text-text-muted"}>
                        {debugMode.enabled ? "On" : "Off"}
                      </span>
                    </button>

                    <SettingsHeading>Community</SettingsHeading>
                    <SettingsLink href={ALPHA_DISCORD_INVITE_URL} external>
                      Discord
                    </SettingsLink>
                    <SettingsLink href={VOID_TACTICS_X_URL} external>
                      X
                    </SettingsLink>
                    <SettingsLink href="/">Website</SettingsLink>

                    <SettingsHeading>Legal</SettingsHeading>
                    <SettingsLink href="/privacy">Privacy Policy</SettingsLink>
                    <SettingsLink href="/terms">Terms of Service</SettingsLink>
                    <SettingsLink href="/audio-credits">Audio Credits</SettingsLink>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Variant mismatch persistent banner */}
      {hasVariantMismatch && (
        <div
          className="border-t border-solid px-4 py-1.5 text-xs font-bold tracking-wider uppercase"
          style={{
            fontFamily: MONO_FONT,
            color: "var(--color-warning-red)",
            backgroundColor:
              "color-mix(in srgb, var(--color-warning-red) 10%, transparent)",
            borderColor:
              "color-mix(in srgb, var(--color-warning-red) 40%, transparent)",
          }}
        >
          &#9888; Network variant mismatch — claims and purchases may fail. Try
          switching networks.
        </div>
      )}

      {/* Dynamic's own profile modal (wallets, security, passkeys) — opened
          via My Account in the settings menu. Mounted here since the HUD
          renders on every client page; Dynamic controls its own visibility
          off showDynamicUserProfile. */}
      <DynamicUserProfile />
      <PasskeyEnablePrompt />
      <RecoveryCodesHost />
    </header>
  );
};

// Memoized: the client page re-renders on every games poll and tab change,
// and the HUD's props (a count and a flag) rarely change with it.
export default React.memo(Header);

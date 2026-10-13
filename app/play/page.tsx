"use client";

import {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useAccount } from "wagmi";
import { SessionRestoreProbe } from "../components/SessionRestoreProbe";
import Header from "../components/Header";
import { GameNav, type GameSection } from "../components/GameNav";
import { BootScreen } from "../components/BootScreen";
import { SignedOutOperations } from "../components/operations/SignedOutOperations";
import { CommandDeckWeb3 } from "../components/commandDeck/CommandDeckWeb3";
import { CommandDeckWeb2 } from "../components/commandDeck/CommandDeckWeb2";
import type { CommandDeckDestination } from "../components/commandDeck/CommandDeck";
import dynamic from "next/dynamic";
import { FLEET_SECTIONS, type FleetSection } from "../components/fleet/fleetSections";
import { STORE_SECTIONS, type StoreSection } from "../components/storeSections";
import { usePlayerGames } from "../hooks/usePlayerGames";
import { usePlayerGamesWeb2 } from "../hooks/usePlayerGamesWeb2";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useCommandDeckLayout } from "../hooks/useCommandDeckLayout";
import { TUTORIAL_STEP_STORAGE_KEY } from "../types/onboarding";
import {
  getTutorialReturnTo,
  hasCompletedFirstBattle,
  isKnownPlayer,
  markKnownPlayer,
  notifyTutorialCompletionChanged,
  setTutorialReturnTo,
  signedOutLanding,
  START_TUTORIAL_EVENT,
} from "../utils/tutorialCompletion";
import { useAppMode } from "../hooks/useAppMode";
import { OPS_CONSOLE_TABS, type OpsConsoleTab } from "../hooks/useOpsConsoleAccess";
import {
  clientTabFromSlug,
  openClientTab,
  setGameClientMounted,
  type ClientTab,
} from "../utils/clientNavigation";
import { getUrlParam, setUrlParams, useUrlParam, useUrlSearch } from "../utils/urlState";
import posthog from "posthog-js";
import { GAME_CONTENT_MAX_WIDTH_CLASS } from "../config/contentWidth";
import { TOURNAMENTS_ENABLED } from "../config/alpha";
import { AI_USER_ID } from "../config/aiUser";
import { isPveGame } from "../utils/pveGames";

// Screens load when first opened, so the boot screen and Command Deck don't
// download (and in dev, compile) the game view, tutorial, Lobbies, hangar,
// Store and run map up front.
function ScreenLoading() {
  return (
    <div className="animate-pulse py-10 text-center font-mono text-xs uppercase tracking-widest text-text-muted">
      Loading…
    </div>
  );
}
const OnboardingTutorial = dynamic(
  () => import("../components/OnboardingTutorial").then((m) => m.OnboardingTutorial),
  { loading: ScreenLoading },
);
const FleetHangar = dynamic(() => import("../components/fleet/FleetHangar").then((m) => m.FleetHangar), { loading: ScreenLoading });
const StoreScreen = dynamic(() => import("../components/StoreScreen").then((m) => m.StoreScreen), { loading: ScreenLoading });
const Lobbies = dynamic(() => import("../components/Lobbies"), { loading: ScreenLoading });
const LobbiesWeb2 = dynamic(() => import("../components/LobbiesWeb2"), { loading: ScreenLoading });
const RoguelikeCampaign = dynamic(
  () => import("../components/RoguelikeCampaign").then((m) => m.RoguelikeCampaign),
  { loading: ScreenLoading },
);
const RoguelikeCampaignWeb2 = dynamic(
  () => import("../components/RoguelikeCampaignWeb2").then((m) => m.RoguelikeCampaignWeb2),
  { loading: ScreenLoading },
);
const Games = dynamic(() => import("../components/Games"), { loading: ScreenLoading });
const GamesWeb2 = dynamic(() => import("../components/GamesWeb2"), { loading: ScreenLoading });
const Profile = dynamic(() => import("../components/Profile"), { loading: ScreenLoading });
const ProfileWeb2 = dynamic(() => import("../components/ProfileWeb2"), { loading: ScreenLoading });
const Tournaments = dynamic(() => import("../components/Tournaments").then((m) => m.Tournaments), { loading: ScreenLoading });
const TournamentsWeb2 = dynamic(
  () => import("../components/TournamentsWeb2").then((m) => m.TournamentsWeb2),
  { loading: ScreenLoading },
);

const CLIENT_TABS = new Set<string>([
  "Command Deck",
  "Mission",
  "Lobbies",
  "Tournaments",
  "Games",
  "Manage Navy",
  "Store",
  "Profile",
]);

/** Which nav section highlights for each screen; Play covers the hub and its modes. */
const SECTION_FOR_TAB: Record<ClientTab, GameSection> = {
  "Command Deck": "Play",
  Mission: "Play",
  Lobbies: "Play",
  Tournaments: "Play",
  Games: "Battles",
  "Manage Navy": "Fleet",
  Store: "Store",
  Profile: "Profile",
};

const TAB_FOR_SECTION: Record<GameSection, ClientTab> = {
  Play: "Command Deck",
  Fleet: "Manage Navy",
  Store: "Store",
  Battles: "Games",
  Profile: "Profile",
};

const TAB_FOR_DESTINATION: Record<CommandDeckDestination, ClientTab> = {
  operations: "Mission",
  skirmish: "Lobbies",
  battles: "Games",
  tournaments: "Tournaments",
  store: "Store",
};

/** Hub modes reached from the Command Deck, with the title on their back bar. */
const MODE_TITLES: Partial<Record<ClientTab, string>> = {
  Mission: "Operations",
  Lobbies: "Skirmish",
  Tournaments: "Tournaments",
};

/** The last client URL query, reopened when /play is loaded without one. */
const LAST_CLIENT_SEARCH_KEY = "vt-last-client-search";

/** Tabs saved by older versions of the client. */
function migrateSavedTab(saved: string | null): ClientTab {
  if (!saved) return "Command Deck";
  if (saved === "Roguelike") return "Mission";
  if (saved === "Customize Ship") return "Manage Navy";
  // Info moved to the website; admin tabs to the Ops Console (/admin).
  if (saved === "Info" || saved === "Campaign" || OPS_CONSOLE_TABS.includes(saved as OpsConsoleTab)) {
    return "Command Deck";
  }
  if (saved === "Tournaments" && !TOURNAMENTS_ENABLED) return "Command Deck";
  return CLIENT_TABS.has(saved) ? (saved as ClientTab) : "Command Deck";
}

function sectionFromEvent<T extends string>(event: Event, allowed: readonly T[]): T | null {
  const section = (event as CustomEvent<{ section?: string } | undefined>).detail?.section;
  return section && allowed.includes(section as T) ? (section as T) : null;
}

const panelBorderStyle: CSSProperties = {
  borderColor: "var(--color-gunmetal)",
  borderTopColor: "var(--color-steel)",
  borderLeftColor: "var(--color-steel)",
};

function ScreenPanel({ children }: { children: ReactNode }) {
  return (
    <div
      className="border-0 bg-transparent p-0 md:border md:border-solid md:bg-[var(--color-slate)] md:p-8"
      style={panelBorderStyle}
    >
      {children}
    </div>
  );
}

function ModeBar({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="mb-3 flex items-center gap-3 md:mb-4">
      <button
        type="button"
        onClick={onBack}
        className="border border-solid px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-cyan transition-colors duration-150 hover:bg-steel"
        style={{ fontFamily: "var(--font-rajdhani), 'Arial Black', sans-serif", borderColor: "var(--color-gunmetal)" }}
      >
        ‹ Command Deck
      </button>
      <h2
        className="text-xl font-bold uppercase tracking-widest text-text-primary md:text-2xl"
        style={{ fontFamily: "var(--font-rajdhani), 'Arial Black', sans-serif" }}
      >
        {title}
      </h2>
    </div>
  );
}

function CenteredMessage({ children }: { children: ReactNode }) {
  return (
    <div
      className="mx-auto mt-16 text-center uppercase"
      style={{
        fontFamily: "var(--font-jetbrains-mono), 'Courier New', monospace",
        color: "var(--color-cyan)",
      }}
    >
      <div className="mb-4 text-2xl font-bold tracking-wider">VOID TACTICS</div>
      <div className="text-lg">{children}</div>
    </div>
  );
}

/**
 * The game client: boot screen when signed out, otherwise the HUD, the
 * section nav and the Command Deck with the screens it leads to. The admin
 * tabs live in the Ops Console (/admin).
 */
export default function GameClient() {
  const { status, address, isConnected } = useAccount();
  const [isGamesDetailActive, setIsGamesDetailActive] = useState(false);
  const { games: playerGames, refetch: refetchPlayerGames } = usePlayerGames({
    enabled: !isGamesDetailActive,
  });
  const { games: playerGamesWeb2, refetch: refetchPlayerGamesWeb2 } = usePlayerGamesWeb2({
    pausePolling: isGamesDetailActive,
  });
  const refetchPlayerGamesRef = useRef(refetchPlayerGames);
  refetchPlayerGamesRef.current = refetchPlayerGames;
  const refetchPlayerGamesWeb2Ref = useRef(refetchPlayerGamesWeb2);
  refetchPlayerGamesWeb2Ref.current = refetchPlayerGamesWeb2;
  const { userId: currentUserId, isLoggedIn, isLoading: isUserLoading } = useCurrentUser();
  const appMode = useAppMode();
  const commandDeckLayout = useCommandDeckLayout();
  const [isRestoringSession, setIsRestoringSession] = useState(false);
  // Until SessionRestoreProbe first reports, a wallet session that's about
  // to come back looks exactly like "signed out".
  const [hasRestoreProbeReported, setHasRestoreProbeReported] = useState(false);
  const handleRestoreProbeChange = useCallback((isRestoring: boolean) => {
    setIsRestoringSession(isRestoring);
    setHasRestoreProbeReported(true);
  }, []);

  // The screen lives in the URL (?tab=…&section=…, see urlState.ts), so a
  // refresh reopens it and Back/Forward step through screens.
  const [isHydrated, setIsHydrated] = useState(false);
  const tabParam = useUrlParam("tab");
  const sectionParam = useUrlParam("section");
  const urlTab = clientTabFromSlug(tabParam);
  const activeTab: ClientTab =
    !isHydrated || !urlTab || (urlTab === "Tournaments" && !TOURNAMENTS_ENABLED)
      ? "Command Deck"
      : urlTab;
  const setActiveTab = useCallback(
    (tab: ClientTab, options?: { section?: string; replace?: boolean }) =>
      openClientTab(tab, {
        replace: options?.replace,
        params: options?.section ? { section: options.section } : undefined,
      }),
    [],
  );
  // Keep the Mission graph mounted after the first visit so leaving the tab
  // (e.g. Games) and coming back restores edit mode, selection, and drafts.
  const [missionKeepAlive, setMissionKeepAlive] = useState(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [firstBattleCompleted, setFirstBattleCompleted] = useState(false);
  const [isManageNavyPurchaseActive, setIsManageNavyPurchaseActive] = useState(false);
  const storeSection: StoreSection = STORE_SECTIONS.includes(sectionParam as StoreSection)
    ? (sectionParam as StoreSection)
    : "packs";
  const fleetSection: FleetSection = FLEET_SECTIONS.includes(sectionParam as FleetSection)
    ? (sectionParam as FleetSection)
    : "ships";
  const setSection = useCallback((section: string) => setUrlParams({ section }), []);

  const openTab = useCallback((tab: ClientTab) => {
    if (tab === "Tournaments" && !TOURNAMENTS_ENABLED) return;
    setActiveTab(tab);
    posthog.capture("tab_navigated", { tab_name: tab });
  }, [setActiveTab]);

  // Lets shared chrome (Header) switch tabs with events while the client is
  // on screen, and navigate here from other pages (see clientNavigation.ts).
  useEffect(() => {
    setGameClientMounted(true);
    return () => setGameClientMounted(false);
  }, []);

  // On a load without a screen in the URL (plain /play, an old bookmark),
  // reopen the last one, without adding a history entry. Resume a first
  // battle left in progress.
  // Whether this load named a screen (?tab=...); a signed-out visitor
  // following such a link gets sign-in, not the first-visit battle. Read
  // during the first client render: by any effect, the client (children's
  // effects run first) or the restore below may already have filled a tab in.
  const hadDeepLinkRef = useRef<boolean | null>(null);
  if (hadDeepLinkRef.current === null && typeof window !== "undefined") {
    // `?signin=1` (the site's Sign Up/Login) asks for the sign-in screen too.
    hadDeepLinkRef.current = !!getUrlParam("tab") || getUrlParam("signin") === "1";
  }
  // Signed out: the player asked for the sign-in screen (Sign Up/Login or
  // Skip Tutorial on the map).
  const [signInRequested, setSignInRequested] = useState(false);
  useLayoutEffect(() => {
    setIsHydrated(true);
    // Read above (hadDeepLinkRef); it has no screen of its own to keep.
    if (getUrlParam("signin")) setUrlParams({ signin: null }, { replace: true });
    if (!getUrlParam("tab")) {
      let lastSearch: string | null = null;
      try {
        lastSearch = localStorage.getItem(LAST_CLIENT_SEARCH_KEY);
      } catch {
        // storage unavailable: fall through to the Command Deck
      }
      const last = new URLSearchParams(lastSearch ?? "");
      if (clientTabFromSlug(last.get("tab"))) {
        setUrlParams(Object.fromEntries(last.entries()), { replace: true });
      } else {
        // Builds before URL state saved only the tab name.
        setActiveTab(migrateSavedTab(localStorage.getItem("void-tactics-active-tab")), { replace: true });
      }
    }
    setIsTutorialOpen(localStorage.getItem(TUTORIAL_STEP_STORAGE_KEY) !== null);
    setFirstBattleCompleted(hasCompletedFirstBattle());
  }, [setActiveTab]);

  // Remember the screen for the next plain /play load.
  const searchSnapshot = useUrlSearch();
  useEffect(() => {
    if (!isHydrated || !getUrlParam("tab")) return;
    try {
      localStorage.setItem(LAST_CLIENT_SEARCH_KEY, searchSnapshot);
    } catch {
      // storage unavailable: a plain /play load opens the Command Deck
    }
  }, [isHydrated, searchSnapshot]);

  useLayoutEffect(() => {
    if (activeTab === "Mission") setMissionKeepAlive(true);
  }, [activeTab]);

  // Navigation events from components and the HUD. Fresh listeners on both
  // window and document, matching how the events are dispatched.
  useEffect(() => {
    const routes: Record<string, (event: Event) => void> = {
      "void-tactics-navigate-to-games": () => {
        setActiveTab("Games");
        // Lobbies.tsx refetches its own usePlayerGames() instance before
        // firing this event, but that's a separate hook instance — this
        // component's playerGames drive the Battles badge and tab.
        void refetchPlayerGamesRef.current();
        void refetchPlayerGamesWeb2Ref.current();
      },
      // The old campaign's "return to campaign" (GameResultModal).
      "void-tactics-navigate-to-campaign": () => setActiveTab("Command Deck"),
      "void-tactics-navigate-to-roguelike": () => setActiveTab("Mission"),
      "void-tactics-navigate-to-lobbies": () => setActiveTab("Lobbies"),
      "void-tactics-navigate-to-manage-navy": (event) => {
        setActiveTab("Manage Navy", { section: sectionFromEvent(event, FLEET_SECTIONS) ?? "ships" });
      },
      // The HUD's + buttons pass the Store sub-tab to open.
      "void-tactics-navigate-to-store": (event) => {
        setActiveTab("Store", { section: sectionFromEvent(event, STORE_SECTIONS) ?? "packs" });
      },
      "void-tactics-navigate-to-info": () => setActiveTab("Command Deck"),
      "void-tactics-navigate-to-profile": () => openTab("Profile"),
      // From the Operations map (startTutorialFromOperations) closing it
      // returns there.
      [START_TUTORIAL_EVENT]: (event) => {
        const returnTo = (event as CustomEvent<{ returnTo?: string } | undefined>).detail?.returnTo;
        setTutorialReturnTo(returnTo === "mission" ? "mission" : null);
        setIsTutorialOpen(true);
      },
    };
    const entries = Object.entries(routes);
    for (const [name, handler] of entries) {
      window.addEventListener(name, handler);
      document.addEventListener(name, handler);
    }
    return () => {
      for (const [name, handler] of entries) {
        window.removeEventListener(name, handler);
        document.removeEventListener(name, handler);
      }
    };
  }, [openTab, setActiveTab]);

  // Games detail view (a match on screen) hides the HUD and nav.
  useEffect(() => {
    const handleGamesDetailActive = (event: Event) => {
      const custom = event as CustomEvent<{ active?: boolean }>;
      setIsGamesDetailActive(Boolean(custom.detail?.active));
    };
    window.addEventListener("void-tactics-games-detail-active", handleGamesDetailActive as EventListener);
    return () => {
      window.removeEventListener("void-tactics-games-detail-active", handleGamesDetailActive as EventListener);
    };
  }, []);

  // Manage Navy's mobile purchase takeover hides them too.
  useEffect(() => {
    const handleManageNavyPurchaseActive = (event: Event) => {
      const custom = event as CustomEvent<{ active?: boolean }>;
      setIsManageNavyPurchaseActive(Boolean(custom.detail?.active));
    };
    window.addEventListener(
      "void-tactics-manage-navy-purchase-active",
      handleManageNavyPurchaseActive as EventListener,
    );
    return () => {
      window.removeEventListener(
        "void-tactics-manage-navy-purchase-active",
        handleManageNavyPurchaseActive as EventListener,
      );
    };
  }, []);

  // Once both identities are definitively logged out, return to the
  // Command Deck so the next sign-in doesn't land on a stale screen. Not
  // while a wallet session is still coming back after a reload: wagmi reads
  // "disconnected" until it does, and resetting then overwrote the saved
  // tab (a refresh mid-match landed on the Command Deck, not the match).
  useEffect(() => {
    if (status === "connecting" || status === "reconnecting" || isUserLoading) return;
    if (!hasRestoreProbeReported || isRestoringSession) return;
    if (!isConnected && !isLoggedIn && activeTab !== "Command Deck") {
      setActiveTab("Command Deck", { replace: true });
    }
  }, [status, isConnected, isLoggedIn, isUserLoading, activeTab, hasRestoreProbeReported, isRestoringSession, setActiveTab]);

  const openTutorial = useCallback(() => {
    setTutorialReturnTo(null);
    setIsTutorialOpen(true);
  }, []);

  // Opened from the Operations map: back there, on fleet selection once the
  // battle's finished (the tutorial was the run's first mission).
  const closeTutorial = useCallback(() => {
    const returnTo = getTutorialReturnTo();
    setTutorialReturnTo(null);
    setIsTutorialOpen(false);
    const finished = hasCompletedFirstBattle();
    setFirstBattleCompleted(finished);
    notifyTutorialCompletionChanged();
    if (returnTo === "mission") {
      openClientTab("Mission", { params: finished ? { fleet: "select" } : undefined });
    } else {
      setActiveTab("Command Deck");
    }
  }, [setActiveTab]);

  const ZERO_ADDR = "0x0000000000000000000000000000000000000000";
  const yourTurnGames =
    appMode === "web2"
      ? playerGamesWeb2
          .filter((g) => g.metadata.winner === "" && g.turnState.currentTurn === currentUserId)
          .map((g) => ({ isPve: g.metadata.joiner === AI_USER_ID }))
      : isConnected
        ? playerGames
            .filter((g) => g.metadata.winner === ZERO_ADDR && g.turnState.currentTurn === address)
            .map((g) => ({ isPve: isPveGame(g) }))
        : [];
  // Your-turn counts (Battles tab marker, header bell, Command Deck) are for
  // opponents waiting on you, so PvE missions (always your turn while open)
  // don't count.
  const pvpYourTurnCount = yourTurnGames.filter((g) => !g.isPve).length;
  // Web2 mode signs in via NextAuth, never connects a wallet — `status`
  // (wagmi) would stay "disconnected" forever for those users.
  const isSignedIn = appMode === "web2" ? isLoggedIn : status === "connected";
  const isCheckingSignIn =
    status === "connecting" ||
    status === "reconnecting" ||
    isUserLoading ||
    (appMode !== "web2" && !isLoggedIn && isRestoringSession);

  // This browser has a player now: signed out later, /play offers sign-in
  // instead of the first-visit battle.
  useEffect(() => {
    if (isSignedIn) markKnownPlayer();
  }, [isSignedIn]);

  // Signed out, a new player gets the Operations map with First Contact
  // first; others the sign-in screen (signedOutLanding). Waits for any
  // session restore to settle, like the Command Deck reset above, so a
  // returning session doesn't flash the signed-out map.
  const sessionSettled = hasRestoreProbeReported && !isRestoringSession && !isCheckingSignIn;
  const signedOutView =
    isHydrated && !isSignedIn
      ? signedOutLanding({
          knownPlayer: isKnownPlayer(),
          hasDeepLink: hadDeepLinkRef.current === true,
          wantsSignIn: signInRequested,
        })
      : null;
  const showSignedOutMap = signedOutView === "map" && sessionSettled;
  useEffect(() => {
    if (showSignedOutMap) posthog.capture("first_visit_map_shown");
  }, [showSignedOutMap]);

  const hideGlobalChrome = isTutorialOpen || isGamesDetailActive || isManageNavyPurchaseActive;
  const showNav = isHydrated && isSignedIn && !hideGlobalChrome;
  const isFullWidth = isTutorialOpen || activeTab === "Games";

  // Collapse (rather than unmount) the HUD while hidden: it owns the
  // network/app-mode sync effects, which must keep running in a match.
  const hudRowStyle: CSSProperties = hideGlobalChrome
    ? { height: 0, minHeight: 0, maxHeight: 0, overflow: "hidden", pointerEvents: "none" }
    : {};

  const goToCommandDeck = () => openTab("Command Deck");
  const modeTitle = MODE_TITLES[activeTab];

  let content: ReactNode;
  if (!isHydrated) {
    // The saved tab is only known after hydration; render nothing for this
    // one frame rather than flashing the wrong screen.
    content = null;
  } else if (isTutorialOpen) {
    content = <OnboardingTutorial onComplete={closeTutorial} onSkip={closeTutorial} isSignedIn={isSignedIn} />;
  } else if (isCheckingSignIn) {
    content = <CenteredMessage>Connecting...</CenteredMessage>;
  } else if (!isSignedIn) {
    content =
      signedOutView === "map" ? (
        showSignedOutMap ? (
          <SignedOutOperations onSignIn={() => setSignInRequested(true)} />
        ) : (
          <CenteredMessage>Connecting...</CenteredMessage>
        )
      ) : (
        <BootScreen onStartFirstBattle={openTutorial} firstBattleCompleted={firstBattleCompleted} />
      );
  } else {
    content = (
      <>
        {modeTitle && <ModeBar title={modeTitle} onBack={goToCommandDeck} />}
        {missionKeepAlive && (
          <div className={activeTab === "Mission" ? "w-full" : "hidden"} aria-hidden={activeTab !== "Mission"}>
            <ScreenPanel>{appMode === "web2" ? <RoguelikeCampaignWeb2 /> : <RoguelikeCampaign />}</ScreenPanel>
          </div>
        )}
        {activeTab === "Command Deck" &&
          (appMode === "web2" ? (
            <CommandDeckWeb2
              layout={commandDeckLayout}
              yourTurnCount={pvpYourTurnCount}
              onOpen={(destination) => openTab(TAB_FOR_DESTINATION[destination])}
            />
          ) : (
            <CommandDeckWeb3
              layout={commandDeckLayout}
              yourTurnCount={pvpYourTurnCount}
              onOpen={(destination) => openTab(TAB_FOR_DESTINATION[destination])}
            />
          ))}
        {activeTab === "Games" && (
          <div className={`w-full ${isGamesDetailActive ? "px-0" : "px-2 sm:px-4"}`}>
            <div
              className={isGamesDetailActive ? "border-0 p-0" : "border border-solid p-4"}
              style={
                isGamesDetailActive
                  ? { backgroundColor: "transparent", borderColor: "transparent" }
                  : { ...panelBorderStyle, backgroundColor: "var(--color-slate)" }
              }
            >
              {appMode === "web2" ? <GamesWeb2 /> : <Games />}
            </div>
          </div>
        )}
        {activeTab === "Manage Navy" && (
          <ScreenPanel>
            <FleetHangar section={fleetSection} onSection={setSection} />
          </ScreenPanel>
        )}
        {activeTab === "Store" && (
          <ScreenPanel>
            <StoreScreen section={storeSection} onSection={setSection} />
          </ScreenPanel>
        )}
        {activeTab === "Lobbies" && <ScreenPanel>{appMode === "web2" ? <LobbiesWeb2 /> : <Lobbies />}</ScreenPanel>}
        {activeTab === "Tournaments" && TOURNAMENTS_ENABLED && (
          <ScreenPanel>{appMode === "web2" ? <TournamentsWeb2 /> : <Tournaments />}</ScreenPanel>
        )}
        {activeTab === "Profile" && (
          <ScreenPanel>
            <div className="mb-4 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  posthog.capture("profile_first_battle_clicked", { replay: firstBattleCompleted });
                  openTutorial();
                }}
                className="border-2 border-solid border-phosphor-green px-4 py-2 text-xs font-bold uppercase tracking-wider text-phosphor-green transition-colors duration-150 hover:bg-phosphor-green/10"
                style={{ fontFamily: "var(--font-rajdhani), 'Arial Black', sans-serif" }}
              >
                {firstBattleCompleted ? "Replay First Contact" : "Play First Contact"}
              </button>
            </div>
            {appMode === "web2" ? <ProfileWeb2 /> : <Profile />}
          </ScreenPanel>
        )}
      </>
    );
  }

  return (
    <div className="flex min-h-screen flex-col" style={{ backgroundColor: "var(--color-near-black)" }}>
      <SessionRestoreProbe isConnected={isConnected} onChange={handleRestoreProbeChange} />
      <div className="shrink-0" style={hudRowStyle} aria-hidden={hideGlobalChrome}>
        <Header yourTurnCount={isSignedIn ? pvpYourTurnCount : undefined} showSignIn={false} />
        {showNav && (
          <GameNav
            active={SECTION_FOR_TAB[activeTab]}
            onSelect={(section) => openTab(TAB_FOR_SECTION[section])}
            battlesAlert={pvpYourTurnCount > 0}
          />
        )}
      </div>
      <main
        className={`flex min-h-0 w-full flex-1 flex-col ${
          hideGlobalChrome || !isSignedIn ? "p-0" : "pb-24 pt-4 md:pb-16"
        } ${isFullWidth || !isSignedIn ? "px-0" : "px-2 md:px-6 lg:px-10"}`}
      >
        <div className={`w-full ${isFullWidth || !isSignedIn ? "" : `mx-auto ${GAME_CONTENT_MAX_WIDTH_CLASS}`}`}>
          {content}
        </div>
      </main>
    </div>
  );
}

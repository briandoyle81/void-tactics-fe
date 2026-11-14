"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SignInModal } from "./components/signIn/SignInModal";
import { DynamicContextProvider, type DynamicContextProps } from "@dynamic-labs/sdk-react-core";
import { SolanaWalletConnectors } from "@dynamic-labs/solana";
import { SessionProvider } from "next-auth/react";
import { TransactionProvider } from "./providers/TransactionContext";
import { type ReactNode, memo } from "react";
import { PosthogAppChainSync } from "./components/PosthogAppChainSync";
import { ClearOAuthRedirectParams } from "./components/ClearOAuthRedirectParams";
import { NearSessionProvider } from "./near/session";
import { NearOnboardingHost } from "./near/onboarding/NearOnboardingHost";
import { NearSyncHost } from "./near/sync/NearSyncHost";
import { NEAR_DYNAMIC_ENVIRONMENT_ID } from "./near/config";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});

// Dynamic signs players in (email code, Google, passkey) and holds their
// Solana embedded wallet, whose Ed25519 key is their NEAR key
// (app/near/identity.ts). The NEAR build uses its own Dynamic project
// (NEXT_PUBLIC_NEAR_DYNAMIC_ENVIRONMENT_ID) with Solana embedded wallets on.
const DYNAMIC_SETTINGS: DynamicContextProps["settings"] = {
  environmentId: NEAR_DYNAMIC_ENVIRONMENT_ID,
  walletConnectors: [SolanaWalletConnectors],
};

// memo keeps Dynamic's frequent context updates from re-rendering the whole app.
const AppContent = memo(function AppContent({ children }: { children: ReactNode }) {
  return (
    <>
      <NearSyncHost />
      <PosthogAppChainSync />
      <ClearOAuthRedirectParams />
      <SignInModal />
      <TransactionProvider>
        <NearOnboardingHost />
        {children}
      </TransactionProvider>
    </>
  );
});

// The game client's providers (wallet, NEAR session, reads, session), mounted
// once by its shared layout (app/(client)/layout.tsx: /play, /admin, a game).
// The website doesn't need the wallet stack, so it doesn't load it.
export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <DynamicContextProvider settings={DYNAMIC_SETTINGS}>
        <QueryClientProvider client={queryClient}>
          <NearSessionProvider>
            <AppContent>{children}</AppContent>
          </NearSessionProvider>
        </QueryClientProvider>
      </DynamicContextProvider>
    </SessionProvider>
  );
}

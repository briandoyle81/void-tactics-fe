"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import type { Abi } from "viem";
import { CONTRACT_ABIS, getContractAddresses } from "../config/contracts";
import { useSelectedChainId } from "./useSelectedChainId";
import {
  hasCompletedFirstBattle,
  hasSkippedTutorial,
  isTutorialClaimCompletedCached,
  persistTutorialClaimCompleted,
  persistTutorialSkipped,
  TUTORIAL_COMPLETION_CHANGED_EVENT,
} from "../utils/tutorialCompletion";

const TUTORIAL_CLAIM_ABI = CONTRACT_ABIS.TUTORIAL_CLAIM as Abi;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/**
 * Whether the connected wallet has done the tutorial: finished it on this
 * device, skipped it from the Operations map, or claimed its reward
 * (TutorialClaim.tutorialCompleted, read only when nothing local says so).
 * Web2: useTutorialCompletedWeb2.
 */
export function useTutorialCompleted() {
  const { address } = useAccount();
  const chainId = useSelectedChainId();
  const [localDone, setLocalDone] = useState<boolean | null>(null);

  useEffect(() => {
    const read = () =>
      setLocalDone(
        hasCompletedFirstBattle() ||
          (!!address && (hasSkippedTutorial(address) || isTutorialClaimCompletedCached(chainId, address))),
      );
    read();
    window.addEventListener(TUTORIAL_COMPLETION_CHANGED_EVENT, read);
    return () => window.removeEventListener(TUTORIAL_COMPLETION_CHANGED_EVENT, read);
  }, [address, chainId]);

  const claimAddress = getContractAddresses(chainId).TUTORIAL_CLAIM;
  const readConfig = useMemo(
    () => ({
      address: claimAddress as `0x${string}`,
      abi: TUTORIAL_CLAIM_ABI,
      functionName: "tutorialCompleted" as const,
      args: address ? [address] : undefined,
      chainId,
      query: {
        enabled: localDone === false && !!address && !!claimAddress && claimAddress !== ZERO_ADDRESS,
        staleTime: 5 * 60_000,
      },
    }),
    [address, chainId, claimAddress, localDone],
  );
  const { data: claimedOnChain, isLoading: isReading } = useReadContract(readConfig);

  useEffect(() => {
    if (claimedOnChain === true && address) persistTutorialClaimCompleted(chainId, address);
  }, [claimedOnChain, address, chainId]);

  const markSkipped = useCallback(() => {
    if (address) persistTutorialSkipped(address);
  }, [address]);

  return {
    isCompleted: localDone === true || claimedOnChain === true,
    isLoading: localDone === null || (localDone === false && isReading),
    markSkipped,
  };
}

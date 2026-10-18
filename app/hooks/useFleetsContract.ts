import { useMemo } from "react";
import { useReadContract, useAccount } from "wagmi";
import { CONTRACT_ABIS, getContractAddresses } from "../config/contracts";
import type { Abi } from "viem";
import { getSelectedChainId } from "../config/networks";

// Hook for reading contract data
export function useFleetsContract() {
  const { chainId: walletChainId } = useAccount();
  const activeChainId = walletChainId ?? getSelectedChainId();
  const { FLEETS } = getContractAddresses(activeChainId);

  return {
    address: FLEETS as `0x${string}`,
    abi: CONTRACT_ABIS.FLEETS as Abi,
    chainId: activeChainId,
  };
}

// Hook for reading contract data with proper typing
export function useFleetsRead(
  functionName: string,
  args?: readonly unknown[],
  options?: { query?: { enabled?: boolean } }
) {
  const { chainId: walletChainId } = useAccount();
  const activeChainId = walletChainId ?? getSelectedChainId();
  const address = useMemo(
    () => getContractAddresses(activeChainId).FLEETS as `0x${string}`,
    [activeChainId],
  );

  return useReadContract({
    address,
    abi: CONTRACT_ABIS.FLEETS as Abi,
    chainId: activeChainId,
    functionName,
    args,
    query: options?.query,
  });
}

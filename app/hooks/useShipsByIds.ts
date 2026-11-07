"use client";

import { useEffect, useMemo, useRef } from "react";
import { useReadContracts } from "wagmi";
import { keepPreviousData } from "@tanstack/react-query";
import { baseSepolia } from "viem/chains";
import type { Abi } from "viem";
import {
  CONTRACT_ABIS,
  CONTRACT_ADDRESSES_BY_CHAIN_ID,
  getContractAddresses,
} from "../config/contracts";
import { useSelectedChainId } from "./useSelectedChainId";
import { Ship } from "../types/types";
import { AI_SHIP_ID_OFFSET, cacheShipsData } from "./useShipDataCache";
import { shipIdsKey } from "../utils/shipIdsKey";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const SHIPS_ABI = CONTRACT_ABIS.SHIPS as Abi;
const SHIPS_ROUTER_ABI = CONTRACT_ABIS.SHIPS_ROUTER as Abi;
const SHIP_ATTRIBUTES_ABI = CONTRACT_ABIS.SHIP_ATTRIBUTES as Abi;
const SHIPS_ROUTER_ADDRESS = CONTRACT_ADDRESSES_BY_CHAIN_ID[baseSepolia.id]
  .SHIPS_ROUTER as `0x${string}`;

// Fetches full Ship data for an arbitrary list of ship ids appearing in a
// live game (both sides' fleets). Ships.getShipsByIds is a batch call, but
// ShipsRouter (needed on Base Sepolia so AI ship ids resolve correctly —
// see docs/singleplayer-frontend-integration.md) only exposes a singular
// getShip(id); useReadContracts batches N single calls into one multicall,
// so this is still one network round-trip either way.
export function useShipsByIds(shipIds: bigint[]) {
  const activeChainId = useSelectedChainId();

  // ShipsRouter.getShip transparently resolves both human (Ships.sol) and
  // AI (AIShips.sol) ship ids by id range — single-player only exists on
  // Base Sepolia, so that's the only chain where an id might be AI-owned
  // and the only chain ShipsRouter is deployed on. Elsewhere (PvP-only,
  // every id is a human NFT) plain Ships.sol is correct and there's no
  // router to use anyway.
  const useRouter =
    activeChainId === baseSepolia.id && SHIPS_ROUTER_ADDRESS !== ZERO_ADDRESS;
  const shipsAddress = getContractAddresses(activeChainId).SHIPS as `0x${string}`;
  const address = useRouter ? SHIPS_ROUTER_ADDRESS : shipsAddress;
  const abi = useRouter ? SHIPS_ROUTER_ABI : SHIPS_ABI;

  // Callers often pass a freshly allocated id array from game poll data even
  // when the ids did not change. Key off contents, in a fixed order, so we do
  // not rebuild the multicall (or trip a stale-time-0 refetch) every getGame
  // tick, nor when the same ships come in another order: GameDisplay lists a
  // game's active ships first, so a ship that retreats or is destroyed (out of
  // the active lists, still in shipPositions) moves to the end. That was a new
  // query with no data, so every ship left the board until it came back.
  const idsKey = shipIdsKey(shipIds);
  const stableShipIds = useMemo(
    () => idsKey.split(",").filter(Boolean).map((id) => BigInt(id)),
    [idsKey],
  );

  const contracts = useMemo(
    () =>
      stableShipIds.map((id) => ({
        address,
        abi,
        chainId: activeChainId,
        functionName: "getShip" as const,
        args: [id] as const,
      })),
    [stableShipIds, address, abi, activeChainId],
  );

  const { data, isLoading, error, refetch } = useReadContracts({
    contracts,
    query: {
      enabled: stableShipIds.length > 0,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      staleTime: Infinity,
      notifyOnChangeProps: ["data", "error"],
      // When the set of ships does change, keep drawing the ones we have
      // until the new set arrives, rather than an empty board.
      placeholderData: keepPreviousData,
    },
  });

  const fetchedShips = useMemo(
    () =>
      (data ?? [])
        .map((r) => r.result)
        .filter((s): s is Ship => s != null) as Ship[],
    [data],
  );

  // AI ships (id >= AI_SHIP_ID_OFFSET) carry cost 0 on chain, so their cost
  // is ShipAttributes.calculateShipCost of the ship itself (the live cost
  // tables, one multicall for all of them).
  const aiShips = useMemo(
    () => fetchedShips.filter((s) => s.id >= AI_SHIP_ID_OFFSET),
    [fetchedShips],
  );
  const shipAttributesAddress = getContractAddresses(activeChainId)
    .SHIP_ATTRIBUTES as `0x${string}` | undefined;
  const costContracts = useMemo(
    () =>
      aiShips.map((ship) => ({
        address: shipAttributesAddress ?? ZERO_ADDRESS,
        abi: SHIP_ATTRIBUTES_ABI,
        chainId: activeChainId,
        functionName: "calculateShipCost" as const,
        args: [ship] as const,
      })),
    [aiShips, shipAttributesAddress, activeChainId],
  );
  const { data: costData, isPlaceholderData: costsArePrevious } = useReadContracts({
    contracts: costContracts,
    query: {
      enabled: aiShips.length > 0 && !!shipAttributesAddress,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      staleTime: Infinity,
      placeholderData: keepPreviousData,
    },
  });

  // Each AI ship's cost by id. The results line up with aiShips only once
  // they're this list's own (not the previous list's, kept while it loads).
  const costByIdRef = useRef(new Map<bigint, number>());
  const ships = useMemo(() => {
    if (aiShips.length === 0) return fetchedShips;
    const costById = costByIdRef.current;
    if (!costsArePrevious) {
      aiShips.forEach((ship, i) => {
        const cost = costData?.[i]?.result;
        if (cost != null) costById.set(ship.id, Number(cost));
      });
    }
    return fetchedShips.map((ship) => {
      const cost = costById.get(ship.id);
      return cost == null ? ship : { ...ship, shipData: { ...ship.shipData, cost } };
    });
  }, [fetchedShips, aiShips, costData, costsArePrevious]);

  // cacheShipsData itself skips AI ship ids (pooled/reused across matches —
  // see useShipDataCache.ts for why caching those long-term is wrong, not
  // just wasteful).
  useEffect(() => {
    if (ships.length > 0) cacheShipsData(ships);
  }, [ships]);

  return {
    ships,
    isLoading,
    error,
    refetch,
  };
}

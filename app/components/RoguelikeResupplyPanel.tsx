"use client";

import React from "react";
import { useAccount, useReadContract } from "wagmi";
import { baseSepolia } from "viem/chains";
import type { Abi } from "viem";
import { formatEther } from "viem";
import { toast } from "react-hot-toast";
import { TransactionButton } from "./TransactionButton";
import ShipCard from "./ShipCard";
import { ShipImage } from "./ShipImage";
import { toShipCardData } from "../utils/toShipCardData";
import { CONTRACT_ABIS, getContractAddresses } from "../config/contracts";
import { useOwnedShips } from "../hooks/useOwnedShips";
import { useFleetShipAttributes } from "../hooks/useFleetShipAttributes";
import { useRoguelikeRosterHP } from "../hooks/useRoguelikeRun";
import { useRepairCostPerHP, useRoguelikeResupply, ROGUELIKE_RESUPPLY_ADDRESS } from "../hooks/useRoguelikeResupply";
import { RoguelikeRun, RoguelikeNode } from "../types/roguelike";
import { DUPLICATE_SHIP_ID_TOAST } from "../utils/fleetShipIds";
import { RoguelikeResupplyView } from "./operations/RoguelikeResupplyView";

const UTC_APPROVE_ABI = [
  {
    inputs: [
      { internalType: "address", name: "spender", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

interface RoguelikeResupplyPanelProps {
  run: RoguelikeRun;
  node: RoguelikeNode;
  onDone: () => void;
}

/**
 * Web3's resupply screen (see RoguelikeResupplyView): roster HP from the run
 * contract, repairs as a UTC approve then resupplyRepair, roster changes as
 * resupplyModifyRoster transactions.
 */
export function RoguelikeResupplyPanel({ run, node, onDone }: RoguelikeResupplyPanelProps) {
  const { address } = useAccount();
  const { ships: ownedShips, isLoading: shipsLoading, refetch: refetchOwnedShips } = useOwnedShips(
    baseSepolia.id,
  );
  const { resupplyModifyRoster } = useRoguelikeResupply();
  const { data: repairCostPerHP } = useRepairCostPerHP();

  const rosterIdSet = React.useMemo(
    () => new Set(run.rosterShipIds.map((id) => id.toString())),
    [run.rosterShipIds],
  );
  const rosterShips = React.useMemo(
    () => ownedShips.filter((s) => rosterIdSet.has(s.id.toString())),
    [ownedShips, rosterIdSet],
  );
  const requiredVariant = Number(run.requiredVariantAtStart ?? 0);
  const availableShips = React.useMemo(
    () =>
      ownedShips.filter(
        (s) =>
          !rosterIdSet.has(s.id.toString()) &&
          s.shipData.constructed &&
          s.shipData.timestampDestroyed === 0n &&
          !s.shipData.inFleet &&
          (requiredVariant > 0
            ? s.traits.variant === requiredVariant
            : rosterShips[0]
              ? s.traits.variant === rosterShips[0].traits.variant
              : true),
      ),
    [ownedShips, requiredVariant, rosterIdSet, rosterShips],
  );

  const { attributesMap } = useFleetShipAttributes(
    rosterShips.map((s) => s.id),
    baseSepolia.id,
  );
  const { hpByShipId, refetch: refetchHP } = useRoguelikeRosterHP(
    address,
    run.rosterShipIds,
  );

  const shipEffectiveHP = React.useCallback(
    (shipId: bigint): { current: number; max: number } => {
      const max = attributesMap.get(shipId)?.maxHullPoints ?? 0;
      const raw = hpByShipId.get(shipId.toString()) ?? 0;
      // 0 means "not yet damaged this run" — fresh at max, not literally 0.
      const current = raw === 0 ? max : raw;
      return { current, max };
    },
    [attributesMap, hpByShipId],
  );


  const contractAddresses = getContractAddresses(baseSepolia.id);
  const { data: utcBalance } = useReadContract({
    address: contractAddresses.UNIVERSAL_CREDITS as `0x${string}`,
    abi: CONTRACT_ABIS.UNIVERSAL_CREDITS as Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: baseSepolia.id,
    query: { enabled: !!address },
  });
  const { data: utcAllowance, refetch: refetchAllowance } = useReadContract({
    address: contractAddresses.UNIVERSAL_CREDITS as `0x${string}`,
    abi: CONTRACT_ABIS.UNIVERSAL_CREDITS as Abi,
    functionName: "allowance",
    args: address ? [address, ROGUELIKE_RESUPPLY_ADDRESS] : undefined,
    chainId: baseSepolia.id,
    query: { enabled: !!address },
  });
  const costFor = (missingHP: number) => (repairCostPerHP ?? 0n) * BigInt(missingHP);

  const handleAddShip = async (shipId: bigint) => {
    try {
      await resupplyModifyRoster([shipId], []);
      toast.success("Ship added to roster");
      await refetchOwnedShips();
      await Promise.resolve(onDone());
    } catch (error) {
      console.error("Failed to add ship to roster:", error);
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("InvalidFleetCost")) {
        toast.error(`Adding this ship exceeds the run's ${run.currentCostCap.toString()} cost cap.`);
      } else if (message.includes("ShipAlreadyInFleet") || message.includes("ShipNotOwned")) {
        toast.error("That ship can't be added right now.");
      } else if (message.includes("WrongCampaignVariant")) {
        toast.error("That ship's faction doesn't match this run's roster.");
      } else if (message.includes("DuplicateShipId")) {
        toast.error(DUPLICATE_SHIP_ID_TOAST);
      } else if (message.includes("ActiveGameInProgress")) {
        toast.error(
          "A match is still in progress. Return to it or let it finish before changing your roster.",
        );
      } else {
        toast.error(`Failed to add ship: ${message}`);
      }
    }
  };

  const handleRemoveShip = async (shipId: bigint) => {
    try {
      await resupplyModifyRoster([], [shipId]);
      toast.success("Ship removed from roster");
      await refetchOwnedShips();
      await Promise.resolve(onDone());
    } catch (error) {
      console.error("Failed to remove ship from roster:", error);
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("ShipNotInRoster")) {
        toast.error("That ship isn't in your current roster.");
      } else if (message.includes("ActiveGameInProgress")) {
        toast.error(
          "A match is still in progress. Return to it or let it finish before changing your roster.",
        );
      } else {
        toast.error(`Failed to remove ship: ${message}`);
      }
    }
  };

  return (
    <RoguelikeResupplyView
      nodeLabel={node.id.toString()}
      costCapLabel={run.currentCostCap.toString()}
      isLoading={shipsLoading}
      roster={rosterShips.map((ship) => {
        const { current, max } = shipEffectiveHP(ship.id);
        return {
          key: ship.id.toString(),
          name: ship.name || `Ship #${ship.id}`,
          image: <ShipImage ship={ship} className="h-full w-full" showLoadingState={false} />,
          currentHP: current,
          maxHP: max,
        };
      })}
      available={availableShips.map((ship) => ({
        key: ship.id.toString(),
        card: (
          <ShipCard
            ship={toShipCardData(ship)}
            shipImage={<ShipImage ship={ship} className="h-full w-full" showLoadingState={false} />}
            isStarred={false}
            onToggleStar={() => {}}
            isSelected={false}
            onToggleSelection={() => {}}
            onRecycleClick={() => {}}
            showInGameProperties={false}
            hideRecycle
            hideCheckbox
          />
        ),
      }))}
      onAdd={(key) => handleAddShip(BigInt(key))}
      onRemove={(key) => handleRemoveShip(BigInt(key))}
      repairCostLabel={(missingHP) => `Repair cost: ${formatEther(costFor(missingHP))} UTC (${missingHP} HP)`}
      renderRepairButton={({ keys, missingHP, onRepaired }) => {
        const repairCost = costFor(missingHP);
        const utcApproved = (utcAllowance as bigint | undefined) != null && (utcAllowance as bigint) >= repairCost;
        return !utcApproved ? (
          <TransactionButton
            transactionId={`approve-utc-roguelike-repair-${address}`}
            contractAddress={contractAddresses.UNIVERSAL_CREDITS as `0x${string}`}
            abi={UTC_APPROVE_ABI as Abi}
            functionName="approve"
            args={[ROGUELIKE_RESUPPLY_ADDRESS, repairCost]}
            className="border-2 border-cyan px-4 py-2 text-xs font-bold uppercase tracking-wider text-cyan transition-colors hover:bg-cyan/10 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={(utcBalance as bigint | undefined) == null || (utcBalance as bigint) < repairCost}
            loadingText="[APPROVING...]"
            errorText="[ERROR APPROVING]"
            onSuccess={async () => {
              await refetchAllowance();
              toast.success("UTC approved!");
            }}
            onError={(error) => {
              console.error("Failed to approve UTC:", error);
              toast.error("Failed to approve UTC transfer");
            }}
            validateBeforeTransaction={() => {
              if (!address) return "Please connect your wallet";
              if ((utcBalance as bigint | undefined) == null || (utcBalance as bigint) < repairCost) {
                return "Insufficient UTC balance";
              }
              return true;
            }}
          >
            [APPROVE {formatEther(repairCost)} UTC]
          </TransactionButton>
        ) : (
          <TransactionButton
            transactionId={`repair-roguelike-roster-${address}`}
            contractAddress={ROGUELIKE_RESUPPLY_ADDRESS}
            abi={CONTRACT_ABIS.ROGUELIKE_RESUPPLY as Abi}
            functionName="resupplyRepair"
            args={[keys.map((id) => BigInt(id))]}
            className="border-2 border-phosphor-green px-4 py-2 text-xs font-bold uppercase tracking-wider text-phosphor-green transition-colors hover:bg-phosphor-green/10 disabled:cursor-not-allowed disabled:opacity-50"
            loadingText="[REPAIRING...]"
            errorText="[ERROR REPAIRING]"
            onSuccess={async () => {
              await refetchHP();
              onRepaired();
              toast.success("Repair complete!");
            }}
            onError={(error) => {
              console.error("Failed to repair roster:", error);
              const message = error instanceof Error ? error.message : String(error);
              if (message.includes("ActiveGameInProgress")) {
                toast.error("A match is still in progress. Return to it or let it finish before repairing.");
              } else {
                toast.error("Failed to repair roster");
              }
            }}
          >
            [REPAIR {missingHP} HP]
          </TransactionButton>
        );
      }}
      onDone={onDone}
    />
  );
}

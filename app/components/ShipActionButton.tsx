"use client";

import React from "react";
import { toast } from "react-hot-toast";
import { TransactionButton, type TransactionFollowUp } from "./TransactionButton";
import { CONTRACT_ADDRESSES } from "../config/contracts";
import { constructErrorMessage, useConstructShips } from "../hooks/useConstructShips";
import { useTransaction } from "../providers/TransactionContext";
import type { Ship } from "../types/types";
import type { Abi } from "viem";
import posthog from "posthog-js";

interface ShipActionButtonProps {
  action: "construct" | "constructAll" | "constructShips" | "recycle";
  shipId?: bigint;
  shipIds?: bigint[];
  /** The ships a construct action covers (constructAll uses their ids to
   * check the construction window first; see useConstructShips). Ignored
   * for recycle. */
  ships?: Ship[];
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onSuccess?: TransactionFollowUp;
  onError?: (error: Error) => void;
}

// constructShips reverts the whole batch if any id is already constructed
// (selector 0xa6639c3e). Include the error so viem can decode it.
const SHIP_CONSTRUCTED_ERROR = {
  type: "error" as const,
  name: "ShipConstructed",
  inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
};

const SHIP_ACTION_CONFIG = {
  construct: {
    functionName: "constructShip",
    abi: [
      {
        inputs: [{ internalType: "uint256", name: "_id", type: "uint256" }],
        name: "constructShip",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
      },
      SHIP_CONSTRUCTED_ERROR,
    ] as Abi,
  },
  constructAll: {
    functionName: "constructAllMyShips",
    abi: [
      {
        inputs: [],
        name: "constructAllMyShips",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
      },
      SHIP_CONSTRUCTED_ERROR,
    ] as Abi,
  },
  constructShips: {
    functionName: "constructShips",
    abi: [
      {
        inputs: [
          {
            internalType: "uint256[]",
            name: "_ids",
            type: "uint256[]",
          },
        ],
        name: "constructShips",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
      },
      SHIP_CONSTRUCTED_ERROR,
    ] as Abi,
  },
  recycle: {
    functionName: "shipBreaker",
    abi: [
      {
        inputs: [
          {
            internalType: "uint256[]",
            name: "_shipIds",
            type: "uint256[]",
          },
        ],
        name: "shipBreaker",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
      },
    ] as Abi,
  },
};

const CONSTRUCT_ACTIONS = new Set(["construct", "constructAll", "constructShips"]);

function messageFromUnknownError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export function ShipActionButton({
  action,
  shipId,
  shipIds,
  ships,
  children,
  className = "",
  disabled = false,
  onSuccess,
  onError,
}: ShipActionButtonProps) {
  const config = SHIP_ACTION_CONFIG[action];
  const isConstructAction = CONSTRUCT_ACTIONS.has(action);

  // Generate transaction ID based on action and parameters
  const transactionId = React.useMemo(() => {
    switch (action) {
      case "construct":
        return `construct-ship-${shipId}`;
      case "constructAll":
        return "construct-all-ships";
      case "constructShips":
        return `construct-ships-${shipIds?.length || 0}`;
      case "recycle":
        return `recycle-ships-${shipIds?.join("-")}`;
      default:
        return `ship-action-${action}`;
    }
  }, [action, shipId, shipIds]);

  // Prepare arguments based on action
  const args = React.useMemo(() => {
    switch (action) {
      case "construct":
        return shipId ? [shipId] : [];
      case "constructAll":
        return [];
      case "constructShips":
        return shipIds ? [shipIds] : [];
      case "recycle":
        return shipIds ? [shipIds] : [];
      default:
        return [];
    }
  }, [action, shipId, shipIds]);

  // Validation function
  const validateBeforeTransaction = React.useCallback(() => {
    switch (action) {
      case "construct":
        if (!shipId) {
          return "No ship ID provided";
        }
        return true;
      case "constructAll":
        return true;
      case "constructShips":
        if (!shipIds || shipIds.length === 0) {
          return "No ships selected for construction";
        }
        return true;
      case "recycle":
        if (!shipIds || shipIds.length === 0) {
          return "No ships selected for recycling";
        }
        return true;
      default:
        return true;
    }
  }, [action, shipId, shipIds]);

  const handleConstructSuccess = React.useCallback(async () => {
    posthog.capture("ships_constructed", {
      action,
      ship_count: action === "construct" ? 1 : (shipIds?.length ?? 0),
    });
    await onSuccess?.();
  }, [action, shipIds, onSuccess]);

  if (isConstructAction) {
    return (
      <ConstructButton
        transactionId={transactionId}
        functionName={config.functionName}
        args={args}
        ships={ships ?? []}
        className={className}
        disabled={disabled}
        validateBeforeTransaction={validateBeforeTransaction}
        onSuccess={handleConstructSuccess}
        onError={onError}
      >
        {children}
      </ConstructButton>
    );
  }

  return (
    <TransactionButton
      transactionId={transactionId}
      contractAddress={CONTRACT_ADDRESSES.SHIPS as `0x${string}`}
      abi={config.abi}
      functionName={config.functionName}
      args={args}
      className={className}
      disabled={disabled}
      loadingText={`[${action.toUpperCase()}...]`}
      errorText={`[ERROR ${action.toUpperCase()}]`}
      onSuccess={async () => {
        posthog.capture("ships_recycled", { ship_count: shipIds?.length ?? 0 });
        await onSuccess?.();
      }}
      onError={onError}
      validateBeforeTransaction={validateBeforeTransaction}
    >
      {children}
    </TransactionButton>
  );
}

// Construct actions run through useConstructShips (re-read the ships, check
// the construction window, then one constructShips/constructAllMyShips
// signature) — more than TransactionButton's single call, so this drives it
// imperatively, reusing TransactionButton's global pending-transaction
// context so it still disables/reflects state alongside every other button.
function ConstructButton({
  transactionId,
  functionName,
  args,
  ships,
  children,
  className,
  disabled,
  validateBeforeTransaction,
  onSuccess,
  onError,
}: {
  transactionId: string;
  functionName: string;
  args: unknown[];
  ships: Ship[];
  children: React.ReactNode;
  className: string;
  disabled: boolean;
  validateBeforeTransaction: () => boolean | string;
  onSuccess: TransactionFollowUp;
  onError?: (error: Error) => void;
}) {
  const constructShips = useConstructShips();
  const {
    transactionState,
    startTransaction,
    completeTransaction,
  } = useTransaction();

  const [isRunning, setIsRunning] = React.useState(false);

  const isActiveTransaction = transactionState.activeTransactionId === transactionId;
  const isDisabled =
    disabled ||
    isRunning ||
    (transactionState.isPending && !isActiveTransaction);

  const handleClick = async () => {
    const validation = validateBeforeTransaction();
    if (validation !== true) {
      toast.error(validation as string);
      return;
    }

    setIsRunning(true);
    startTransaction(transactionId);
    try {
      const ids =
        functionName === "constructShips"
          ? ((args[0] as bigint[] | undefined) ?? [])
          : functionName === "constructShip"
            ? (args[0] != null ? [args[0] as bigint] : [])
            : ships.filter((s) => !s.shipData.constructed).map((s) => s.id);
      await constructShips(functionName === "constructAllMyShips" ? { all: true, ids } : { ids });
      await onSuccess();
      completeTransaction(transactionId, true);
    } catch (err: unknown) {
      const message = messageFromUnknownError(err);
      const error = new Error(message);
      completeTransaction(transactionId, false, error);
      const friendly = constructErrorMessage(message);
      toast.error(friendly ?? "Transaction declined by user");
      if (message.includes("ShipConstructed") || message.includes("0xa6639c3e")) {
        void onSuccess();
      }
      onError?.(error);
    } finally {
      setIsRunning(false);
    }
  };

  const cleanedClassName = className
    .replace(/\brounded(-\w+)?\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return (
    <button
      onClick={() => void handleClick()}
      disabled={isDisabled}
      className={`${cleanedClassName} ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
      style={{ borderRadius: 0 }}
    >
      {isRunning ? "[CONSTRUCTING...]" : children}
    </button>
  );
}

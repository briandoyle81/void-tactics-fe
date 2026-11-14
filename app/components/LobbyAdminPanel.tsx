"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useChainAccount } from "@/app/near/useChainAccount";
import { toast } from "react-hot-toast";
import { TransactionButton } from "./TransactionButton";
import { useLobbiesOwner } from "../hooks/useLobbiesContract";
import { formatUnits18, parseUnits18 } from "@/app/near/codec";
import { useLobbyConfig } from "@/app/near/useGameSettings";

const inputClass =
  "w-full px-3 py-2 bg-near-black border text-cyan focus:outline-none focus:ring-2 focus:ring-cyan";
const inputStyle = { borderRadius: 0, borderColor: "var(--color-cyan)" } as const;

const SECONDS_PER_DAY = 86400;

// Owner-only lobby settings on the game contract. The contract sets them
// all at once (set_lobby_config); the fields start from get_lobby_config.
// Also withdraws UTC the contract collected (lobby fees, repairs) to any
// account.
export function LobbyAdminPanel() {
  const { address } = useChainAccount();
  const { data: owner, isLoading: ownerLoading } = useLobbiesOwner();

  const [freeGames, setFreeGames] = useState("1");
  const [additionalFee, setAdditionalFee] = useState("1");
  const [reservedFee, setReservedFee] = useState("1");
  const [maxCost, setMaxCost] = useState("1000");
  const [days, setDays] = useState("7");
  const [withdrawTo, setWithdrawTo] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");

  useEffect(() => {
    if (!withdrawTo && address) setWithdrawTo(address);
  }, [address, withdrawTo]);

  const { data: current } = useLobbyConfig();
  useEffect(() => {
    if (!current) return;
    setFreeGames(String(current.free_games_per_address));
    setAdditionalFee(formatUnits18(BigInt(current.additional_lobby_fee)));
    setReservedFee(formatUnits18(BigInt(current.reserved_lobby_fee)));
    setMaxCost(String(current.max_fleet_cost_limit));
    setDays(String(current.stale_threshold_s / SECONDS_PER_DAY));
  }, [current]);

  const config = useMemo(() => {
    try {
      const d = Number(days);
      if (!(d > 0)) return null;
      return {
        free_games_per_address: Number(freeGames),
        additional_lobby_fee: parseUnits18(additionalFee).toString(),
        reserved_lobby_fee: parseUnits18(reservedFee).toString(),
        max_fleet_cost_limit: Number(maxCost),
        stale_threshold_s: Math.floor(d * SECONDS_PER_DAY),
      };
    } catch {
      return null;
    }
  }, [freeGames, additionalFee, reservedFee, maxCost, days]);

  const withdraw = useMemo(() => {
    try {
      if (!withdrawTo.trim() || !withdrawAmount.trim()) return null;
      return { amount: parseUnits18(withdrawAmount).toString(), to: withdrawTo.trim() };
    } catch {
      return null;
    }
  }, [withdrawTo, withdrawAmount]);

  if (ownerLoading || !address || owner !== address) return null;

  const field = (label: string, value: string, set: (v: string) => void, type = "text") => (
    <div>
      <label className="block text-xs text-cyan mb-1">{label}</label>
      <input type={type} value={value} onChange={(e) => set(e.target.value)} className={inputClass} style={inputStyle} />
    </div>
  );

  return (
    <div className="mt-8 space-y-3 border border-purple-400 bg-black/40 p-4" style={{ borderRadius: 0 }}>
      <h4 className="text-lg font-bold text-purple tracking-widest">[LOBBY SETTINGS]</h4>
      <p className="text-xs text-text-muted">
        Sets every lobby setting at once. Fees are in UTC. An open, unjoined lobby older than the stale threshold can be pruned by anyone.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {field("Free lobbies per player", freeGames, setFreeGames, "number")}
        {field("Extra lobby fee (UTC)", additionalFee, setAdditionalFee)}
        {field("Reserved lobby fee (UTC)", reservedFee, setReservedFee)}
        {field("Max fleet cost limit", maxCost, setMaxCost, "number")}
        {field("Stale threshold (days)", days, setDays, "number")}
      </div>
      <TransactionButton
        transactionId="lobbies-set-config"
        call={config ? { method: "set_lobby_config", args: config } : null}
        validateBeforeTransaction={() => !!config || "Fill in every field"}
        onSuccess={() => {
          toast.success("Lobby settings saved");
        }}
        className="px-4 py-2 border-2 border-cyan text-cyan hover:bg-cyan/10 font-mono font-bold tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
      >
        [SAVE LOBBY SETTINGS]
      </TransactionButton>

      <p className="text-xs text-text-muted pt-2">Withdraw UTC the contract collected (lobby fees, repairs).</p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[16rem]">{field("Withdraw to (account)", withdrawTo, setWithdrawTo)}</div>
        <div className="w-40">{field("Amount (UTC)", withdrawAmount, setWithdrawAmount)}</div>
        <TransactionButton
          transactionId="lobbies-withdraw-utc"
          call={withdraw ? { method: "withdraw_utc", args: withdraw } : null}
          validateBeforeTransaction={() => !!withdraw || "Enter an account and an amount"}
          onSuccess={() => {
            toast.success(`UTC withdrawn to ${withdrawTo}`);
          }}
          className="px-4 py-2 border-2 border-cyan text-cyan hover:bg-cyan/10 font-mono font-bold tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
        >
          [WITHDRAW]
        </TransactionButton>
      </div>
    </div>
  );
}

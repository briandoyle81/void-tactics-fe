"use client";

import React from "react";
import { toast } from "react-hot-toast";

/** Icon button that copies a wallet address (header callsign, Profile). */
export function CopyAddressButton({ address, className = "" }: { address: string; className?: string }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      toast.success("Address copied to clipboard!");
    } catch {
      toast.error("Couldn't copy the address.");
    }
  };

  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label="Copy address"
      title="Copy address"
      className={`flex h-6 w-6 shrink-0 items-center justify-center text-text-muted transition-colors duration-150 hover:text-cyan ${className}`}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <rect x="9" y="9" width="13" height="13" rx="1" />
        <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
      </svg>
    </button>
  );
}

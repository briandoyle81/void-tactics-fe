import { erc20Abi, type Abi, type Address, type PublicClient } from "viem";

/**
 * A transaction an action needs first, such as letting a contract spend the
 * player's UTC. TransactionButton (`approvals`) sends each one that's
 * needed, waits for it to confirm, then sends its own transaction: one
 * click, as a ship purchase goes straight on to construction.
 */
export interface ApprovalStep {
  /** The button's text while it's being sent and confirmed, e.g. "[APPROVING 1 UTC...]". */
  loadingText: string;
  /** Whether it's still needed, read fresh when the player clicks. */
  isNeeded: (client: PublicClient) => Promise<boolean>;
  call: { address: Address; abi: Abi; functionName: string; args: readonly unknown[] };
}

/**
 * Lets `spender` take `amount` of an ERC-20 (e.g. UTC) from `owner`, when
 * its allowance is short. It approves `amount`, or `approveAmount` when given
 * (e.g. the maximum, for Permit2).
 */
export function erc20Approval(params: {
  token: Address;
  owner: Address;
  spender: Address;
  amount: bigint;
  approveAmount?: bigint;
  loadingText: string;
}): ApprovalStep {
  const { token, owner, spender, amount, approveAmount = amount, loadingText } = params;
  return {
    loadingText,
    isNeeded: async (client) => {
      if (amount <= 0n) return false;
      const allowance = await client.readContract({
        address: token,
        abi: erc20Abi,
        functionName: "allowance",
        args: [owner, spender],
      });
      return allowance < amount;
    },
    call: { address: token, abi: erc20Abi as Abi, functionName: "approve", args: [spender, approveAmount] },
  };
}

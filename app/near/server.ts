
/**
 * Server-side NEAR signing for the routes CLAUDE.md allows a backend for:
 * privileged calls a player's own key can't make (the faucet's transfer,
 * the Verifier role's mark_verified). Each route names its own account and
 * key env vars; the key should be a function-call key limited to the game
 * contract wherever the call carries no deposit.
 */
import { Account, JsonRpcProvider, KeyPair, KeyPairSigner, actions, type KeyPairString } from "near-api-js";
import { GAME_CONTRACT, GAS_HEAVY } from "./config";
import { toReceipt, type NearOutcomeLike, type NearReceipt } from "./codec";

const RPC_URL =
  process.env.NEAR_SERVER_RPC_URL || process.env.NEXT_PUBLIC_NEAR_RPC_URL || "https://test.rpc.fastnear.com";

export function serverAccount(accountId: string, privateKey: string): Account {
  return new Account(
    accountId,
    new JsonRpcProvider({ url: RPC_URL }),
    new KeyPairSigner(KeyPair.fromString(privateKey as KeyPairString)),
  );
}

/** One game-contract call from a server account; resolves with the executed transaction. */
export async function serverCall(
  account: Account,
  method: string,
  args: object,
  { deposit = BigInt(0), gas = GAS_HEAVY }: { deposit?: bigint; gas?: bigint } = {},
): Promise<NearReceipt> {
  const outcome = (await account.signAndSendTransaction({
    receiverId: GAME_CONTRACT,
    actions: [actions.functionCall(method, args, gas, deposit)],
    waitUntil: "EXECUTED_OPTIMISTIC",
    throwOnFailure: false,
  })) as unknown as NearOutcomeLike;
  return toReceipt(outcome);
}

/** Never log a raw error from a send: it can include the RPC URL and a key in it. */
export function safeErrorMessage(e: unknown): string {
  return String((e as Error)?.message ?? e)
    .replace(/https?:\/\/\S+/g, "<rpc>")
    .slice(0, 300);
}

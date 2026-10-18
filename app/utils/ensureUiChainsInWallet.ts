import { numberToHex } from "viem";
import { type SupportedChain } from "../config/networks";

export type Eip1193Requester = {
  request: (args: { method: string; params?: unknown }) => Promise<unknown>;
};

function readSingleRpcErrorCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const e = error as {
    code?: unknown;
    data?: { originalError?: { code?: unknown } };
  };
  if (typeof e.code === "number" && Number.isFinite(e.code)) return e.code;
  if (typeof e.code === "string") {
    const n = Number(e.code);
    return Number.isFinite(n) ? n : undefined;
  }
  const nested = e.data?.originalError?.code;
  if (typeof nested === "number" && Number.isFinite(nested)) return nested;
  if (typeof nested === "string") {
    const n = Number(nested);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

/** Reads RPC-style `code`, including nested `cause` (wagmi / viem errors) and MetaMask `originalError`. */
export function readRpcErrorCode(error: unknown): number | undefined {
  let current: unknown = error;
  for (let i = 0; i < 8 && current != null; i++) {
    const code = readSingleRpcErrorCode(current);
    if (code !== undefined) return code;
    if (typeof current === "object" && current !== null && "cause" in current) {
      current = (current as { cause: unknown }).cause;
    } else {
      break;
    }
  }
  return undefined;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return "";
}

export function isUserRejectedWalletError(error: unknown): boolean {
  const code = readRpcErrorCode(error);
  if (code === 4001) return true;
  return /user rejected|denied transaction|rejected the request/i.test(
    errorMessage(error),
  );
}

/** True when the wallet already knows this chain (add is redundant). */
export function isChainAlreadyInWalletError(error: unknown): boolean {
  const msg = errorMessage(error);
  if (
    /already been added|already added|duplicate|network exists|already exists|chain already added|known network|already configured|same chain id|matching chain id/i.test(
      msg,
    )
  ) {
    return true;
  }
  const code = readRpcErrorCode(error);
  if (code === -32603 && /chain|network|already|duplicate|exists/i.test(msg)) {
    return true;
  }
  return false;
}

export function buildAddEthereumChainParameter(chain: SupportedChain) {
  const rawRpc = chain.rpcUrls.default?.http ?? [];
  const rpcUrls = rawRpc.filter(
    (u) => typeof u === "string" && u.length > 0,
  ) as string[];
  if (rpcUrls.length === 0) {
    throw new Error(`No RPC URL configured for ${chain.name}`);
  }
  const blockExplorerUrls = chain.blockExplorers?.default
    ? [chain.blockExplorers.default.url]
    : undefined;
  return {
    chainName: chain.name,
    nativeCurrency: chain.nativeCurrency,
    rpcUrls,
    blockExplorerUrls,
  };
}

export async function addEthereumChainViaWallet(
  provider: Eip1193Requester,
  chainId: number,
  add: ReturnType<typeof buildAddEthereumChainParameter>,
) {
  await provider.request({
    method: "wallet_addEthereumChain",
    params: [
      {
        chainId: numberToHex(chainId),
        chainName: add.chainName,
        nativeCurrency: add.nativeCurrency,
        rpcUrls: add.rpcUrls,
        blockExplorerUrls: add.blockExplorerUrls,
      },
    ],
  });
}

export function messageHintsMissingChain(error: unknown): boolean {
  let current: unknown = error;
  for (let i = 0; i < 8 && current != null; i++) {
    const m =
      current instanceof Error
        ? current.message
        : typeof current === "object" &&
            current !== null &&
            "message" in current &&
            typeof (current as { message: unknown }).message === "string"
          ? (current as { message: string }).message
          : "";
    if (
      /unrecognized chain id/i.test(m) ||
      /wallet_addEthereumChain/i.test(m)
    ) {
      return true;
    }
    if (typeof current === "object" && current !== null && "cause" in current) {
      current = (current as { cause: unknown }).cause;
    } else {
      break;
    }
  }
  return false;
}

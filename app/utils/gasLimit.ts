import { BaseError, ContractFunctionRevertedError, ExecutionRevertedError } from "viem";

// Gas limits for the big setup calls (RoguelikeMatch.enterCombatNode,
// SinglePlayerMatch.startNodeMatch), whose cost grows with both fleets'
// ship counts. They're still sent with an explicit `gas` (leaving it to
// the wallet isn't reliable under Dynamic's server-side signing), but it's
// the node's own estimate plus headroom instead of one fixed number, which
// a 7-ship fleet on a later node outgrew (~6M against a 5.5M cap: an
// out-of-gas revert with no reason).

/** Headroom over the estimate: 25%. */
const HEADROOM_NUM = 125n;
const HEADROOM_DEN = 100n;

/**
 * `estimate()` plus headroom, never below `floor`. If the estimate fails
 * because the call itself reverts, that error is thrown (it carries the
 * contract's reason); any other failure falls back to `fallback`.
 */
export async function paddedGasLimit(
  estimate: () => Promise<bigint>,
  floor: bigint,
  fallback: bigint,
): Promise<bigint> {
  try {
    const padded = ((await estimate()) * HEADROOM_NUM) / HEADROOM_DEN;
    return padded > floor ? padded : floor;
  } catch (err) {
    const reverted =
      err instanceof BaseError &&
      err.walk((e) => e instanceof ContractFunctionRevertedError || e instanceof ExecutionRevertedError);
    if (reverted) throw err;
    console.warn("[gas] estimate failed, using the fallback limit", err);
    return fallback;
  }
}

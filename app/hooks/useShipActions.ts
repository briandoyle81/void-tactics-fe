import { toast } from "react-hot-toast";
import { useCallback, useState } from "react";
import { useChainAccount } from "../near/useChainAccount";
import { useNearSession } from "../near/session";
import { GAS_DEFAULT, gasForShips } from "../near/config";
import { isUserRejection, shortErrorMessage } from "../near/errors";
import { useOwnedShips } from "./useOwnedShips";

/**
 * Ship actions. Ships construct themselves after minting, so the only
 * manual one is construct_ship for a ship that couldn't (storage ran out);
 * recycling returns UTC (free ships can't be recycled).
 */
export function useShipActions() {
  const { address } = useChainAccount();
  const { send } = useNearSession();
  const { refetch } = useOwnedShips();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const run = useCallback(
    async (work: () => Promise<unknown>, success: string, failure: string) => {
      if (!address) {
        toast.error("Please sign in first");
        return;
      }
      setIsPending(true);
      setError(null);
      try {
        await work();
        toast.success(success);
        await refetch();
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        toast.error(isUserRejection(e) ? "Transaction declined" : `${failure}: ${shortErrorMessage(e)}`);
      } finally {
        setIsPending(false);
      }
    },
    [address, refetch],
  );

  /** Builds a ship that stayed unconstructed (e.g. storage ran out at mint). */
  const constructShip = useCallback(
    (shipId: bigint) =>
      run(
        () => send({ method: "construct_ship", args: { ship_id: shipId.toString() }, gas: gasForShips(1) }),
        "Ship constructed!",
        "Couldn't construct ship",
      ),
    [run, send],
  );

  const recycleShips = useCallback(
    (shipIds: bigint[]) => {
      if (shipIds.length === 0) {
        toast.error("No ships selected for recycling");
        return Promise.resolve();
      }
      return run(
        () => send({ method: "recycle_ships", args: { ship_ids: shipIds.map(String) }, gas: GAS_DEFAULT }),
        `Recycled ${shipIds.length} ships for UTC!`,
        "Couldn't recycle ships",
      );
    },
    [run, send],
  );

  return { constructShip, recycleShips, isPending, error };
}

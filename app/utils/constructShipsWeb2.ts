import { apiMutate } from "../lib/apiMutate";

/** Web2 counterpart to constructAllMyShips. Shared by Manage Navy and the
 * roguelike roster picker. Resolves with how many ships were constructed. */
export async function constructAllShipsWeb2(): Promise<number> {
  const result = await apiMutate<{ constructed: number }>("/api/ships/construct", "POST", { all: true });
  return result.constructed;
}

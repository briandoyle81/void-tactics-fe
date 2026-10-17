import { parseEventLogs, zeroAddress, type Log } from "viem";

const TRANSFER_EVENT_ABI = [
  {
    type: "event",
    name: "Transfer",
    anonymous: false,
    inputs: [
      { indexed: true, name: "from", type: "address" },
      { indexed: true, name: "to", type: "address" },
      { indexed: true, name: "tokenId", type: "uint256" },
    ],
  },
] as const;

/**
 * Ship ids minted to `owner` in a transaction: the Ships contract's ERC-721
 * Transfer logs from the zero address. Pure, from the receipt's logs.
 */
export function mintedShipIds(
  logs: readonly Log[],
  shipsAddress: string,
  owner: string,
): bigint[] {
  const ships = shipsAddress.toLowerCase();
  const to = owner.toLowerCase();
  return parseEventLogs({ abi: TRANSFER_EVENT_ABI, logs: [...logs], eventName: "Transfer", strict: false })
    .filter(
      (log) =>
        log.address.toLowerCase() === ships &&
        log.args.from?.toLowerCase() === zeroAddress &&
        log.args.to?.toLowerCase() === to &&
        log.args.tokenId != null,
    )
    .map((log) => log.args.tokenId as bigint);
}

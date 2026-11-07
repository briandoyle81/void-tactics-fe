/**
 * The special/faction-ability resolvers' custom errors
 * (contracts: EMPResolver, RamResolver, the repair and drone resolvers).
 * Game.moveShip calls into them, so they can come back from a move, but
 * they're declared on the resolvers, not in Game's ABI. Appended to the ABI
 * a move is sent with so viem decodes them by name (e.g. OutOfRange instead
 * of the raw selector 0x7db3aba7).
 */
export const RESOLVER_ERRORS = [
  { type: "error", name: "OutOfRange", inputs: [] },
  { type: "error", name: "TargetNotFound", inputs: [] },
  { type: "error", name: "TargetNotEnemy", inputs: [] },
  { type: "error", name: "TargetNotFriendly", inputs: [] },
  { type: "error", name: "InvalidRamTarget", inputs: [] },
  { type: "error", name: "NotOwner", inputs: [] },
] as const;

/**
 * Alpha Discord invite. Override with NEXT_PUBLIC_ALPHA_DISCORD_URL (e.g. https://discord.gg/yourcode).
 */
export const ALPHA_DISCORD_INVITE_URL =
  process.env.NEXT_PUBLIC_ALPHA_DISCORD_URL?.trim() ||
  "https://discord.gg/SPzndFWvHZ";

/** The only wallet address allowed to view and edit the Maps tab. */
export const MAP_ADMIN_ADDRESS = "0x69a5B3aE8598fC5A5419eaa1f2A59Db2D052e346";

/**
 * Web2-mode counterpart to MAP_ADMIN_ADDRESS / the onchain contract-owner
 * checks (useShipAttributesOwner, useShipPurchasePricesAccess) — there's no
 * wallet in web2 mode, so admin access to the Maps / Ship Attributes /
 * Purchase Prices tabs is instead gated on the signed-in Google account's
 * email being in this list.
 */
export const WEB2_ADMIN_EMAILS = ["briandoyle81@gmail.com"];

/**
 * Tournaments are temporarily off in the game client: the Command Deck shows
 * them greyed out under a "Coming Soon" band, the screen can't be opened,
 * and the tournament list isn't fetched. Flip to true to bring them back.
 */
export const TOURNAMENTS_ENABLED = false;

/**
 * Google (web2) sign-in is temporarily hidden: the boot screen offers only
 * the wallet, and the header's sign-in drops the "or Web2 // Email" choice.
 * Players already signed in with Google keep their session. Flip to true to
 * bring it back.
 */
export const WEB2_SIGN_IN_ENABLED = false;

/**
 * The test-ETH gas faucet (/api/faucet/gas, GasGrantClaimer) for Dynamic
 * embedded wallets: on while gas sponsorship is off, so embedded wallets
 * can pay their own gas. Off, the client stops asking and the route refuses.
 */
export const GAS_FAUCET_ENABLED = true;

/**
 * Dynamic's EVM gas sponsorship for the embedded wallet
 * (useSponsoredWriteContract). Off for now: every write goes through wagmi's
 * writeContract and the player pays gas (the embedded wallet's from the gas
 * faucet), even when sponsorship is on in Dynamic's dashboard. Flip to true
 * (and GAS_FAUCET_ENABLED to false) to bring it back.
 */
export const GAS_SPONSORSHIP_ENABLED = false;

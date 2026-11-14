/**
 * Alpha Discord invite. Override with NEXT_PUBLIC_ALPHA_DISCORD_URL (e.g. https://discord.gg/yourcode).
 */
export const ALPHA_DISCORD_INVITE_URL =
  process.env.NEXT_PUBLIC_ALPHA_DISCORD_URL?.trim() ||
  "https://discord.gg/SPzndFWvHZ";

/**
 * Web2-mode counterpart to the onchain MAP_EDITOR role / contract-owner
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
 * The testnet NEAR faucet (/api/faucet/near, account activation in
 * app/near/session.tsx): funds a new player's account so it exists and can
 * pay its first storage deposit. Off, activation can't fund new accounts and
 * the route refuses.
 */
export const GAS_FAUCET_ENABLED = true;

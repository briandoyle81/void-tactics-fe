// Testnet NEAR faucet, for the HUD's NEAR pill and Store › Credits. New
// players are funded automatically on sign-in (app/api/faucet/near); this
// is for topping up by hand.
export const NEAR_TESTNET_FAUCET_URL = "https://near-faucet.io/";

export function getFaucetUrl(): string {
  return NEAR_TESTNET_FAUCET_URL;
}

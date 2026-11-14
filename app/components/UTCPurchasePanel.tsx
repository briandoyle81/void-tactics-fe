"use client";

import React from "react";
import { useChainAccount } from "@/app/near/useChainAccount";
import { useTokenBalance } from "@/app/near/useTokenBalance";
import { TOKEN_UTC } from "@/app/near/config";
import { formatNear, formatUnits18 } from "@/app/near/codec";
import { UTCPurchaseButton } from "./UTCPurchaseButton";
import { UTCPurchasePanelShell } from "./UTCPurchasePanelShell";
import { getFaucetUrl } from "../config/faucets";
import { UTCPurchaseTierCardContent } from "./UTCPurchaseTierCardContent";
import { useShipPurchaserPurchaseInfo } from "../hooks/useShipPurchaserPurchaseInfo";
import { UTC_DISPLAY_DECIMALS, formatBalance } from "../utils/formatBalance";

/** Store › Credits (web3): buy UTC with NEAR. */
const UTCPurchasePanel: React.FC = () => {
  const { address } = useChainAccount();
  const nativeTokenSymbol = "NEAR";

  const {
    tiers,
    pricesWei,
    flowPricesWei,
    shipsPerTier,
    tierCount,
    isLoading: isLoadingTiers,
    purchaserDeployed,
  } = useShipPurchaserPurchaseInfo();

  // buy_utc_with_near takes a tier's NEAR price and mints that tier's ship
  // pack UTC price, so buying UTC and then ships with it costs the same as
  // buying the ships.
  const { data: utcBalance, refetch: refetchUTCBalance } = useTokenBalance(address, TOKEN_UTC);

  const getTierColors = (tier: number) => {
    switch (tier) {
      case 0:
        return {
          border: "border-amber",
          text: "text-amber",
          hoverBorder: "hover:border-amber",
          hoverText: "hover:text-amber",
          hoverBg: "hover:bg-amber/10",
        };
      case 1:
        return {
          border: "border-text-muted",
          text: "text-text-muted",
          hoverBorder: "hover:border-text-secondary",
          hoverText: "hover:text-text-secondary",
          hoverBg: "hover:bg-text-muted/10",
        };
      case 2:
        return {
          border: "border-phosphor-green",
          text: "text-phosphor-green",
          hoverBorder: "hover:border-phosphor-green",
          hoverText: "hover:text-phosphor-green",
          hoverBg: "hover:bg-phosphor-green/10",
        };
      case 3:
        return {
          border: "border-cyan",
          text: "text-cyan",
          hoverBorder: "hover:border-cyan",
          hoverText: "hover:text-cyan",
          hoverBg: "hover:bg-cyan/10",
        };
      case 4:
        return {
          border: "border-purple",
          text: "text-purple",
          hoverBorder: "hover:border-purple",
          hoverText: "hover:text-purple",
          hoverBg: "hover:bg-purple/10",
        };
      default:
        return {
          border: "border-amber",
          text: "text-amber",
          hoverBorder: "hover:border-amber",
          hoverText: "hover:text-amber",
          hoverBg: "hover:bg-amber/10",
        };
    }
  };

  const handlePurchaseSuccess = async () => {
    await refetchUTCBalance();
  };

  return (
    <UTCPurchasePanelShell
      balanceValueLabel={
        `${formatBalance(utcBalance ? Number(formatUnits18(utcBalance)) : 0, UTC_DISPLAY_DECIMALS)} UTC`
      }
      balanceDescription={
        <>
          Universal Time Credits (UTC) are the in-game balance token. Spend
          them to reserve games, repair, refit, or buy ship packs. This
          purchase only adds UTC to your wallet.
        </>
      }
      balanceFooter={
        <p className="mt-2 text-xs font-mono text-cyan/85">
          Need {nativeTokenSymbol}?{" "}
          <a
            href={getFaucetUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-cyan underline underline-offset-2"
          >
            Get it from the faucet
          </a>{" "}
          during Alpha.
        </p>
      }
      chooseAmountDescription={
        <>
          Each amount costs the same as the ship pack it buys, so you can buy
          the UTC now and the ships later at no extra cost.
        </>
      }
    >
        {!purchaserDeployed ? (
          <p className="text-center text-warning-red font-mono py-6">
            UTC purchases aren&apos;t available on this network.
          </p>
        ) : isLoadingTiers && tierCount === 0 ? (
          <p className="text-center text-text-muted font-mono py-6">
            Loading UTC purchase options…
          </p>
        ) : tierCount === 0 ? (
          <p className="text-center text-warning-red font-mono py-6">
            No UTC purchase tiers are set yet.
          </p>
        ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tiers.map((tier, index) => {
            // Pay the tier's native-token price; receive its ship pack's UTC price.
            const flowCost = flowPricesWei[index];
            if (flowCost === undefined) return null;
            const flowCostFormatted = formatNear(flowCost, 4);
            const colors = getTierColors(tier);
            const utcDisplay = formatUnits18(pricesWei[index] ?? BigInt(0));
            const ships = shipsPerTier[index];

            return (
              <UTCPurchaseButton
                key={index}
                tier={tier}
                flowCost={flowCost}
                utcAmount={utcDisplay}
                className={`relative min-h-0 px-4 py-4 rounded-none border-2 ${colors.border} ${colors.text} ${colors.hoverBorder} ${colors.hoverText} ${colors.hoverBg} font-mono tracking-wider transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-left`}
                refetch={refetchUTCBalance}
                onSuccess={handlePurchaseSuccess}
              >
                <UTCPurchaseTierCardContent
                  utcAmountLabel={`${utcDisplay} UTC`}
                  payLabel={`${flowCostFormatted} ${nativeTokenSymbol}`}
                  footerLabel={ships ? `Buys the ${ships}-ship pack` : `[Click to buy with ${nativeTokenSymbol}]`}
                />
              </UTCPurchaseButton>
            );
          })}
        </div>
        )}
    </UTCPurchasePanelShell>
  );
};

export default UTCPurchasePanel;

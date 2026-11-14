"use client";

import Store from "./Store";
import StoreWeb2 from "./StoreWeb2";
import UTCPurchasePanel from "./UTCPurchasePanel";
import UTCPurchasePanelWeb2 from "./UTCPurchasePanelWeb2";
import DroneStorefront from "./DroneStorefront";
import DroneStorefrontWeb2 from "./DroneStorefrontWeb2";
import { SubTabs } from "./SubTabs";
import { useAppMode } from "../hooks/useAppMode";
import { STORE_SECTIONS, type StoreSection } from "./storeSections";

// The Store: what you're buying, by sub-tab. Payment is chosen at checkout
// (ship packs) or by the item itself (credits, cores). The HUD's + buttons
// open the matching sub-tab.

const SECTION_LABELS: Record<StoreSection, string> = {
  packs: "Ship packs",
  credits: "Credits (UTC)",
  cores: "Cores (DCC)",
};
/** Phone labels, so every tab fits on one line. */
const SECTION_SHORT_LABELS: Record<StoreSection, string> = {
  packs: "Packs",
  credits: "Credits",
  cores: "Cores",
};

export function StoreScreen({
  section,
  onSection,
}: {
  section: StoreSection;
  onSection: (section: StoreSection) => void;
}) {
  const isWeb2 = useAppMode() === "web2";
  const sections = STORE_SECTIONS;
  const active = sections.includes(section) ? section : "packs";

  return (
    <div className="w-full">
      <SubTabs
        label="Store sections"
        tabs={sections.map((id) => ({ id, label: SECTION_LABELS[id], shortLabel: SECTION_SHORT_LABELS[id] }))}
        active={active}
        onSelect={onSection}
      />
      {active === "packs" && (isWeb2 ? <StoreWeb2 /> : <Store />)}
      {active === "credits" && (isWeb2 ? <UTCPurchasePanelWeb2 /> : <UTCPurchasePanel />)}
      {active === "cores" && (isWeb2 ? <DroneStorefrontWeb2 /> : <DroneStorefront />)}
    </div>
  );
}

import ShipsContract from "../contracts/artifacts/DeployModule#Ships.json";
import LobbiesContract from "../contracts/artifacts/DeployModule#Lobbies.json";
import FleetsContract from "../contracts/artifacts/DeployModule#Fleets.json";
import GameContract from "../contracts/artifacts/DeployModule#Game.json";
import UniversalCreditsContract from "../contracts/artifacts/DeployModule#UniversalCredits.json";
import MapsContract from "../contracts/artifacts/DeployModule#Maps.json";
import ShipAttributesContract from "../contracts/artifacts/DeployModule#ShipAttributes.json";
import DroneYardContract from "../contracts/artifacts/DeployModule#DroneYard.json";
import DroneEnergyCoresContract from "../contracts/artifacts/DeployModule#DroneEnergyCores.json";
import TutorialClaimContract from "../contracts/artifacts/DeployModule#TutorialClaim.json";
import ShipPurchaserContract from "../contracts/artifacts/DeployModule#ShipPurchaser.json";
import TournamentContract from "../contracts/artifacts/DeployModule#Tournament.json";
import GameBlobRegistryContract from "../contracts/artifacts/DeployModule#GameBlobRegistry.json";
import SinglePlayerMatchContract from "../contracts/artifacts/DeployModule#SinglePlayerMatch.json";
import AIEncountersContract from "../contracts/artifacts/DeployModule#AIEncounters.json";
import PvPMatchContract from "../contracts/artifacts/DeployModule#PvPMatch.json";
import NodeMapContract from "../contracts/artifacts/DeployModule#NodeMap.json";
import AIShipsContract from "../contracts/artifacts/DeployModule#AIShips.json";
import ShipsRouterContract from "../contracts/artifacts/DeployModule#ShipsRouter.json";
import DroneStorefrontContract from "../contracts/artifacts/DeployModule#DroneStorefront.json";
import FreeShipClaimContract from "../contracts/artifacts/DeployModule#FreeShipClaim.json";
import RamResolverContract from "../contracts/artifacts/DeployModule#RamResolver.json";
import RepairResolverContract from "../contracts/artifacts/DeployModule#RepairResolver.json";
import DroneNamesContract from "../contracts/artifacts/DeployModule#DroneNames.json";
import VariantPurchaseGateContract from "../contracts/artifacts/DeployModule#VariantPurchaseGate.json";
import ShatteredHiveMedalContract from "../contracts/artifacts/DeployModule#ShatteredHiveMedal.json";
import RoguelikeNodeMapContract from "../contracts/artifacts/DeployModule#RoguelikeNodeMap.json";
import RoguelikeRunContract from "../contracts/artifacts/DeployModule#RoguelikeRun.json";
import RoguelikeMatchContract from "../contracts/artifacts/DeployModule#RoguelikeMatch.json";
import RoguelikeResupplyContract from "../contracts/artifacts/DeployModule#RoguelikeResupply.json";
import RandomManagerContract from "../contracts/artifacts/DeployModule#RandomManager.json";
import GameLensContract from "../contracts/artifacts/DeployModule#GameLens.json";
import DECBonusWinEffectContract from "../contracts/artifacts/DeployModule#DECBonusWinEffect.json";
import HealAboveFloorWinEffectContract from "../contracts/artifacts/DeployModule#HealAboveFloorWinEffect.json";
import ShipGrantWinEffectContract from "../contracts/artifacts/DeployModule#ShipGrantWinEffect.json";
import FactionRewardTokenRegistryContract from "../contracts/artifacts/DeployModule#FactionRewardTokenRegistry.json";
import SelfieCheckEligibilityProviderContract from "../contracts/artifacts/DeployModule#SelfieCheckEligibilityProvider.json";
import GameEngineRegistryContract from "../contracts/artifacts/DeployModule#GameEngineRegistry.json";

export * from "./contractAddresses";

// Contract ABIs
export const CONTRACT_ABIS = {
  SHIPS: ShipsContract.abi,
  LOBBIES: LobbiesContract.abi,
  FLEETS: FleetsContract.abi,
  GAME: GameContract.abi,
  UNIVERSAL_CREDITS: UniversalCreditsContract.abi,
  MAPS: MapsContract.abi,
  SHIP_ATTRIBUTES: ShipAttributesContract.abi,
  DRONE_YARD: DroneYardContract.abi,
  DRONE_ENERGY_CORES: DroneEnergyCoresContract.abi,
  TUTORIAL_CLAIM: TutorialClaimContract.abi,
  SHIP_PURCHASER: ShipPurchaserContract.abi,
  TOURNAMENT: TournamentContract.abi,
  GAME_BLOB_REGISTRY: GameBlobRegistryContract.abi,
  SINGLE_PLAYER_MATCH: SinglePlayerMatchContract.abi,
  AI_ENCOUNTERS: AIEncountersContract.abi,
  PVP_MATCH: PvPMatchContract.abi,
  NODE_MAP: NodeMapContract.abi,
  AI_SHIPS: AIShipsContract.abi,
  SHIPS_ROUTER: ShipsRouterContract.abi,
  DRONE_STOREFRONT: DroneStorefrontContract.abi,
  FREE_SHIP_CLAIM: FreeShipClaimContract.abi,
  RAM_RESOLVER: RamResolverContract.abi,
  REPAIR_RESOLVER: RepairResolverContract.abi,
  DRONE_NAMES: DroneNamesContract.abi,
  VARIANT_PURCHASE_GATE: VariantPurchaseGateContract.abi,
  SHATTERED_HIVE_MEDAL: ShatteredHiveMedalContract.abi,
  ROGUELIKE_NODE_MAP: RoguelikeNodeMapContract.abi,
  ROGUELIKE_RUN: RoguelikeRunContract.abi,
  ROGUELIKE_MATCH: RoguelikeMatchContract.abi,
  ROGUELIKE_RESUPPLY: RoguelikeResupplyContract.abi,
  RANDOM_MANAGER: RandomManagerContract.abi,
  GAME_LENS: GameLensContract.abi,
  DEC_BONUS_WIN_EFFECT: DECBonusWinEffectContract.abi,
  HEAL_ABOVE_FLOOR_WIN_EFFECT: HealAboveFloorWinEffectContract.abi,
  SHIP_GRANT_WIN_EFFECT: ShipGrantWinEffectContract.abi,
  FACTION_REWARD_TOKEN_REGISTRY: FactionRewardTokenRegistryContract.abi,
  SELFIE_CHECK_ELIGIBILITY_PROVIDER: SelfieCheckEligibilityProviderContract.abi,
  GAME_ENGINE_REGISTRY: GameEngineRegistryContract.abi,
} as const;

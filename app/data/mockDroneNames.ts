// Drone-faction (variant 2) names for decorative/demo ship displays, so
// they don't need an RPC call. Sampled from DroneNames.getRandomDroneName on
// Base Sepolia, so they match what real drone ships are called. Variant-1
// demo names are SHIP_NAMES in generateRandomShip.ts.
export const MOCK_DRONE_NAMES: readonly string[] = [
  "JW1-54 Cinder", "ZQ-13 Umbra", "P2-008 Jackal", "V-111 Basalt", "FX-788 Rime",
  "C9-130 Slate", "TH-34 Nova", "QX-744 Viper", "HM-409 Flint", "1R-83 Slate",
  "K8-631 Flint", "TJ0-03 Comet", "4K-53 Raven", "L8-100 Onyx", "R-365 Nadir",
  "9G-19 Rook", "DR-61 Onyx", "RD-32 Grit", "XT2-27 Orbit", "1P-50 Shrike",
  "TB-805 Basalt", "R-018 Umbra", "T6-759 Jackal", "T-173 Cinder", "RF-823 Orbit",
  "T-096 Viper", "DJ2-77 Grit", "M7-124 Rime", "7X-48 Nadir", "XB-456 Mantis",
  "2J-39 Auger", "L-215 Pulsar", "Q0-799 Hornet", "G1-127 Auger", "TM-043 Raven",
  "MP2-99 Vector", "L-699 Helix", "J-760 Moth", "K-232 Shale", "KS7-60 Ash",
  "N6-997 Helix", "8Z-81 Vector", "ZF-034 Kestrel", "J-349 Shale", "KQ-56 Wasp",
  "CS-907 Rook", "3R-44 Slate", "MT-072 Slate", "F-708 Flint", "Q-590 Flint",
];

export function randomMockDroneName(): string {
  return MOCK_DRONE_NAMES[Math.floor(Math.random() * MOCK_DRONE_NAMES.length)];
}

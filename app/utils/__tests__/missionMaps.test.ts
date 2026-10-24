import { describe, expect, it } from "vitest";
import { nodeMapId, rememberNodeMaps, upcomingMissionNodeIds } from "../missionMaps";

describe("missionMaps", () => {
  it("remembers which map each node uses", () => {
    rememberNodeMaps([
      { nodeId: 5, mapId: 68 },
      { nodeId: 6, mapId: 0 },
    ]);
    expect(nodeMapId(5)).toBe(68);
    expect(nodeMapId(6)).toBeNull();
    expect(nodeMapId(99)).toBeNull();
  });

  it("lists where the run is and the missions next from it", () => {
    const nodes = [
      { id: 1, childIds: [2] },
      { id: 2, childIds: [3, 4] },
    ];
    expect(upcomingMissionNodeIds(nodes, 2, 1)).toEqual([2, 3, 4]);
    expect(upcomingMissionNodeIds(nodes, null, 1)).toEqual([1, 2]);
    expect(upcomingMissionNodeIds(nodes, null, null)).toEqual([]);
  });
});

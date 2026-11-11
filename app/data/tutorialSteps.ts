import { TutorialStep } from "../types/onboarding";
import { ActionType } from "../types/types";

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "welcome",
    title: "Welcome aboard",
    description: "Fleet briefing and map orientation",
    // Free look while reading the briefing: any ship, ours or theirs.
    allowedActions: {
      selectShip: ["1001", "1002", "1003", "2001", "2002", "2003"],
    },
    highlightElements: {
      mapPositions: [
        { row: 3, col: 10 },
        { row: 6, col: 12 },
      ],
    },
  },
  {
    id: "goals",
    title: "How we win",
    description: "Victory conditions and scoring",
    // Reading only: the board and fleet list don't respond until the next step.
    allowedActions: {},
    lockControls: true,
    highlightElements: {
      uiElements: ["score-display"],
    },
  },
  {
    id: "select-ship",
    title: "Ship selection",
    description: "Learn to view ship information",
    allowedActions: {
      selectShip: ["1001", "1002", "1003"],
    },
    highlightElements: {
      ships: ["1001", "1002", "1003"],
    },
    onStepComplete: (actionData) => {
      return (
        actionData?.type === "selectShip" && actionData?.shipId !== undefined
      );
    },
  },
  {
    id: "view-enemy",
    title: "Find the Tongs",
    description: "Find an enemy ship with the Fleet Status panel",
    // Any enemy ship can be inspected, but only the Tongs completes the step
    // (and it stays complete after picking another ship).
    allowedActions: {
      selectShip: ["2001", "2002", "2003"],
    },
    highlightElements: {
      ships: ["2003"],
    },
    onStepComplete: (actionData) => {
      return actionData?.type === "selectShip" && actionData.shipId === "2003";
    },
  },
  {
    id: "move-ship",
    title: "Moving ships",
    description: "Learn to move your ships",
    allowedActions: {
      selectShip: ["1003"],
      moveShip: {
        shipId: "1003",
        allowedPositions: [{ row: 6, col: 7 }],
      },
    },
    highlightElements: {
      ships: ["1003"],
      mapPositions: [{ row: 6, col: 7 }],
    },
    requiresTransaction: true,
    onStepComplete: (actionData) => {
      return actionData?.type === "moveShip" && actionData?.shipId === "1003";
    },
  },
  {
    id: "wait-for-opponent",
    title: "Waiting for your opponent",
    description: "Turns alternate one ship at a time; wait for the enemy response",
    allowedActions: {},
    highlightElements: {},
  },
  {
    id: "score-points",
    title: "Scoring points",
    description: "End-of-round scoring and zone control",
    allowedActions: {
      selectShip: ["1001"],
      moveShip: {
        shipId: "1001",
        allowedPositions: [{ row: 5, col: 8 }],
      },
    },
    highlightElements: {
      ships: ["1001"],
      mapPositions: [{ row: 5, col: 8 }],
    },
    requiresTransaction: true,
    onStepComplete: (actionData) => {
      return (
        actionData?.type === "moveShip" &&
        actionData?.position?.row === 5 &&
        actionData?.position?.col === 8
      );
    },
  },
  {
    id: "shoot",
    title: "Firing weapons",
    description: "Weapon range and firing on targets",
    allowedActions: {
      selectShip: ["1002"],
      moveShip: {
        shipId: "1002",
        allowedPositions: [{ row: 1, col: 3 }],
      },
      shoot: {
        shipId: "1002",
        allowedTargets: ["2001"],
      },
    },
    highlightElements: {
      ships: ["1002", "2001"],
      mapPositions: [
        { row: 1, col: 3 },
        { row: 4, col: 8 },
      ],
    },
    requiresTransaction: true,
    onStepComplete: (actionData) => {
      return (
        actionData?.type === "shoot" &&
        actionData?.shipId === "1002" &&
        actionData?.targetShipId === "2001"
      );
    },
  },
  {
    id: "end-of-round",
    title: "End of round",
    description: "Round boundaries, markers, and turn order",
    allowedActions: {},
    highlightElements: {},
  },
  {
    id: "special-emp",
    title: "Special ability: EMP",
    description: "EMP special and reactor overload",
    allowedActions: {
      selectShip: ["1001"],
      useSpecial: {
        shipId: "1001",
        allowedTargets: ["2002"],
        specialType: 1,
      },
    },
    highlightElements: {
      ships: ["1001", "2002"],
    },
    requiresTransaction: true,
    onStepComplete: (actionData) => {
      return (
        actionData?.type === "useSpecial" &&
        actionData?.shipId === "1001" &&
        actionData?.targetShipId === "2002"
      );
    },
  },
  {
    id: "ship-destruction",
    title: "Ship destruction",
    description: "Reactor overload, hull loss, and recycle payouts",
    allowedActions: {},
    highlightElements: {
      ships: ["1001", "2002"],
    },
  },
  {
    id: "rescue",
    title: "Making tough decisions",
    description: "Disabled EMP: flee or trade for the shot",
    allowedActions: {
      selectShip: ["1001", "1002"],
      moveShip: {
        shipId: "1001",
        allowedPositions: [{ row: 5, col: 8 }],
      },
      shoot: {
        shipId: "1002",
        allowedTargets: ["2001"],
      },
    },
    highlightElements: {
      ships: ["1001", "2003"],
    },
    requiresTransaction: true,
    onStepComplete: (actionData) => {
      const isEmpRetreat =
        actionData?.type === "moveShip" &&
        actionData?.shipId === "1001" &&
        actionData?.actionType === ActionType.Retreat;
      const isSniperShoot =
        actionData?.type === "shoot" &&
        actionData?.shipId === "1002" &&
        actionData?.targetShipId === "2001";
      return isEmpRetreat || isSniperShoot;
    },
  },
  {
    id: "rescue-outcome-retreat",
    title: "The Resolute is safe",
    description: "You saved your EMP, but yielded initiative on the center",
    allowedActions: {},
    highlightElements: {},
  },
  {
    id: "rescue-outcome-sniper",
    title: "Accepting a sacrifice",
    description: "You lost the EMP but can fight for the center again",
    allowedActions: {
      selectShip: ["1003"],
      moveShip: {
        shipId: "1003",
        allowedPositions: [{ row: 5, col: 8 }],
      },
      shoot: {
        shipId: "1003",
        allowedTargets: ["2001"],
      },
    },
    highlightElements: {
      ships: ["1003", "2001"],
      mapPositions: [{ row: 5, col: 8 }],
    },
    requiresTransaction: true,
    onStepComplete: (actionData) => {
      const movedToCenter =
        actionData?.type === "moveShip" &&
        actionData?.shipId === "1003" &&
        actionData?.position?.row === 5 &&
        actionData?.position?.col === 8;
      const shotHammer =
        actionData?.type === "shoot" &&
        actionData?.shipId === "1003" &&
        actionData?.targetShipId === "2001";
      return movedToCenter || shotHammer;
    },
  },
  {
    id: "completion-retreat",
    title: "Planning ahead",
    description:
      "Hammer took the center; you kept your strongest ship for the long run",
    allowedActions: {},
  },
  {
    id: "completion-sniper",
    title: "Victory achieved!",
    description: "You traded the EMP for the center and closed out the win",
    allowedActions: {},
  },
];

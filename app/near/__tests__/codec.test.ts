import { describe, expect, it } from "vitest";
import {
  formatNear,
  formatUnits18,
  parseEvents,
  parseNear,
  parseUnits18,
  toBig,
  toReceipt,
  type NearOutcomeLike,
} from "../codec";

const ev = (event: string, data: object) =>
  `EVENT_JSON:${JSON.stringify({ standard: "void_tactics", version: "1.0.0", event, data: [data] })}`;

describe("parseEvents", () => {
  it("reads NEP-297 events from every receipt, including later ones (the randomness callback)", () => {
    const outcome: NearOutcomeLike = {
      transaction_outcome: { outcome: { logs: [] } },
      receipts_outcome: [
        { outcome: { logs: [ev("free_ships_claimed", { count: 10 }), "plain log"] } },
        { outcome: { logs: [ev("ship_constructed", { ship_id: "7" })] } },
      ],
    };
    const events = parseEvents(outcome);
    expect(events.map((e) => e.event)).toEqual(["free_ships_claimed", "ship_constructed"]);
    expect(events[1].data).toEqual({ ship_id: "7" });
  });

  it("ignores malformed EVENT_JSON logs", () => {
    expect(parseEvents({ receipts_outcome: [{ outcome: { logs: ["EVENT_JSON:{not json"] } }] })).toEqual([]);
  });
});

describe("toReceipt", () => {
  it("decodes the return value and reports success", () => {
    const value = btoa(JSON.stringify("42"));
    const r = toReceipt({
      transaction: { hash: "abc" },
      status: { SuccessValue: value },
      receipts_outcome: [{ outcome: { logs: [], status: { SuccessValue: value } } }],
    });
    expect(r).toMatchObject({ hash: "abc", success: true, returnValue: "42", failure: null });
  });

  it("reports a failed receipt even when the final status looks fine", () => {
    const r = toReceipt({
      transaction: { hash: "abc" },
      status: { SuccessValue: "" },
      receipts_outcome: [
        { outcome: { logs: [], status: { Failure: { ActionError: { kind: { FunctionCallError: "Smart contract panicked: ShipAlreadyMoved" } } } } } },
      ],
    });
    expect(r.success).toBe(false);
    expect(r.failure).toContain("ShipAlreadyMoved");
  });
});

describe("amounts", () => {
  it("round-trips NEAR (24 decimals)", () => {
    expect(parseNear("1.42")).toBe(BigInt("1420000000000000000000000"));
    expect(formatNear(parseNear("1.42"))).toBe("1.42");
    expect(formatNear(BigInt(0))).toBe("0");
  });

  it("shows a tiny non-zero NEAR amount instead of 0", () => {
    expect(formatNear(BigInt(1), 4)).toBe("0.0001");
  });

  it("round-trips 18-decimal UTC", () => {
    expect(parseUnits18("2.5")).toBe(BigInt("2500000000000000000"));
    expect(formatUnits18(parseUnits18("2.5"))).toBe("2.5");
  });

  it("toBig accepts strings, numbers and bigints", () => {
    expect(toBig("10")).toBe(BigInt(10));
    expect(toBig(10)).toBe(BigInt(10));
    expect(toBig(undefined)).toBe(BigInt(0));
  });
});

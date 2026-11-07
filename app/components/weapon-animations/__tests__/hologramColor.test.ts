import { describe, expect, it } from "vitest";
import { hologramColor } from "../canvasFx";

const parse = (css: string) => css.match(/[\d.]+/g)!.map(Number);

describe("hologramColor", () => {
  it("turns any colour phosphor green at its brightness, keeping its alpha", () => {
    const [r, g, b, a] = parse(hologramColor("rgba(255,120,40,0.6)"));
    expect(g).toBeGreaterThan(r);
    expect(g).toBeGreaterThan(b);
    expect(a).toBeCloseTo(0.6);
  });

  it("runs bright colours to white and dark ones to dark green", () => {
    const [wr, wg, wb] = parse(hologramColor("#ffffff"));
    expect(wg).toBe(255);
    expect(wr).toBeGreaterThan(200);
    expect(wb).toBeGreaterThan(150);
    const [dr, dg] = parse(hologramColor("#2a3039"));
    expect(dr).toBe(0);
    expect(dg).toBeLessThan(90);
  });

  it("reads rgb(), short and long hex, and leaves anything else alone", () => {
    expect(parse(hologramColor("rgb(0,0,0)"))).toEqual([0, 0, 0, 1]);
    expect(hologramColor("#fff")).toBe(hologramColor("#ffffff"));
    expect(parse(hologramColor("#ffffff80"))[3]).toBeCloseTo(0.5, 2);
    expect(hologramColor("transparent")).toBe("transparent");
  });
});

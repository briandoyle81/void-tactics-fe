import { describe, expect, it } from "vitest";
import { formatBalance } from "../formatBalance";

describe("formatBalance", () => {
  it("shows a fixed number of decimals, rounded down", () => {
    expect(formatBalance(0.0009, 3)).toBe("0.000");
    expect(formatBalance(0.001, 3)).toBe("0.001");
    expect(formatBalance(1.23456, 3)).toBe("1.234");
    expect(formatBalance(12, 2)).toBe("12.00");
    expect(formatBalance(1234.567, 2)).toBe("1,234.56");
    expect(formatBalance(Number.NaN, 2)).toBe("0.00");
  });
});

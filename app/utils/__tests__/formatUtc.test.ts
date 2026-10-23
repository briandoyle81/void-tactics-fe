import { describe, expect, it } from "vitest";
import { formatUtc, formatUtcWei } from "../formatUtc";

describe("formatUtcWei", () => {
  it("shows four decimals", () => {
    expect(formatUtcWei(0n)).toBe("0.0000");
    expect(formatUtcWei(10n ** 18n)).toBe("1.0000");
    expect(formatUtcWei(15n * 10n ** 15n)).toBe("0.0150");
    expect(formatUtcWei(1234567n * 10n ** 12n)).toBe("1.2346");
  });

  it("rounds to the nearest 0.0001", () => {
    expect(formatUtcWei(49n * 10n ** 12n)).toBe("0.0000");
    expect(formatUtcWei(50n * 10n ** 12n)).toBe("0.0001");
  });
});

describe("formatUtc", () => {
  it("shows four decimals", () => {
    expect(formatUtc(3)).toBe("3.0000");
    expect(formatUtc(0.5)).toBe("0.5000");
  });
});

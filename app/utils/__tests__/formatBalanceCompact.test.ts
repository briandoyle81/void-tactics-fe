import { describe, expect, it } from "vitest";
import { formatBalanceCompact } from "../formatBalance";

describe("formatBalanceCompact", () => {
  it("shortens thousands and millions, rounding down", () => {
    expect(formatBalanceCompact(1234.56)).toBe("1.2k");
    expect(formatBalanceCompact(1999)).toBe("1.9k");
    expect(formatBalanceCompact(1000)).toBe("1k");
    expect(formatBalanceCompact(2_500_000)).toBe("2.5m");
    expect(formatBalanceCompact(999_999)).toBe("999.9k");
  });
  it("keeps small values short", () => {
    expect(formatBalanceCompact(456.7)).toBe("456");
    expect(formatBalanceCompact(12.34)).toBe("12.3");
    expect(formatBalanceCompact(0.09)).toBe("0");
    expect(formatBalanceCompact(0)).toBe("0");
    expect(formatBalanceCompact(NaN)).toBe("0");
  });
});

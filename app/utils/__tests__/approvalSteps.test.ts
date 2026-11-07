import { describe, expect, it } from "vitest";
import type { PublicClient } from "viem";
import { erc20Approval } from "../approvalSteps";

const TOKEN = "0x0000000000000000000000000000000000000001" as const;
const OWNER = "0x0000000000000000000000000000000000000002" as const;
const SPENDER = "0x0000000000000000000000000000000000000003" as const;

/** A client whose `allowance` reads return `allowance`, recording the args it was asked with. */
function clientWithAllowance(allowance: bigint) {
  const calls: unknown[] = [];
  const client = {
    readContract: async (req: { functionName: string; args: unknown[] }) => {
      calls.push(req);
      return allowance;
    },
  } as unknown as PublicClient;
  return { client, calls };
}

describe("erc20Approval", () => {
  it("is needed only while the spender's allowance is short", async () => {
    const step = erc20Approval({ token: TOKEN, owner: OWNER, spender: SPENDER, amount: 10n, loadingText: "x" });
    const short = clientWithAllowance(9n);
    expect(await step.isNeeded(short.client)).toBe(true);
    expect(short.calls[0]).toMatchObject({ address: TOKEN, functionName: "allowance", args: [OWNER, SPENDER] });
    expect(await step.isNeeded(clientWithAllowance(10n).client)).toBe(false);
  });

  it("approves the amount, or approveAmount when given", () => {
    expect(erc20Approval({ token: TOKEN, owner: OWNER, spender: SPENDER, amount: 10n, loadingText: "x" }).call).toMatchObject({
      address: TOKEN,
      functionName: "approve",
      args: [SPENDER, 10n],
    });
    expect(
      erc20Approval({ token: TOKEN, owner: OWNER, spender: SPENDER, amount: 10n, approveAmount: 99n, loadingText: "x" }).call.args,
    ).toEqual([SPENDER, 99n]);
  });

  it("isn't needed for nothing", async () => {
    const step = erc20Approval({ token: TOKEN, owner: OWNER, spender: SPENDER, amount: 0n, loadingText: "x" });
    const c = clientWithAllowance(0n);
    expect(await step.isNeeded(c.client)).toBe(false);
    expect(c.calls).toHaveLength(0);
  });
});

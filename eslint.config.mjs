import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // Build output and generated code (the Prisma client, next-env.d.ts).
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "coverage/**",
      "app/generated/**",
      "next-env.d.ts",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  // The game runs on NEAR: chain reads and writes go through app/near/
  // (useNearView, useNearCall / the session's `send`). The EVM wallet stack
  // is gone; viem stays only for the card checkout, which pays from an
  // external EVM wallet on EVM mainnets (useFlowPaymentModal).
  {
    files: ["app/**/*.{ts,tsx}"],
    ignores: ["app/hooks/useFlowPaymentModal.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "wagmi", message: "The game is on NEAR: use app/near (useNearView, useNearCall)." },
            { name: "viem", message: "The game is on NEAR: use app/near/codec for amounts and app/near for calls." },
          ],
          patterns: [
            { group: ["wagmi/*", "@wagmi/*", "viem/*"], message: "The game is on NEAR: use app/near." },
            { group: ["@dynamic-labs/ethereum", "@dynamic-labs/wagmi-connector"], message: "Dynamic's Solana wallet is the NEAR key (app/near/identity.ts)." },
          ],
        },
      ],
    },
  },
  // Raw NEAR transaction sends stay in app/near (one write funnel: the
  // session's `send`), except the server routes that sign with privileged
  // keys (the faucet).
  {
    files: ["app/**/*.{ts,tsx}"],
    ignores: ["app/near/**", "app/api/**", "app/hooks/useFlowPaymentModal.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "wagmi", message: "The game is on NEAR: use app/near (useNearView, useNearCall)." },
            { name: "viem", message: "The game is on NEAR: use app/near/codec for amounts and app/near for calls." },
            { name: "near-api-js", message: "Send through app/near (useNearCall or the session's send), not near-api-js directly." },
          ],
          patterns: [
            { group: ["wagmi/*", "@wagmi/*", "viem/*"], message: "The game is on NEAR: use app/near." },
            { group: ["@dynamic-labs/ethereum", "@dynamic-labs/wagmi-connector"], message: "Dynamic's Solana wallet is the NEAR key (app/near/identity.ts)." },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;

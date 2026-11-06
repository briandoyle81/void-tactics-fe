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
  // Contract writes go through useSponsoredWriteContract, so Dynamic can
  // sponsor the embedded wallet's gas (see that file).
  {
    files: ["app/**/*.{ts,tsx}"],
    ignores: ["app/hooks/useSponsoredWriteContract.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "wagmi",
              importNames: ["useWriteContract"],
              message: "Use useSponsoredWriteContract (app/hooks/useSponsoredWriteContract.ts) so embedded-wallet gas is sponsored.",
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;

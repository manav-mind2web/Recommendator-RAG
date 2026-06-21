import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  // Ensure flat-config ESLint actually lints TS/TSX (and not just .js).
  { files: ["**/*.{js,mjs,jsx,ts,tsx}"] },
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "next-env.d.ts",
      "*.config.{js,mjs,ts}",
    ],
  },
];

export default eslintConfig;

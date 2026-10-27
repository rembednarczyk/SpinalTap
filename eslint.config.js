import js from "@eslint/js";
import tseslint from "typescript-eslint";

const nondeterminism = [
  { object: "Math", property: "random", message: "Use RandomPort (seeded) in core/sim." },
  { object: "Date", property: "now", message: "Use ClockPort in core/sim." },
  { object: "performance", property: "now", message: "Use ClockPort in core/sim." },
];

export default tseslint.config(
  { ignores: ["**/dist/**", "**/coverage/**", "reports/**", "playwright-report/**", "test-results/**", "node_modules/**", ".claude/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
    },
  },
  {
    // Domain and simulation: strict typing and full determinism.
    files: ["packages/core/src/**/*.ts", "packages/sim/src/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "no-restricted-properties": ["error", ...nondeterminism],
      "no-restricted-syntax": ["error", { selector: "NewExpression[callee.name='Date']", message: "Use ClockPort in core/sim." }],
    },
  },
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "**/test/**"],
    rules: { "@typescript-eslint/no-non-null-assertion": "off" },
  },
  {
    files: ["**/*.cjs", "tools/**/*.mjs", "e2e/**/*.ts", "playwright.config.ts"],
    languageOptions: { globals: { process: "readonly", console: "readonly", require: "readonly", module: "writable", __dirname: "readonly" } },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
);

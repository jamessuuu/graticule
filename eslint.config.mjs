// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/out/**",
      "**/coverage/**",
      "**/playwright-report/**",
      "**/test-results/**",
      "apps/web/public/**",
      "**/*.d.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // TypeScript's own compiler (tsc --noEmit, run separately as
    // `typecheck`) is authoritative for undefined-variable/global
    // checking — it understands ambient DOM/Worker/Node lib types that
    // ESLint's plain `no-undef` does not, and double-covering it here
    // only produces false positives across browser/worker/Node contexts.
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "no-undef": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    // Scripts and config files run under plain Node; console output is
    // the point, and they need Node's globals (process, console, etc.)
    // regardless of where in the tree they live.
    files: ["**/*.mjs", "**/*.config.*"],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      "no-console": "off",
    },
  }
);

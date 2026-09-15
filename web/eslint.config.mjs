// ESLint flat config for the presentation layer.
//
// Scope note: Phase 3A is a framework-independent data/design foundation — there
// is no React or JSX in the tree yet. The Next.js and React rule sets are wired
// up now so that the first component written in the UI phase is linted from its
// first line, rather than having lint retrofitted later.
//
// Analytical guardrail: web/src/data/generated/ is owned by the Python pipeline
// (pipeline/src/pipeline/emit.py guarantees byte-stable output). ESLint must never
// touch it — reformatting those files would break `python -m pipeline.build --check`.

import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "playwright-report/**",
      "test-results/**",
      // Pipeline-owned analytical artifacts. Never lint or rewrite.
      "src/data/generated/**",
    ],
  },

  {
    // Plain JS/MJS config files (this file, plus next.config.mjs and
    // postcss.config.mjs in the UI phase). Kept on the default parser — see the
    // note in the TS block below for why the TS parser must not reach them.
    files: ["**/*.mjs", "**/*.js"],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
    },
  },

  {
    // The TypeScript and Next rule sets are scoped to TS/TSX on purpose.
    //
    // Left unscoped, the @typescript-eslint parser is applied to plain .mjs files
    // (this config, and next.config.mjs / postcss.config.mjs in the UI phase) while
    // eslint-config-next declares globals for them. ESLint 10 then calls
    // scopeManager.addGlobals(), which @typescript-eslint/scope-manager@8 does not
    // implement, and the run dies with a TypeError. Scoping keeps .mjs on the
    // default parser, which handles globals correctly.
    files: ["**/*.ts", "**/*.tsx"],
    extends: [tseslint.configs.recommended, nextCoreWebVitals],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
    },
    settings: {
      // eslint-config-next bundles eslint-plugin-react@7.37.5, whose React version
      // auto-detection crashes under ESLint 10 (resolveBasedir/detectReactVersion).
      // Pinning the version skips detection entirely.
      react: { version: "19.3.0" },
    },
    rules: {
      // The data layer deliberately narrows `unknown` by hand in validate.ts
      // rather than trusting casts. Keep the explicit-any ban strict.
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      // This project targets the App Router, so the Pages-Router-only link rule
      // does not apply and otherwise warns on every run about a missing pages/ dir.
      "@next/next/no-html-link-for-pages": "off",
    },
  },
);

const restrictedIndexLibImports = {
  patterns: [
    {
      group: ["**/index.lib", "**/index.lib.js"],
      message:
        "Do not import from index.lib. Import directly from the source file instead (for example '../core/Utilities' instead of '../index.lib').",
    },
  ],
};

const stagedRules = {
  "no-constant-binary-expression": "error",
  "no-debugger": "error",
  "no-restricted-imports": ["error", restrictedIndexLibImports],
  "no-self-compare": "error",
  "no-unreachable": "error",
  "no-unsafe-finally": "error",
};

const stagedUnusedImportRule = {
  "unused-imports/no-unused-imports": "error",
};

module.exports = {
  root: true,
  ignorePatterns: [
    "build/",
    "toolbuild/",
    "out/",
    "public/",
    "public_supplemental/",
    "debugoutput/",
    "res/",
    "reslist/",
    "site/",
    "src/minecraft/json/",
    "node_modules/",
  ],
  overrides: [
    {
      files: ["src/**/*.{ts,tsx}", "scripts/**/*.ts"],
      parser: "@typescript-eslint/parser",
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
      env: {
        browser: true,
        es2022: true,
        node: true,
      },
      plugins: ["@typescript-eslint", "unused-imports"],
      rules: {
        ...stagedRules,
        ...stagedUnusedImportRule,
      },
    },
    {
      files: ["src/**/*.js", "src/**/*.mjs"],
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
      env: {
        browser: true,
        es2022: true,
        node: true,
      },
      plugins: ["unused-imports"],
      rules: {
        ...stagedRules,
        ...stagedUnusedImportRule,
      },
    },
    {
      files: [
        "*.config.{js,mjs,cjs,ts}",
        "playwright*.{js,ts}",
        "gulpfile.js",
        "vite.config.js",
        "config-overrides.js",
        "scripts/**/*.js",
      ],
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
      env: {
        es2022: true,
        node: true,
      },
      plugins: ["unused-imports"],
      rules: {
        ...stagedRules,
        ...stagedUnusedImportRule,
      },
    },
    {
      files: [
        "src/test/**/*.{ts,tsx}",
        "src/test-ex/**/*.{ts,tsx}",
        "src/test-extra/**/*.{ts,tsx}",
        "src/test-longhaul/**/*.{ts,tsx}",
        "src/testweb/**/*.{ts,tsx}",
      ],
      env: {
        mocha: true,
      },
    },
    {
      files: ["src/core/Log.ts"],
      rules: {
        "no-debugger": "off",
      },
    },
  ],
};

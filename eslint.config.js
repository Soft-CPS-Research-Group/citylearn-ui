import js from "@eslint/js";
import globals from "globals";
import hooks from "eslint-plugin-react-hooks";

export default [
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "build/**",
      "test-results/**",
      "playwright-report/**",
      "sample-results/**",
      "tests/fixtures/**",
    ],
  },
  js.configs.recommended,
  {
    files: ["src/**/*.{js,jsx}"],
    languageOptions: { globals: globals.browser, parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { "react-hooks": hooks },
    rules: { "react-hooks/rules-of-hooks": "error", "react-hooks/exhaustive-deps": "error" },
  },
  {
    files: ["tests/**/*.js", "e2e/**/*.js", "scripts/**/*.mjs", "*.config.js"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
];

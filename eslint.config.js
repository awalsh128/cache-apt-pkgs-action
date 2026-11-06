import tsParser from "@typescript-eslint/parser";

export default [
  {
    ignores: ["dist/**", "node_modules/**", "target/**"],
  },
  {
    files: [
      "src/**/*.ts",
      "test/**/*.ts",
      "scripts/**/*.ts",
      "scripts/**/*.mts",
    ],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: "latest",
      sourceType: "module",
    },
    rules: {},
  },
];

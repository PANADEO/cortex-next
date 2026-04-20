module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2023,
    sourceType: "module",
    project: "./tsconfig.json",
  },
  extends: [
    "next/core-web-vitals",
    "plugin:@typescript-eslint/recommended",
  ],
  settings: {
    next: { rootDir: "app/idp" },
  },
  rules: {
    "no-console": ["error", { allow: ["warn", "error"] }],
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/consistent-type-imports": "warn",
  },
  ignorePatterns: [
    "node_modules",
    ".next",
    ".next-dev",
    "dist",
    "app/idp/public/pdfjs",
    "app/idp/next-env.d.ts",
  ],
}

import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ...js.configs.recommended,
    files: ["test/**/*.js"],
    languageOptions: {
      ...js.configs.recommended.languageOptions,
      globals: {
        process: "readonly",
        URL: "readonly",
      },
    },
  },
  tseslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    rules: {
      "no-console": "off",
    },
  },
);

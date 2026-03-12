import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["coverage/**", "node_modules/**"]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node
      }
    },
    rules: {
      "no-console": "error"
    }
  },
  {
    files: ["scripts/**/*.ts"],
    rules: {
      "no-console": "off"
    }
  },
  {
    files: ["tests/**/*.ts"],
    rules: {
      "no-console": "off"
    }
  },
  {
    files: ["src/lib/logging/**/*.ts"],
    rules: {
      "no-console": "off"
    }
  },
  {
    files: ["bin/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.node
      }
    }
  }
);

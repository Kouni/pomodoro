import js from "@eslint/js";
import globals from "globals";
import eslintConfigPrettier from "eslint-config-prettier";

export default [
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2024,
            sourceType: "script",
            globals: {
                ...globals.browser,
                Vue: "readonly",
                ProgressBar: "readonly"
            }
        },
        rules: {
            // Code quality
            "no-unused-vars": [
                "error",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                    caughtErrorsIgnorePattern: "^_"
                }
            ],
            "no-console": "warn",
            "no-debugger": "error",
            "no-alert": "warn",

            // Best practices
            eqeqeq: ["error", "always"],
            curly: ["error", "all"],
            "no-var": "error",
            "prefer-const": "error",
            "no-implicit-globals": "error"
        }
    },
    {
        // Node-side files (tests, tooling) are ES modules.
        files: ["tests/**/*.js", "eslint.config.js", "playwright.config.js"],
        languageOptions: {
            sourceType: "module",
            // tests run in Node but evaluate callbacks inside the browser
            globals: { ...globals.node, ...globals.browser }
        }
    },
    {
        ignores: ["node_modules/**", "assets/**", "*.min.js"]
    },
    // Must be last: turns off every rule Prettier already enforces.
    eslintConfigPrettier
];

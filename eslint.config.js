import js from "@eslint/js";
import globals from "globals";
import pluginVue from "eslint-plugin-vue";
import eslintConfigPrettier from "eslint-config-prettier";

export default [
    js.configs.recommended,
    ...pluginVue.configs["flat/essential"],
    {
        languageOptions: {
            ecmaVersion: 2024,
            sourceType: "module",
            globals: { ...globals.browser, ...globals.node }
        },
        rules: {
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
            eqeqeq: ["error", "always"],
            curly: ["error", "all"],
            "no-var": "error",
            "prefer-const": "error",
            "no-implicit-globals": "error"
        }
    },
    {
        files: ["src/workers/**/*.js", "public/sw-notify.js"],
        languageOptions: { globals: globals.serviceworker }
    },
    {
        ignores: [
            "node_modules/**",
            "dist/**",
            "dev-dist/**",
            "public/**/*.min.js"
        ]
    },
    // Must be last: turns off every rule Prettier already enforces.
    eslintConfigPrettier
];

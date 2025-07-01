import js from "@eslint/js";
import globals from "globals";

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

            // Code style
            indent: ["error", 4],
            quotes: ["error", "double"],
            semi: ["error", "always"],
            "comma-dangle": ["error", "never"],
            "no-trailing-spaces": "error",
            "eol-last": "error",

            // Best practices
            eqeqeq: ["error", "always"],
            curly: ["error", "all"],
            "no-var": "error",
            "prefer-const": "error",
            "no-implicit-globals": "error",

            // ES6+
            "arrow-spacing": "error",
            "template-curly-spacing": "error",
            "object-curly-spacing": ["error", "always"]
        }
    },
    {
        ignores: [
            "node_modules/**",
            "assets/**",
            "*.min.js",
            "progressbar.min.js",
            "vue.min.js"
        ]
    }
];

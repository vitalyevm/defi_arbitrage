module.exports = {
  env: {
    browser: false,
    es2021: true,
    mocha: true,
    node: true,
  },
  plugins: ["@typescript-eslint"],
  extends: [
    "standard",
    "plugin:prettier/recommended",
    "plugin:node/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 12,
  },
  rules: {
    "indent": ["error", 4],
    "quotes": ["error", "double"],
    "semi": ["error", "always"],
    "no-console": "off",
    "no-prototype-builtins": "off",
    "prefer-const": "error",
    "no-unused-vars": "warn",
    "no-mixed-spaces-and-tabs": "error",
    "newline-per-chained-call": "warn",
    "no-shadow": "warn",
    "no-return-await": "error",
    "max-len": ["error", { code: 180 }],
    "node/no-unsupported-features/es-syntax": [
      "error",
      { ignores: ["modules"] },
    ],
  },
  "prettier/prettier": [
    "error",
    {
      singleQuote: true,
      parser: "flow",
    },
  ],
};

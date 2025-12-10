import baseConfig from "@repo/eslint-config/library";

export default [
  ...baseConfig,
  {
    ignores: [".next/**"],
  },
];

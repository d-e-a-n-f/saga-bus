import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ["@saga-bus/core", "@aws-sdk/client-dynamodb", "@aws-sdk/lib-dynamodb"],
});

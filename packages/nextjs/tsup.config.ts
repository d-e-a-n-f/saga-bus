import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "server/index": "src/server/index.ts",
    "client/index": "src/client/index.ts",
    "api/index": "src/api/index.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  external: ["react", "next"],
});

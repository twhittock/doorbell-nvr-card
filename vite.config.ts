/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
  },
  build: {
    lib: {
      entry: resolve(__dirname, "src/doorbell-nvr-card.ts"),
      formats: ["es"],
      fileName: () => "doorbell-nvr-card.js",
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // Each database test file runs its own WebAssembly Postgres. Too many at once
    // exhausts memory and crashes the run with no test summary.
    maxWorkers: 3,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});

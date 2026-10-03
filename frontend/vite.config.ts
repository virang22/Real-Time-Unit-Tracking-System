import path from "node:path";
import os from "node:os";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Keeps prebundle cache outside node_modules to reduce Windows EPERM (OneDrive, AV, file locks)
  // when Vite tries to rmdir node_modules/.vite/deps after config or dependency changes.
  cacheDir: path.join(os.tmpdir(), "vite-cache-rtut-frontend"),
  server: {
    host: true,
    port: 5173
  }
});

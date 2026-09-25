import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { cpSync, existsSync, mkdirSync } from "node:fs";

// WebbyOS is a vanilla-JS app wrapped in a Vite + React shell for hosting.
// The React entry mounts a shell component and then boots the existing
// vanilla runtime (Core/*, assets/*, modules/*) exactly as index.html did.
//
// The vanilla runtime fetches its scripts, styles, layouts, and config at
// runtime, so the production build must ship those files as static assets
// alongside the Vite bundle.
const ROOT = path.resolve(import.meta.dirname);
const RUNTIME_ASSETS = [
  "assets",
  "Core",
  "layouts",
  "modules",
  "api"
];

export default defineConfig({
  root: "src",
  plugins: [
    react(),
    {
      name: "webbyos-copy-runtime-assets",
      apply: "build",
      closeBundle() {
        const outDir = path.resolve(ROOT, "dist");
        mkdirSync(outDir, { recursive: true });
        for (const entry of RUNTIME_ASSETS) {
          const from = path.join(ROOT, entry);
          if (existsSync(from)) {
            cpSync(from, path.join(outDir, entry), { recursive: true });
          }
        }
        for (const file of ["favicon.ico", "config.json", "registry.json"]) {
          const from = path.join(ROOT, file);
          if (existsSync(from)) {
            cpSync(from, path.join(outDir, file));
          }
        }
      }
    }
  ],
  build: {
    outDir: path.resolve(ROOT, "dist"),
    emptyOutDir: true
  }
});

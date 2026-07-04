import { defineConfig } from "vite";
import path from "node:path";

/**
 * Static client-side build of the STS2 dashboard.
 *
 * `base` is set for GitHub Pages project sites (served from /<repo>/). Override
 * with the VITE_BASE env var for other hosts (Netlify/Cloudflare use "/").
 */
export default defineConfig({
  base: process.env.VITE_BASE ?? "/STS_2_stats/",
  resolve: {
    alias: {
      // The shared analysis modules import Node built-ins they never actually
      // call in the browser path — stub them so the bundle resolves.
      fs: path.resolve(__dirname, "src/browser/shims/fs.ts"),
      path: path.resolve(__dirname, "src/browser/shims/path.ts"),
    },
  },
  define: {
    // reports.ts computes a path.join(__dirname, ...) constant at import time.
    __dirname: JSON.stringify("/"),
  },
  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 3000,
  },
});

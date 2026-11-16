import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const port = parseInt(process.env.PORT || "3004");
const hmrClientPort = parseInt(
  process.env.HMR_CLIENT_PORT || String(port),
);

export default defineConfig({
  plugins: [react()],
  // PLATFORM_BASE=./ for S3/platform zip; default /roguelike/ for local vite proxy
  base: process.env.PLATFORM_BASE || "/roguelike/",
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  server: {
    strictPort: true,
    port,
    hmr: { clientPort: hmrClientPort },
  },
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig(({ command }) => ({
  base: command === "serve" ? "/" : "/workspace/vdp/org/",
  plugins: [react()],
  resolve: {
    alias: {
      "@ant-ui": fileURLToPath(new URL("./ant-ui", import.meta.url))
    }
  },
  server: {
    host: "0.0.0.0",
    port: 5285,
    strictPort: true,
    fs: {
      allow: [fileURLToPath(new URL(".", import.meta.url))]
    },
    proxy: {
      "/api": "http://localhost:8103"
    }
  }
}));

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig(({ command }) => ({
  base: command === "serve" ? "/" : "/workspace/training/researcher/",
  plugins: [react()],
  resolve: {
    alias: {
      axios: fileURLToPath(new URL("./node_modules/axios", import.meta.url)),
      react: fileURLToPath(new URL("./node_modules/react", import.meta.url)),
      "react-dom": fileURLToPath(new URL("./node_modules/react-dom", import.meta.url)),
      "react-router-dom": fileURLToPath(new URL("./node_modules/react-router-dom", import.meta.url)),
      "@ant-ui": fileURLToPath(new URL("./ant-ui", import.meta.url)),
      "@shared-api": fileURLToPath(new URL("../shared-api", import.meta.url)),
      "@shared-session": fileURLToPath(new URL("../shared-session", import.meta.url)),
      "@shared-ui": fileURLToPath(new URL("../shared-ui", import.meta.url))
    }
  },
  server: {
    fs: {
      allow: [fileURLToPath(new URL(".", import.meta.url)), fileURLToPath(new URL("..", import.meta.url))]
    }
  }
}));

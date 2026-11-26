import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const PEN_PROXY_TARGET = process.env.VITE_PEN_PROXY_TARGET || "http://localhost:8106";
const VDP_PROXY_TARGET = process.env.VITE_VDP_PROXY_TARGET || "http://localhost:8103";
const TRAINING_PROXY_TARGET = process.env.VITE_TRAINING_PROXY_TARGET || "http://localhost:8100";
const AUTH_PROXY_TARGET = process.env.VITE_AUTH_PROXY_TARGET || "http://localhost:8089";
const BUG_BOUNTY_PROXY_TARGET = process.env.VITE_BUG_BOUNTY_PROXY_TARGET || "http://localhost:8089";
const AI_REDTEAM_PROXY_TARGET = process.env.VITE_AI_REDTEAM_PROXY_TARGET || "http://localhost:8089";
const CHALLENGE_PROXY_TARGET = process.env.VITE_CHALLENGE_PROXY_TARGET || "http://localhost:8089";
const CODE_PROXY_TARGET = process.env.VITE_CODE_PROXY_TARGET || "http://localhost:8089";
const SECURITY_TRUST_PROXY_TARGET = process.env.VITE_SECURITY_TRUST_PROXY_TARGET || "http://localhost:8089";
const GRC_PROXY_TARGET = process.env.VITE_GRC_PROXY_TARGET || "http://localhost:8010";

function shouldStripAuthPrefix(target) {
  return /:(8092|8080)(\/|$)/.test(String(target || ""));
}

function shouldStripServicePrefix(target) {
  return !/:(8089)(\/|$)/.test(String(target || ""));
}

function stripPrefix(prefix) {
  return (path) => path.replace(new RegExp(`^${prefix}`), "");
}

export default defineConfig({
  base: "/admin/",
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    // Local admin dev should match the container's internal port.
    // Traefik owns 8089 for the integrated stack, so local Vite must stay off that port.
    port: 5179,
    strictPort: true,
    proxy: {
      "/api/pen": {
        target: PEN_PROXY_TARGET,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/pen/, ""),
      },
      "/api/vdp": {
        target: VDP_PROXY_TARGET,
        changeOrigin: true,
        cookieDomainRewrite: "",
      },
      "/api/training": {
        target: TRAINING_PROXY_TARGET,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/training/, ""),
      },
      "/api/auth": {
        target: AUTH_PROXY_TARGET,
        changeOrigin: true,
        rewrite: shouldStripAuthPrefix(AUTH_PROXY_TARGET)
          ? (path) => path.replace(/^\/api\/auth/, "")
          : undefined,
      },
      "/api/code": {
        target: CODE_PROXY_TARGET,
        changeOrigin: true,
        cookieDomainRewrite: "",
        rewrite: shouldStripServicePrefix(CODE_PROXY_TARGET) ? stripPrefix("/api/code") : undefined,
      },
      "/api/bug-bounty": {
        target: BUG_BOUNTY_PROXY_TARGET,
        changeOrigin: true,
        cookieDomainRewrite: "",
        rewrite: shouldStripServicePrefix(BUG_BOUNTY_PROXY_TARGET) ? stripPrefix("/api/bug-bounty") : undefined,
      },
      "/api/ai-redteam": {
        target: AI_REDTEAM_PROXY_TARGET,
        changeOrigin: true,
        cookieDomainRewrite: "",
        rewrite: shouldStripServicePrefix(AI_REDTEAM_PROXY_TARGET) ? stripPrefix("/api/ai-redteam") : undefined,
      },
      "/api/challenge": {
        target: CHALLENGE_PROXY_TARGET,
        changeOrigin: true,
        cookieDomainRewrite: "",
        rewrite: shouldStripServicePrefix(CHALLENGE_PROXY_TARGET) ? stripPrefix("/api/challenge") : undefined,
      },
      "/api/security-trust": {
        target: SECURITY_TRUST_PROXY_TARGET,
        changeOrigin: true,
        cookieDomainRewrite: "",
        rewrite: shouldStripServicePrefix(SECURITY_TRUST_PROXY_TARGET) ? stripPrefix("/api/security-trust") : undefined,
      },
      "/api/grc": {
        target: GRC_PROXY_TARGET,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/grc/, ""),
      },
    },
  },
});

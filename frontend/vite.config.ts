import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const apiGatewayProxyTarget = env.VITE_API_GATEWAY_PROXY_TARGET || 'http://localhost:8089';
  const authProxyTarget = env.VITE_AUTH_PROXY_TARGET || 'http://127.0.0.1:8092';
  const authProxyUsesGateway = authProxyTarget === apiGatewayProxyTarget;
  const trustCenterProxyTarget = env.VITE_TRUST_CENTER_PROXY_TARGET || apiGatewayProxyTarget;
  const codeProxyTarget = env.VITE_CODE_PROXY_TARGET || apiGatewayProxyTarget;
  const codeProxyUsesGateway = codeProxyTarget === apiGatewayProxyTarget;
  const penProxyTarget = env.VITE_PEN_PROXY_TARGET || apiGatewayProxyTarget;
  const penProxyUsesGateway = penProxyTarget === apiGatewayProxyTarget;
  const vdpProxyTarget = env.VITE_VDP_PROXY_TARGET || apiGatewayProxyTarget;
  const trainingProxyTarget = env.VITE_TRAINING_PROXY_TARGET || apiGatewayProxyTarget;
  const trainingProxyUsesGateway = trainingProxyTarget === apiGatewayProxyTarget;
  const grcProxyTarget = env.VITE_GRC_PROXY_TARGET || apiGatewayProxyTarget;
  const grcProxyUsesGateway = grcProxyTarget === apiGatewayProxyTarget;
  const bugBountyProxyTarget = env.VITE_BUG_BOUNTY_PROXY_TARGET || apiGatewayProxyTarget;
  const bugBountyProxyUsesGateway = bugBountyProxyTarget === apiGatewayProxyTarget;
  const aiRedteamProxyTarget = env.VITE_AI_REDTEAM_PROXY_TARGET || apiGatewayProxyTarget;
  const aiRedteamProxyUsesGateway = aiRedteamProxyTarget === apiGatewayProxyTarget;
  const challengeProxyTarget = env.VITE_CHALLENGE_PROXY_TARGET || apiGatewayProxyTarget;
  const challengeProxyUsesGateway = challengeProxyTarget === apiGatewayProxyTarget;
  const securityTrustProxyTarget = env.VITE_SECURITY_TRUST_PROXY_TARGET || apiGatewayProxyTarget;
  const securityTrustProxyUsesGateway = securityTrustProxyTarget === apiGatewayProxyTarget;
  const codeFrontendProxyTarget = env.VITE_CODE_FRONTEND_PROXY_TARGET || 'http://localhost:3003';

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@ant-ui': path.resolve(__dirname, './ant-ui')
      }
    },
    server: {
      proxy: {
        '/api/auth': {
          target: authProxyTarget,
          changeOrigin: true,
          rewrite: authProxyUsesGateway ? undefined : (path) => path.replace(/^\/api\/auth/, '')
        },
        '/api/trust-center': {
          target: trustCenterProxyTarget,
          changeOrigin: true
        },
        '/api/code': {
          target: codeProxyTarget,
          changeOrigin: true,
          rewrite: codeProxyUsesGateway ? undefined : (path) => path.replace(/^\/api\/code/, '')
        },
        '/api/pen': {
          target: penProxyTarget,
          changeOrigin: true,
          rewrite: penProxyUsesGateway ? undefined : (path) => path.replace(/^\/api\/pen/, '')
        },
        '/api/pen-researcher': {
          target: penProxyTarget,
          changeOrigin: true,
          rewrite: penProxyUsesGateway ? undefined : (path) => path.replace(/^\/api\/pen-researcher/, '')
        },
        '/api/vdp': {
          target: vdpProxyTarget,
          changeOrigin: true
        },
        '/api/training': {
          target: trainingProxyTarget,
          changeOrigin: true,
          rewrite: trainingProxyUsesGateway ? undefined : (path) => path.replace(/^\/api\/training/, '')
        },
        '/api/grc': {
          target: grcProxyTarget,
          changeOrigin: true,
          rewrite: grcProxyUsesGateway ? undefined : (path) => path.replace(/^\/api\/grc/, '')
        },
        '/api/bug-bounty': {
          target: bugBountyProxyTarget,
          changeOrigin: true,
          cookieDomainRewrite: '',
          rewrite: bugBountyProxyUsesGateway ? undefined : (path) => path.replace(/^\/api\/bug-bounty/, '')
        },
        '/api/ai-redteam': {
          target: aiRedteamProxyTarget,
          changeOrigin: true,
          cookieDomainRewrite: '',
          rewrite: aiRedteamProxyUsesGateway ? undefined : (path) => path.replace(/^\/api\/ai-redteam/, '')
        },
        '/api/challenge': {
          target: challengeProxyTarget,
          changeOrigin: true,
          cookieDomainRewrite: '',
          rewrite: challengeProxyUsesGateway ? undefined : (path) => path.replace(/^\/api\/challenge/, '')
        },
        '/api/security-trust': {
          target: securityTrustProxyTarget,
          changeOrigin: true,
          cookieDomainRewrite: '',
          rewrite: securityTrustProxyUsesGateway ? undefined : (path) => path.replace(/^\/api\/security-trust/, '')
        },
        '/workspace/code': {
          target: codeFrontendProxyTarget,
          changeOrigin: true
        },
        '/workspace': {
          target: apiGatewayProxyTarget,
          changeOrigin: true
        },
        '/admin': {
          target: apiGatewayProxyTarget,
          changeOrigin: true
        }
      }
    }
  };
});

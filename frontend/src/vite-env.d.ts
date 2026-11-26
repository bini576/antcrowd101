/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TRUST_CENTER_API_BASE_URL?: string;
  readonly VITE_CODE_SERVICE_URL?: string;
  readonly VITE_AUTH_API_BASE?: string;
  readonly VITE_AUTH_CSRF_COOKIE_NAME?: string;
  readonly VITE_API_GATEWAY_PROXY_TARGET?: string;
  readonly VITE_AUTH_PROXY_TARGET?: string;
  readonly VITE_TRUST_CENTER_PROXY_TARGET?: string;
  readonly VITE_CODE_PROXY_TARGET?: string;
  readonly VITE_PEN_PROXY_TARGET?: string;
  readonly VITE_VDP_PROXY_TARGET?: string;
  readonly VITE_TRAINING_PROXY_TARGET?: string;
  readonly VITE_PEN_PORTAL_URL?: string;
  readonly VITE_PEN_ORG_PORTAL_URL?: string;
  readonly VITE_PEN_ADMIN_PORTAL_URL?: string;
  readonly VITE_PEN_INTERNAL_PORTAL_URL?: string;
  readonly VITE_PEN_EXTERNAL_PORTAL_URL?: string;
  readonly VITE_VDP_PORTAL_URL?: string;
  readonly VITE_VDP_ORG_PORTAL_URL?: string;
  readonly VITE_VDP_RESEARCHER_PORTAL_URL?: string;
  readonly VITE_VDP_ADMIN_PORTAL_URL?: string;
  readonly VITE_TRAINING_PORTAL_URL?: string;
  readonly VITE_TRAINING_ORG_PORTAL_URL?: string;
  readonly VITE_TRAINING_RESEARCHER_PORTAL_URL?: string;
  readonly VITE_TRAINING_ADMIN_PORTAL_URL?: string;
  readonly VITE_BUG_BOUNTY_PORTAL_URL?: string;
  readonly VITE_CHALLENGE_PORTAL_URL?: string;
  readonly VITE_AI_REDTEAM_PORTAL_URL?: string;
  readonly VITE_TRUST_CENTER_PORTAL_URL?: string;
}

import {
  defineRailway,
  github,
  preserve,
  project,
  service,
} from "railway/iac";

const repository = "Dapperdavidd/SideQuest";

export default defineRailway(() => {
  const verifier = service("verifier", {
    source: github(repository, {
      branch: "main",
      checkSuites: true,
    }),
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "infrastructure/docker/nimiq-verifier.Dockerfile",
      watchPatterns: [
        "/services/nimiq-verifier/**",
        "/infrastructure/docker/nimiq-verifier.Dockerfile",
        "/package.json",
        "/pnpm-lock.yaml",
        "/pnpm-workspace.yaml",
      ],
    },
    deploy: {
      healthcheckPath: "/health",
      healthcheckTimeout: 120,
      sleepApplication: false,
      restartPolicyType: "ON_FAILURE",
      restartPolicyMaxRetries: 10,
    },
    env: {
      VERIFIER_HOST: "0.0.0.0",
      VERIFIER_PORT: "8090",
      VERIFIER_SHARED_TOKEN: preserve(),
      NIMIQ_LOG_LEVEL: "warn",
    },
  });

  const api = service("api", {
    source: github(repository, {
      branch: "main",
      checkSuites: true,
    }),
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "infrastructure/docker/api.Dockerfile",
      watchPatterns: [
        "/services/api/**",
        "/infrastructure/docker/api.Dockerfile",
      ],
    },
    deploy: {
      healthcheckPath: "/health",
      healthcheckTimeout: 120,
      sleepApplication: false,
      restartPolicyType: "ON_FAILURE",
      restartPolicyMaxRetries: 10,
    },
    env: {
      API_HOST: "0.0.0.0",
      API_PORT: "8080",
      API_ALLOWED_ORIGINS: preserve(),
      DATABASE_URL: preserve(),
      DATABASE_MAX_CONNECTIONS: "5",
      SUPABASE_JWKS_URL: preserve(),
      SIDEQUEST_ADMIN_USER_IDS: preserve(),
      NIMIQ_NETWORK: "testnet",
      NIMIQ_TREASURY_ADDRESS: "NQ24 VU9V 76NV SRFA QVGJ JE50 139Q 3U38 DUN0",
      NIMIQ_VERIFIER_URL: "http://verifier.railway.internal:8090",
      NIMIQ_VERIFIER_TOKEN: preserve(),
      NIMIQ_MIN_CONFIRMATIONS: "2",
      RUST_LOG: "api=info,actix_web=info",
    },
  });

  return project("SideQuest", {
    resources: [api, verifier],
  });
});

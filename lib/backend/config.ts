interface AppConfig {
  convexUrl: string;
  convexAdminKey: string;
  convexCloudUrl: string;
  convexCloudDeployKey: string;
  hiaClientPassword?: string;
  hiaHomelabKey?: string;
  hiaJwtSecret?: string;
  groqApiKey?: string;
  isProd: boolean;
}

const getEnv = (key: string, required = false): string => {
  const value = process.env[key];
  if (required && !value) {
    if (typeof window === "undefined") {
      // Server-side fatal error
      throw new Error(`Missing required environment variable: ${key}`);
    } else {
      console.error(`Missing required environment variable: ${key}`);
    }
  }
  return value || "";
};

export const config: AppConfig = {
  convexUrl: getEnv("CONVEX_URL") || "http://127.0.0.1:3210",
  convexAdminKey: getEnv("CONVEX_ADMIN_KEY"),
  convexCloudUrl: getEnv("CONVEX_CLOUD_URL"),
  convexCloudDeployKey: getEnv("CONVEX_CLOUD_DEPLOY_KEY"),
  hiaClientPassword: getEnv("HIA_CLIENT_PASSWORD"),
  hiaHomelabKey: getEnv("HIA_HOMELAB_KEY"),
  hiaJwtSecret: getEnv("HIA_JWT_SECRET"),
  groqApiKey: getEnv("GROQ_API_KEY"),
  isProd: getEnv("PROD") === "true",
};

// Validate critical server-side secrets if running on server
if (typeof window === "undefined") {
  if (!config.convexAdminKey) {
    console.warn("WARNING: CONVEX_ADMIN_KEY is not set.");
  }
}

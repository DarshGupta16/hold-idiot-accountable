interface AppConfig {
  pocketbaseUrl: string;
  adminEmail: string;
  adminPassword?: string;
  hiaClientPassword?: string;
  hiaHomelabKey?: string;
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
  pocketbaseUrl: getEnv("POCKETBASE_URL") || "http://127.0.0.1:8090",
  adminEmail: getEnv("POCKETBASE_ADMIN_EMAIL"),
  adminPassword: getEnv("POCKETBASE_ADMIN_PASSWORD"),
  hiaClientPassword: getEnv("HIA_CLIENT_PASSWORD"),
  hiaHomelabKey: getEnv("HIA_HOMELAB_KEY"),
  groqApiKey: getEnv("GROQ_API_KEY"),
  isProd: getEnv("PROD") === "true",
};

// Validate critical server-side secrets if running on server
if (typeof window === "undefined") {
  if (!config.adminEmail) {
    console.warn("WARNING: POCKETBASE_ADMIN_EMAIL is not set.");
  }
}

import type { NextConfig } from "next";
import { loadEnv } from "@kianax/config";

// Load env vars from monorepo root
loadEnv();

const nextConfig: NextConfig = {
  // Forward NEXT_PUBLIC_* vars to the client build
  // These are loaded from root .env.local via @kianax/config
  env: {
    NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL,
  },
};

export default nextConfig;

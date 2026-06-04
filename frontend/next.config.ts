import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@aws-sdk"],
  env: {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || "http://localhost:3001",
  },
};

export default nextConfig;

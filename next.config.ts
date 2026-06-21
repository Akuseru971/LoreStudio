import type { NextConfig } from "next";
import path from "node:path";

const openAiBrowserStub = path.join(process.cwd(), "lib/stubs/openai-browser-stub.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["openai"],
  turbopack: {
    resolveAlias: {
      openai: {
        browser: openAiBrowserStub,
      },
    },
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        openai: openAiBrowserStub,
      };
    }

    return config;
  },
};

export default nextConfig;

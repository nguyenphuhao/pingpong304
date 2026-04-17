import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/ai/chat": ["./docs/tournament-rules.md"],
  },
};

export default nextConfig;

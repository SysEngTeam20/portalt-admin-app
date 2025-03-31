import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  api: {
    bodyParser: {
      sizeLimit: '50mb'
    }
  }
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  api: {
    bodyParser: {
      sizeLimit: '50mb'
    }
  },
  images: {
    domains: ['localhost'],
  },
  webpack: (config) => {
    config.module.rules.push({
      test: /\.(ico|png|jpg|jpeg|gif|svg)$/,
      type: 'asset/resource',
    });
    return config;
  },
};

export default nextConfig;

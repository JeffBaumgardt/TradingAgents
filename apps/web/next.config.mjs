/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@tradingagents/api-types", "@tradingagents/utils"],
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;

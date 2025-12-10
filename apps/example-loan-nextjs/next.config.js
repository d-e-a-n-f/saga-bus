/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@saga-bus/core",
    "@saga-bus/examples-shared",
    "@saga-bus/nextjs",
    "@saga-bus/store-inmemory",
    "@saga-bus/transport-inmemory",
    "@saga-bus/middleware-logging",
  ],
};

module.exports = nextConfig;

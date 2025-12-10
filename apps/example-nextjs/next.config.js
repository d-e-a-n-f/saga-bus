/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@saga-bus/core",
    "@saga-bus/examples-shared",
    "@saga-bus/nextjs",
    "@saga-bus/transport-rabbitmq",
  ],
  output: "standalone",
};

module.exports = nextConfig;

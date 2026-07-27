/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Bundle workspace packages (pure TS/JS, safe for the browser).
  transpilePackages: ['@pseudopilot/translator'],
};

export default nextConfig;

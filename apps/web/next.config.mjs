/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Bundle workspace packages (pure TS/JS, safe for the browser).
  transpilePackages: [
    '@pseudopilot/translator',
    '@pseudopilot/interpreter',
    '@pseudopilot/language-service',
    '@pseudopilot/compiler-service',
    '@pseudopilot/checker',
    '@pseudopilot/language-core',
  ],
};

export default nextConfig;

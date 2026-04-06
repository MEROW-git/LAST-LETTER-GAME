/** @type {import('next').NextConfig} */
const backendServerUrl = process.env.BACKEND_SERVER_URL || 'http://localhost:3001';

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendServerUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;

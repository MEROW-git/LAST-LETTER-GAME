/** @type {import('next').NextConfig} */
const backendServerUrl = process.env.BACKEND_SERVER_URL || 'http://localhost:3001';

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  async rewrites() {
    return [
      {
        source: '/api/auth/login',
        destination: `${backendServerUrl}/api/auth/login`,
      },
      {
        source: '/api/auth/register',
        destination: `${backendServerUrl}/api/auth/register`,
      },
      {
        source: '/api/auth/oauth',
        destination: `${backendServerUrl}/api/auth/oauth`,
      },
      {
        source: '/api/account/profile',
        destination: `${backendServerUrl}/api/account/profile`,
      },
      {
        source: '/api/account/password',
        destination: `${backendServerUrl}/api/account/password`,
      },
      {
        source: '/api/account/link-oauth',
        destination: `${backendServerUrl}/api/account/link-oauth`,
      },
      {
        source: '/api/rooms',
        destination: `${backendServerUrl}/api/rooms`,
      },
      {
        source: '/api/rooms/:path*',
        destination: `${backendServerUrl}/api/rooms/:path*`,
      },
      {
        source: '/api/stats',
        destination: `${backendServerUrl}/api/stats`,
      },
      {
        source: '/api/health',
        destination: `${backendServerUrl}/api/health`,
      },
    ];
  },
};

module.exports = nextConfig;

/** @type {import('next').NextConfig} */
const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8009';

const nextConfig = {
  output: 'standalone',

  // Proxy API calls to Express backend in development
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${backendUrl}/api/v1/:path*`,
      },
      {
        source: '/health',
        destination: `${backendUrl}/health`,
      },
    ];
  },

  // Dev server on port 3001 to avoid conflict with Express on 3000
  ...(process.env.NODE_ENV === 'development' && {
    experimental: {},
  }),
};

export default nextConfig;

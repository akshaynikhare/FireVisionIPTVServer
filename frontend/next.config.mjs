/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  // Proxy API calls to Express backend in development
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: 'http://localhost:3000/api/v1/:path*',
      },
      {
        source: '/health',
        destination: 'http://localhost:3000/health',
      },
    ];
  },

  // Dev server on port 3001 to avoid conflict with Express on 3000
  ...(process.env.NODE_ENV === 'development' && {
    experimental: {},
  }),
};

export default nextConfig;

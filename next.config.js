/** @type {import('next').NextConfig} */
const nextConfig = {
  // Proxy API calls to the processing worker during development
  async rewrites() {
    const workerUrl = process.env.WORKER_URL || 'http://localhost:3001';
    return [
      {
        source: '/api/worker/:path*',
        destination: `${workerUrl}/:path*`,
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: '*.vercel.app' },
      { protocol: 'https', hostname: '*.up.railway.app' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
};

module.exports = nextConfig;

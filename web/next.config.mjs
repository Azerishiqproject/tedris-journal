/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    console.log('Next.js rewrites are being applied');
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3500/api/:path*', // Proxy to Backend
      },
    ]
  },
  // Add this logging for debugging
  webpack: (config, { dev, isServer }) => {
    if (dev && isServer) {
      console.log('Next.js webpack config is being applied');
    }
    return config;
  },
};

export default nextConfig; 
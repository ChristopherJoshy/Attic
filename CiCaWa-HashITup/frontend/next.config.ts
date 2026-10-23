import type { NextConfig } from "next";
import withPWA from "next-pwa";

const nextConfig: NextConfig = {
  /* config options here */
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: process.env.NODE_ENV === 'development'
          ? 'http://localhost:8000/:path*'
          : '/api/:path*',
      },
    ];
  },
  // Remove experimental options that are causing warnings
  // experimental: {
  //   allowMiddlewareResponseBody: true,
  // },

  // Suppress webpack configuration warnings when using Turbopack
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      // Suppress webpack warnings in development
      config.infrastructureLogging = {
        level: 'error',
      };
    }
    return config;
  },
};

const pwaConfig = withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development', // Disable PWA in development
});

export default pwaConfig(nextConfig);
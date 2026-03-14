import type { NextConfig } from "next";

const isCapacitor = process.env.CAPACITOR === '1';
const isProduction = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  // Only use static export for production builds (GitHub Pages) or Capacitor.
  // In development, Next.js needs to run as a server.
  ...(isProduction || isCapacitor ? { output: 'export' } : {}),
  // Use a separate build directory for Capacitor so it doesn't clobber the dev server's .next
  ...(isCapacitor ? { distDir: '.next-capacitor' } : {}),
  basePath: isProduction && !isCapacitor ? '/book_review' : '',
  compiler: {
    removeConsole: isProduction ? { exclude: ['error', 'warn'] } : false,
  },
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  // Exclude mobile_app and packages directories from Next.js build
  pageExtensions: ['ts', 'tsx', 'js', 'jsx'],
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
    };
    // Exclude mobile_app and packages from webpack compilation
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/node_modules/**', '**/mobile_app/**', '**/packages/**'],
    };
    return config;
  },
};

export default nextConfig;

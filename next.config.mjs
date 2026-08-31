/**
 * Two build targets from one codebase (CLAUDE.md §7.1):
 *
 *   CAPACITOR=1 npm run build  → static export, bundled into the APK.
 *                                No SSR, no API routes — the APK talks to
 *                                the hosted backend over the network.
 *   npm run build              → normal Next.js build for Vercel.
 *
 * The APK must never contain server code: it ships to devices we do not
 * control, so anything with a DB credential stays server-side.
 */
const isCapacitor = process.env.CAPACITOR === '1';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  ...(isCapacitor && {
    output: 'export',
    // Capacitor serves from file:// — relative asset paths are required.
    assetPrefix: './',
  }),

  // Album artwork is served by the Internet Archive on behalf of Cover Art
  // Archive, which redirects across several *.archive.org hosts.
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.archive.org' },
      { protocol: 'https', hostname: 'coverartarchive.org' },
    ],
    ...(isCapacitor && { unoptimized: true }),
  },

  env: {
    NEXT_PUBLIC_BUILD_TARGET: isCapacitor ? 'capacitor' : 'web',
  },
};

export default nextConfig;

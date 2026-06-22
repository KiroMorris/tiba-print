/** @type {import('next').NextConfig} */
const nextConfig = {
  // Native modules (better-sqlite3, sharp, resvg) must not be bundled by webpack —
  // keep them external so Node loads the real .node binaries at runtime.
  serverExternalPackages: [
    'better-sqlite3',
    'sharp',
    '@resvg/resvg-js',
    'pdfjs-dist',
    '@napi-rs/canvas',
  ],
};

export default nextConfig;

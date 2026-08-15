/**
 * Static export, zero server functions (SPEC.md §11 "apps/web/ Next.js,
 * static export, ZERO server functions" + the ci:zero-functions gate
 * checked by scripts/check-zero-functions.mjs after every build).
 */
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  images: { unoptimized: true },
  transpilePackages: ["@graticule/core", "@graticule/model"],
  trailingSlash: true,
  reactStrictMode: true,
};

export default nextConfig;

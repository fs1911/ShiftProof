/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The app reads Supabase config from the environment at request time.
  // See lib/env.ts for the required variables and the clear-failure behavior.
};

export default nextConfig;

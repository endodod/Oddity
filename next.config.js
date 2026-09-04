/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Silences Turbopack's root-inference warning caused by an unrelated
  // package-lock.json in a parent directory outside this repo.
  turbopack: {
    root: __dirname,
  },
};

module.exports = nextConfig;

const path = require('path');
const { loadEnvConfig } = require('@next/env');

// Local development keeps one .env at the repository root, shared with the backend.
// Only NEXT_PUBLIC_* values are ever included in the website's code.
loadEnvConfig(path.join(__dirname, '..'));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  env: {
    // The project URL is public; reuse the backend's setting when the website's own is not set.
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
  },
};

module.exports = nextConfig;

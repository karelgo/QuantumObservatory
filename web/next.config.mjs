// SITE_URL is the single deployment knob. On a project Pages site it is
// https://<owner>.github.io/<repo>, and the path segment becomes Next's
// basePath so every route and asset resolves under it. On a custom domain
// the path is empty and nothing is prefixed. Unset (local dev) is also
// empty, so `next dev` serves from the root as before.
const siteUrl = process.env.SITE_URL || '';
const basePath = siteUrl ? new URL(siteUrl).pathname.replace(/\/+$/, '') : '';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath,
  // Inlined at build time so lib/site.ts can prefix hand-written paths.
  env: { SITE_URL: siteUrl, NEXT_PUBLIC_BASE_PATH: basePath },
};

export default nextConfig;

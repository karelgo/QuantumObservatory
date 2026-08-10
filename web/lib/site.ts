// Where the site is served from. One variable — SITE_URL — is the whole
// deployment configuration: next.config.mjs derives the base path from its
// path segment, the crawler stamps the same URL into pulse.json and
// feed.xml. A project Pages site (…/QuantumObservatory) and a custom
// domain (…/) differ only in that value.

export const SITE_URL = process.env.SITE_URL || 'http://localhost:3000';

/** The path the site is served under — '' at a domain root. */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/**
 * Prefix a root-relative path with the deployment's base path. `<Link>` and
 * `<Image>` do this on their own; plain anchors and metadata URLs do not, so
 * every hand-written absolute path goes through here.
 */
export function url(path: string): string {
  return `${BASE_PATH}${path}`;
}

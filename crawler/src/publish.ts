import fs from 'node:fs';
import path from 'node:path';
import type { Item } from './types.js';

// Where the site lives once hosting is decided; the repo is the stable
// address until then. Override with SITE_URL when deploying.
const SITE_URL = process.env.SITE_URL ?? 'https://github.com/karelgo/QuantumObservatory';
const FEED_SIZE = 50;

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Latest N items across day files, newest day first. */
function latestItems(itemsDir: string, n: number): Item[] {
  const files = fs
    .readdirSync(itemsDir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .reverse();
  const out: Item[] = [];
  for (const file of files) {
    const items: Item[] = JSON.parse(fs.readFileSync(path.join(itemsDir, file), 'utf8'));
    out.push(...items.sort((a, b) => b.significance - a.significance));
    if (out.length >= n) break;
  }
  return out.slice(0, n);
}

/**
 * Write the machine-readable feeds into web/public/ so the static export
 * serves them at /pulse.json and /feed.xml.
 *
 * pulse.json is a public, versioned contract — QuantumVerse's "Field
 * Pulse" widget consumes it. Bump `schema` on breaking changes only.
 */
export function writePublicFeeds(root: string): void {
  const itemsDir = path.join(root, 'data', 'items');
  const publicDir = path.join(root, 'web', 'public');
  fs.mkdirSync(publicDir, { recursive: true });

  const items = latestItems(itemsDir, FEED_SIZE);
  const now = new Date().toUTCString();

  fs.writeFileSync(
    path.join(publicDir, 'pulse.json'),
    JSON.stringify(
      {
        schema: 1,
        source: 'quantum-observatory',
        site: SITE_URL,
        generated_at: new Date().toISOString(),
        items,
      },
      null,
      2,
    ) + '\n',
  );

  const rssItems = items
    .map(
      (item) => `    <item>
      <title>${xmlEscape(item.title)}</title>
      <link>${xmlEscape(item.url)}</link>
      <guid isPermaLink="false">${xmlEscape(item.id)}</guid>
      <pubDate>${new Date(item.published_at).toUTCString()}</pubDate>
      <category>${xmlEscape(item.category)}</category>${
        item.summary
          ? `\n      <description>${xmlEscape(item.summary)} (via ${xmlEscape(item.source_name)})</description>`
          : `\n      <description>via ${xmlEscape(item.source_name)}</description>`
      }
    </item>`,
    )
    .join('\n');

  fs.writeFileSync(
    path.join(publicDir, 'feed.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>The Quantum Observatory</title>
    <link>${xmlEscape(SITE_URL)}</link>
    <description>Everything that happened in quantum computing, collapsed into one daily digest. A QuantumVerse sister project.</description>
    <language>en</language>
    <lastBuildDate>${now}</lastBuildDate>
${rssItems}
  </channel>
</rss>
`,
  );
}

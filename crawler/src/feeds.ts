import { XMLParser } from 'fast-xml-parser';
import type { RawEntry } from './types.js';

const USER_AGENT =
  'QuantumObservatory/0.1 (+https://github.com/karelgo/QuantumObservatory; respectful daily feed reader)';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
});

/**
 * Decode HTML entities left over after XML parsing. Some feeds (e.g.
 * WordPress/Phys.org) double-encode titles, so the parser's own pass
 * still leaves `&#039;`-style entities behind. Order matters: undo
 * `&amp;` first so double-encoded sequences resolve fully.
 */
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/** Unwrap fast-xml-parser values: strings, CDATA objects, numbers. */
function text(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return decodeEntities(v.trim());
  if (typeof v === 'number') return String(v);
  if (typeof v === 'object' && '#text' in (v as Record<string, unknown>)) {
    return text((v as Record<string, unknown>)['#text']);
  }
  return '';
}

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function parseDate(v: unknown): Date | null {
  const s = text(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Atom <link> can be one object or an array; prefer rel="alternate". */
function atomLink(link: unknown): string {
  const links = asArray(link as Record<string, string> | Record<string, string>[]);
  const alternate = links.find((l) => l['@_rel'] === 'alternate' || l['@_rel'] == null);
  return (alternate ?? links[0])?.['@_href'] ?? '';
}

function rssEntry(item: Record<string, unknown>): RawEntry | null {
  const title = text(item.title);
  const url = text(item.link) || atomLink(item.link);
  const publishedAt =
    parseDate(item.pubDate) ?? parseDate(item['dc:date']) ?? parseDate(item.date);
  if (!title || !url || !publishedAt) return null;
  return { title, url, publishedAt };
}

function atomEntry(entry: Record<string, unknown>): RawEntry | null {
  const title = text(entry.title);
  const url = atomLink(entry.link);
  const publishedAt = parseDate(entry.published) ?? parseDate(entry.updated);
  if (!title || !url || !publishedAt) return null;
  return { title, url, publishedAt };
}

/**
 * Fetch and parse a feed. Handles RSS 2.0, Atom, and RDF (RSS 1.0) —
 * enough for every source in the registry, feed-format sniffed from the
 * parsed document rather than the URL.
 */
export async function fetchFeed(url: string): Promise<RawEntry[]> {
  const res = await fetch(url, {
    headers: {
      'user-agent': USER_AGENT,
      accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
    },
    signal: AbortSignal.timeout(20_000),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  let xml = await res.text();
  // We only need title/link/date. Strip article bodies before parsing —
  // they are huge, entity-heavy (tripping the parser's entity-expansion
  // guard on GitHub/WordPress feeds), and republishing them is against
  // the Observatory's editorial rules anyway.
  xml = xml
    .replace(/<content(?::encoded)?[\s>][\s\S]*?<\/content(?::encoded)?>/g, '')
    .replace(/<summary[\s>][\s\S]*?<\/summary>/g, '')
    .replace(/<description[\s>][\s\S]*?<\/description>/g, '');
  const doc = parser.parse(xml);

  if (doc.rss?.channel) {
    return asArray(doc.rss.channel.item as Record<string, unknown>[])
      .map(rssEntry)
      .filter((e): e is RawEntry => e !== null);
  }
  if (doc.feed) {
    return asArray(doc.feed.entry as Record<string, unknown>[])
      .map(atomEntry)
      .filter((e): e is RawEntry => e !== null);
  }
  if (doc['rdf:RDF']) {
    return asArray(doc['rdf:RDF'].item as Record<string, unknown>[])
      .map(rssEntry)
      .filter((e): e is RawEntry => e !== null);
  }
  throw new Error('unrecognized feed format (not RSS/Atom/RDF)');
}

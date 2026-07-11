import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

// The web app reads the committed data files at build time — no runtime
// data fetching, no client JS required to read the site.
const ROOT = path.resolve(process.cwd(), '..');
const DATA_DIR = path.join(ROOT, 'data');

export type CategorySlug =
  | 'hardware'
  | 'research'
  | 'software'
  | 'industry'
  | 'policy'
  | 'pqc'
  | 'people'
  | 'events';

// Display order + labels. Keep in sync with sources.yaml `categories`.
export const CATEGORIES: { slug: CategorySlug; label: string }[] = [
  { slug: 'hardware', label: 'Hardware & QPUs' },
  { slug: 'research', label: 'Research & Papers' },
  { slug: 'software', label: 'Software & Tools' },
  { slug: 'industry', label: 'Industry & Funding' },
  { slug: 'policy', label: 'Government & Policy' },
  { slug: 'pqc', label: 'Post-Quantum Security' },
  { slug: 'people', label: 'People & Community' },
  { slug: 'events', label: 'Events' },
];

export interface Item {
  id: string;
  date: string;
  category: CategorySlug;
  title: string;
  summary: string | null;
  url: string;
  source: string;
  source_name: string;
  published_at: string;
  also_at: { source: string; url: string }[];
  significance: number;
  qv_device: string | null;
  qv_artifact: string | null;
}

export interface DayIndex {
  date: string;
  count: number;
  categories: Record<string, number>;
}

export interface Index {
  generated_at: string;
  latest: string | null;
  days: DayIndex[];
}

export function getIndex(): Index {
  const file = path.join(DATA_DIR, 'index.json');
  if (!fs.existsSync(file)) return { generated_at: '', latest: null, days: [] };
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function getDay(date: string): Item[] {
  const file = path.join(DATA_DIR, 'items', `${date}.json`);
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function getLatestDay(): { date: string | null; items: Item[] } {
  const index = getIndex();
  if (!index.latest) return { date: null, items: [] };
  return { date: index.latest, items: getDay(index.latest) };
}

/** All items across day files, newest day first (capped). */
export function getAllItems(maxDays = 90): Item[] {
  const index = getIndex();
  const items: Item[] = [];
  for (const day of index.days.slice(0, maxDays)) {
    items.push(...getDay(day.date));
  }
  return items;
}

/** Neighbouring crawl days for prev/next navigation. days are newest-first. */
export function getDayNeighbours(date: string): { older: string | null; newer: string | null } {
  const days = getIndex().days.map((d) => d.date);
  const i = days.indexOf(date);
  if (i === -1) return { older: null, newer: null };
  return { older: days[i + 1] ?? null, newer: days[i - 1] ?? null };
}

export interface SourceEntry {
  id: string;
  name: string;
  kind: string;
  url: string;
  homepage: string;
  category_hint: CategorySlug;
  keyword_filter?: string;
  discovered?: boolean;
  max_per_day?: number;
}

export function getSources(): SourceEntry[] {
  const parsed = YAML.parse(fs.readFileSync(path.join(ROOT, 'sources.yaml'), 'utf8'));
  return parsed.sources;
}

export interface SourceHealth {
  id: string;
  name: string;
  ok: boolean;
  fetched: number;
  kept: number;
  error?: string;
  fetched_at: string;
}

export function getHealth(): { date: string; sources: SourceHealth[] } | null {
  const file = path.join(DATA_DIR, 'health.json');
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function groupByCategory(items: Item[]): Map<CategorySlug, Item[]> {
  const groups = new Map<CategorySlug, Item[]>();
  for (const { slug } of CATEGORIES) groups.set(slug, []);
  for (const item of items) {
    (groups.get(item.category) ?? groups.get('industry'))!.push(item);
  }
  for (const [slug, list] of groups) {
    list.sort((a, b) => b.significance - a.significance || b.published_at.localeCompare(a.published_at));
    if (list.length === 0) groups.delete(slug);
  }
  return groups;
}

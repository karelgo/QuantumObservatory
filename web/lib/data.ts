import fs from 'node:fs';
import path from 'node:path';

// The web app reads the committed data files at build time — no runtime
// data fetching, no client JS required to read the site.
const DATA_DIR = path.resolve(process.cwd(), '..', 'data');

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

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { classifyItems, hasCredentials, type ClassifierInput } from './classify.js';
import { fetchFeed } from './feeds.js';
import { writePublicFeeds } from './publish.js';
import type { Item, RawEntry, Registry, SourceConfig, SourceHealth } from './types.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DATA_DIR = path.join(ROOT, 'data');
const ITEMS_DIR = path.join(DATA_DIR, 'items');

const TRACKING_PARAMS = /^(utm_|fbclid|gclid|mc_cid|mc_eid|ref$)/;

function canonicalUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = '';
    for (const key of [...u.searchParams.keys()]) {
      if (TRACKING_PARAMS.test(key)) u.searchParams.delete(key);
    }
    return u.toString();
  } catch {
    return raw;
  }
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Normalized title used to cluster the same story across outlets. */
function clusterKey(title: string, discovered: boolean): string {
  let t = title;
  // Google News appends " - Publisher"; strip it for clustering only.
  if (discovered) t = t.replace(/\s+-\s+[^-]+$/, '');
  return t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

interface Seen {
  urls: Set<string>;
  /** Title cluster keys — catches re-fetched stories whose URL shifted
   *  (Google News rotates its redirect URLs between fetches). */
  clusters: Set<string>;
  ids: Set<string>;
}

function loadSeen(days: number): Seen {
  const seen: Seen = { urls: new Set(), clusters: new Set(), ids: new Set() };
  if (!fs.existsSync(ITEMS_DIR)) return seen;
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  for (const file of fs.readdirSync(ITEMS_DIR)) {
    const date = file.replace('.json', '');
    if (date < cutoff) continue;
    const items: Item[] = JSON.parse(fs.readFileSync(path.join(ITEMS_DIR, file), 'utf8'));
    for (const item of items) {
      seen.urls.add(item.url);
      for (const a of item.also_at) seen.urls.add(a.url);
      // Stored titles may or may not carry a publisher suffix — index both.
      seen.clusters.add(clusterKey(item.title, false));
      seen.clusters.add(clusterKey(item.title, true));
      seen.ids.add(item.id);
    }
  }
  return seen;
}

async function crawlSource(
  source: SourceConfig,
  cutoff: Date,
): Promise<{ health: SourceHealth; entries: RawEntry[] }> {
  const fetched_at = new Date().toISOString();
  try {
    const all = await fetchFeed(source.url);
    let entries = all.filter((e) => e.publishedAt >= cutoff);
    if (source.keyword_filter) {
      const re = new RegExp(source.keyword_filter, 'i');
      entries = entries.filter((e) => re.test(e.title));
    }
    entries.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
    if (source.max_per_day) entries = entries.slice(0, source.max_per_day);
    return {
      health: { id: source.id, name: source.name, ok: true, fetched: all.length, kept: entries.length, fetched_at },
      entries,
    };
  } catch (err) {
    return {
      health: {
        id: source.id,
        name: source.name,
        ok: false,
        fetched: 0,
        kept: 0,
        error: err instanceof Error ? err.message : String(err),
        fetched_at,
      },
      entries: [],
    };
  }
}

async function main() {
  const registry: Registry = YAML.parse(fs.readFileSync(path.join(ROOT, 'sources.yaml'), 'utf8'));
  const date = todayUTC();

  const firstRun = !fs.existsSync(ITEMS_DIR) || fs.readdirSync(ITEMS_DIR).length === 0;
  const lookbackArg = process.argv.find((a) => a.startsWith('--lookback='));
  const lookbackDays = lookbackArg ? Number(lookbackArg.split('=')[1]) : firstRun ? 7 : 1;
  const cutoff = new Date(Date.now() - lookbackDays * 86_400_000);

  console.log(`Crawling ${registry.sources.length} sources (lookback ${lookbackDays}d, cutoff ${cutoff.toISOString()})`);

  const seen = loadSeen(14);
  const results = await Promise.all(registry.sources.map((s) => crawlSource(s, cutoff)));

  // Assemble items with URL and title-cluster dedupe, both within this
  // run and against the last 14 days of committed data.
  // Registry order matters: earlier (curated) sources win clusters over
  // later (discovered) ones, so put discovery feeds last in sources.yaml.
  const byUrl = new Map<string, Item>();
  const byCluster = new Map<string, Item>();
  const usedIds = new Set<string>(seen.ids);

  for (let i = 0; i < registry.sources.length; i++) {
    const source = registry.sources[i];
    for (const entry of results[i].entries) {
      const url = canonicalUrl(entry.url);
      if (seen.urls.has(url) || byUrl.has(url)) continue;

      const key = clusterKey(entry.title, source.discovered ?? false);
      if (seen.clusters.has(key)) continue; // already reported on a prior day/run

      const existing = byCluster.get(key);
      if (existing) {
        existing.also_at.push({ source: source.id, url });
        byUrl.set(url, existing);
        continue;
      }

      let id = `${date}-${slugify(entry.title)}`;
      for (let n = 2; usedIds.has(id); n++) id = `${date}-${slugify(entry.title)}-${n}`;
      usedIds.add(id);

      const item: Item = {
        id,
        date,
        category: source.category_hint,
        title: entry.title,
        summary: null,
        url,
        source: source.id,
        source_name: source.name,
        published_at: entry.publishedAt.toISOString(),
        also_at: [],
        significance: source.significance_hint ?? 3,
        qv_device: null,
        qv_artifact: null,
      };
      byUrl.set(url, item);
      byCluster.set(key, item);
    }
  }

  const newItems = [...new Set(byUrl.values())];

  // Merge with anything already written for today (re-runs are additive).
  const dayFile = path.join(ITEMS_DIR, `${date}.json`);
  const existing: Item[] = fs.existsSync(dayFile) ? JSON.parse(fs.readFileSync(dayFile, 'utf8')) : [];
  let merged = [...existing, ...newItems];

  // ── Classification (Claude API, structured outputs) ──────────────
  // Default: classify this run's new items. --reclassify additionally
  // retries anything without a summary (backfill). --no-llm skips.
  const noLlm = process.argv.includes('--no-llm');
  const reclassify = process.argv.includes('--reclassify');
  const newIds = new Set(newItems.map((i) => i.id));
  const targets = merged.filter((i) => newIds.has(i.id) || (reclassify && i.summary === null));

  if (noLlm || !hasCredentials()) {
    if (targets.length > 0 && !noLlm) {
      console.log(
        '\nNo API credentials (ANTHROPIC_FOUNDRY_API_KEY or ANTHROPIC_API_KEY) — keeping heuristic categories, no summaries.',
      );
    }
  } else if (targets.length > 0) {
    // Grounding excerpts come from this run's fetched feeds, matched by
    // URL (they are never persisted). Older backfill items may miss.
    const excerptByUrl = new Map<string, string>();
    for (const r of results) {
      for (const e of r.entries) {
        if (e.excerpt) excerptByUrl.set(canonicalUrl(e.url), e.excerpt);
      }
    }
    const sourceById = new Map(registry.sources.map((s) => [s.id, s]));
    const inputs: ClassifierInput[] = targets.map((i) => ({
      id: i.id,
      title: i.title,
      source_name: i.source_name,
      category_hint: sourceById.get(i.source)?.category_hint ?? i.category,
      excerpt: excerptByUrl.get(i.url),
    }));

    console.log(`\nClassifying ${inputs.length} items…`);
    try {
      const classified = await classifyItems(inputs);
      for (const item of merged) {
        const c = classified.get(item.id);
        if (!c) continue;
        item.category = c.category;
        item.summary = c.summary;
        item.significance = c.significance;
      }
      console.log(`  ${classified.size}/${inputs.length} classified (${[...classified.values()].filter((c) => c.summary).length} with summaries)`);
    } catch (err) {
      // A misconfigured endpoint must not cost us the day's data —
      // keep heuristics, land the crawl, and shout in the log.
      console.error(
        `  CLASSIFIER MISCONFIGURED, keeping heuristics: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  merged = merged.sort(
    (a, b) => b.significance - a.significance || a.category.localeCompare(b.category),
  );

  fs.mkdirSync(ITEMS_DIR, { recursive: true });
  fs.writeFileSync(dayFile, JSON.stringify(merged, null, 2) + '\n');

  // Rebuild the rolling index.
  const days = fs
    .readdirSync(ITEMS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const items: Item[] = JSON.parse(fs.readFileSync(path.join(ITEMS_DIR, f), 'utf8'));
      const categories: Record<string, number> = {};
      for (const item of items) categories[item.category] = (categories[item.category] ?? 0) + 1;
      return { date: f.replace('.json', ''), count: items.length, categories };
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  fs.writeFileSync(
    path.join(DATA_DIR, 'index.json'),
    JSON.stringify({ generated_at: new Date().toISOString(), latest: days[0]?.date ?? null, days }, null, 2) + '\n',
  );

  const health = results.map((r) => r.health);
  fs.writeFileSync(path.join(DATA_DIR, 'health.json'), JSON.stringify({ date, sources: health }, null, 2) + '\n');

  // Machine-readable feeds: /pulse.json (the QuantumVerse contract) + RSS.
  writePublicFeeds(ROOT);

  for (const h of health) {
    console.log(
      `  ${h.ok ? '✓' : '✗'} ${h.id.padEnd(26)} fetched ${String(h.fetched).padStart(3)}  kept ${String(h.kept).padStart(3)}${h.error ? `  (${h.error})` : ''}`,
    );
  }
  console.log(`\n${newItems.length} new items → data/items/${date}.json (${merged.length} total for ${date})`);

  const failures = health.filter((h) => !h.ok);
  if (failures.length === health.length) {
    console.error('Every source failed — refusing to write an empty day as success.');
    process.exit(1);
  }
}

main();

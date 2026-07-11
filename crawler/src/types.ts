export type CategorySlug =
  | 'hardware'
  | 'research'
  | 'software'
  | 'industry'
  | 'policy'
  | 'pqc'
  | 'people'
  | 'events';

export interface SourceConfig {
  id: string;
  name: string;
  kind: 'rss' | 'arxiv';
  url: string;
  homepage: string;
  category_hint: CategorySlug;
  keyword_filter?: string;
  discovered?: boolean;
  significance_hint?: number;
  max_per_day?: number;
}

export interface Registry {
  version: number;
  categories: { slug: CategorySlug; label: string }[];
  sources: SourceConfig[];
}

export interface Item {
  id: string;
  date: string; // YYYY-MM-DD (crawl day, UTC)
  category: CategorySlug;
  title: string;
  summary: string | null; // filled by the classifier (Phase 1); always our own words
  url: string;
  source: string; // source id
  source_name: string;
  published_at: string; // ISO 8601
  also_at: { source: string; url: string }[];
  significance: number; // 1–5
  qv_device: string | null; // reserved: QuantumVerse Device Registry slug
  qv_artifact: string | null; // reserved: QuantumVerse artifact slug
}

export interface RawEntry {
  title: string;
  url: string;
  publishedAt: Date;
  /** Classifier grounding context only — never persisted or rendered. */
  excerpt?: string;
}

export interface SourceHealth {
  id: string;
  name: string;
  ok: boolean;
  fetched: number; // entries seen in the feed
  kept: number; // entries that survived window/filter/dedupe
  error?: string;
  fetched_at: string;
}

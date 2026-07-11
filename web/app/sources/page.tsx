import type { Metadata } from 'next';
import { CATEGORIES, getHealth, getSources } from '@/lib/data';

export const metadata: Metadata = {
  title: 'Sources — The Quantum Observatory',
};

export default function SourcesPage() {
  const sources = getSources();
  const health = getHealth();
  const healthById = new Map((health?.sources ?? []).map((h) => [h.id, h]));
  const labelFor = (slug: string) => CATEGORIES.find((c) => c.slug === slug)?.label ?? slug;

  return (
    <main className="page">
      <h1 className="dateline">
        <strong>Sources</strong> · every feed the Observatory reads
        {health && <> · last crawl {health.date}</>}
      </h1>
      <p className="prose-note">
        The registry is <a href="https://github.com/karelgo/QuantumObservatory/blob/main/sources.yaml">sources.yaml</a> —
        transparency is the point. A failing source degrades gracefully and shows up here, never as a broken site.
      </p>
      <section className="category">
        {sources.map((s) => {
          const h = healthById.get(s.id);
          return (
            <article className="item source-row" key={s.id}>
              <h3>
                <a href={s.homepage} rel="noopener">
                  {s.name}
                </a>{' '}
                {h && (
                  <span className={h.ok ? 'health-ok' : 'health-fail'} title={h.error ?? 'ok'}>
                    {h.ok ? '✓' : '✗'}
                  </span>
                )}
              </h3>
              <p className="meta">
                {s.id} · {labelFor(s.category_hint)}
                {s.discovered && ' · discovery fallback'}
                {h && ` · last crawl kept ${h.kept} of ${h.fetched}`}
                {h?.error && ` · ${h.error}`}
              </p>
            </article>
          );
        })}
      </section>
    </main>
  );
}

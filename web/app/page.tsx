import { CATEGORIES, getLatestDay, groupByCategory, type Item } from '@/lib/data';

function formatDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function ItemRow({ item }: { item: Item }) {
  return (
    <article className="item">
      <h3>
        <a href={item.url} rel="noopener">
          {item.title}
        </a>
      </h3>
      <p className="meta">
        {item.source_name}
        {item.also_at.length > 0 && (
          <>
            {' · also at '}
            {item.also_at.map((a, i) => (
              <span key={a.url}>
                {i > 0 && ', '}
                <a href={a.url} rel="noopener">
                  {a.source}
                </a>
              </span>
            ))}
          </>
        )}
      </p>
      {item.summary && <p className="summary">{item.summary}</p>}
    </article>
  );
}

export default function Home() {
  const { date, items } = getLatestDay();
  const groups = date ? groupByCategory(items) : new Map();

  return (
    <main className="page">
      <header className="masthead">
        <h1>
          <a href="/">The Quantum Observatory</a>
        </h1>
        <p className="tagline">
          Everything that happened in quantum computing, collapsed into one daily digest.
        </p>
        {date && (
          <p className="dateline">
            <strong>{formatDate(date)}</strong> · {items.length} items
          </p>
        )}
      </header>

      {!date && <p className="empty">No crawl data yet — run `npm run crawl` to take the first measurement.</p>}

      {CATEGORIES.map(({ slug, label }) => {
        const list = groups.get(slug);
        if (!list || list.length === 0) return null;
        return (
          <section className="category" key={slug}>
            <h2>
              {label} <span className="count">{list.length}</span>
            </h2>
            {list.map((item: Item) => (
              <ItemRow key={item.id} item={item} />
            ))}
          </section>
        );
      })}
    </main>
  );
}

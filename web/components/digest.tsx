import Link from 'next/link';
import { CATEGORIES, groupByCategory, type Item } from '@/lib/data';

export function formatDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function ItemRow({ item, showDate = false }: { item: Item; showDate?: boolean }) {
  return (
    <article className="item">
      <h3>
        <a href={item.url} rel="noopener">
          {item.title}
        </a>
      </h3>
      <p className="meta">
        {showDate && (
          <>
            <Link href={`/day/${item.date}/`}>{item.date}</Link>
            {' · '}
          </>
        )}
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

export function CategorySections({ items }: { items: Item[] }) {
  const groups = groupByCategory(items);
  return (
    <>
      {CATEGORIES.map(({ slug, label }) => {
        const list = groups.get(slug);
        if (!list || list.length === 0) return null;
        return (
          <section className="category" key={slug}>
            <h2>
              <Link href={`/category/${slug}/`}>{label}</Link>{' '}
              <span className="count">{list.length}</span>
            </h2>
            {list.map((item) => (
              <ItemRow key={item.id} item={item} />
            ))}
          </section>
        );
      })}
    </>
  );
}

export function DayNav({ older, newer }: { older: string | null; newer: string | null }) {
  if (!older && !newer) return null;
  return (
    <nav className="day-nav" aria-label="Archive">
      {older && <Link href={`/day/${older}/`}>← {older}</Link>}
      {newer && (
        <Link href={`/day/${newer}/`} className="newer">
          {newer} →
        </Link>
      )}
    </nav>
  );
}

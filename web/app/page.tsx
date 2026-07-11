import { CategorySections, DayNav, formatDate } from '@/components/digest';
import { getDayNeighbours, getLatestDay } from '@/lib/data';

export default function Home() {
  const { date, items } = getLatestDay();
  const { older } = date ? getDayNeighbours(date) : { older: null };

  return (
    <main className="page">
      {!date ? (
        <p className="empty">No crawl data yet — run `npm run crawl` to take the first measurement.</p>
      ) : (
        <>
          <h1 className="dateline">
            <strong>{formatDate(date)}</strong> · {items.length} items
          </h1>
          <CategorySections items={items} />
          <DayNav older={older} newer={null} />
        </>
      )}
    </main>
  );
}

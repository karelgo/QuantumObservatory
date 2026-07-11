import type { Metadata } from 'next';
import { CategorySections, DayNav, formatDate } from '@/components/digest';
import { getDay, getDayNeighbours, getIndex } from '@/lib/data';

export const dynamicParams = false;

export function generateStaticParams() {
  return getIndex().days.map((d) => ({ date: d.date }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ date: string }>;
}): Promise<Metadata> {
  const { date } = await params;
  return { title: `${date} — The Quantum Observatory` };
}

export default async function DayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const items = getDay(date);
  const { older, newer } = getDayNeighbours(date);

  return (
    <main className="page">
      <h1 className="dateline">
        <strong>{formatDate(date)}</strong> · {items.length} items
      </h1>
      <CategorySections items={items} />
      <DayNav older={older} newer={newer} />
    </main>
  );
}

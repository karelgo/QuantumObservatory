import type { Metadata } from 'next';
import { ItemRow } from '@/components/digest';
import { CATEGORIES, getAllItems, type CategorySlug } from '@/lib/data';

export const dynamicParams = false;

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: CategorySlug }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const label = CATEGORIES.find((c) => c.slug === slug)?.label ?? slug;
  return { title: `${label} — The Quantum Observatory` };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: CategorySlug }>;
}) {
  const { slug } = await params;
  const label = CATEGORIES.find((c) => c.slug === slug)?.label ?? slug;
  const items = getAllItems().filter((i) => i.category === slug);

  return (
    <main className="page">
      <h1 className="dateline">
        <strong>{label}</strong> · {items.length} items, most recent first
      </h1>
      {items.length === 0 ? (
        <p className="empty">Nothing in this category yet.</p>
      ) : (
        <section className="category">
          {items.map((item) => (
            <ItemRow key={item.id} item={item} showDate />
          ))}
        </section>
      )}
    </main>
  );
}

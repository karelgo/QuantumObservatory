import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About — The Quantum Observatory',
};

export default function AboutPage() {
  return (
    <main className="page prose">
      <h1 className="dateline">
        <strong>About</strong>
      </h1>

      <p>
        The Quantum Observatory is a reading instrument: a daily-updated, categorized overview of
        everything happening in quantum computing. Every day an automated crawl reads the quantum
        ecosystem — arXiv, journals, SDK release feeds, vendor blogs, media, policy feeds — and
        collapses it into one definite digest.
      </p>

      <h2>How it works</h2>
      <p>
        The crawl fetches every feed in the{' '}
        <a href="https://github.com/karelgo/QuantumObservatory/blob/main/sources.yaml">source registry</a>,
        deduplicates stories across outlets, and classifies each item into one of eight categories.
        Classification, one-to-two-sentence summaries, and significance scores are produced by
        Claude (Anthropic&apos;s model) with schema-validated structured outputs, grounded only in
        the feed&apos;s own title and description — the model is instructed to return no summary
        rather than invent one. <strong>Summaries are AI-generated</strong> and always in our own
        words; when they fail, items fall back to headline-only.
      </p>
      <p>
        There is no database: each day&apos;s items are a JSON file committed to the repository,
        and this site is statically rendered from them. The full archive is the URL space —{' '}
        <code>/day/&#123;date&#125;</code> for any crawl day, <code>/category/&#123;slug&#125;</code>{' '}
        for rolling views, <a href="/pulse.json">/pulse.json</a> and <a href="/feed.xml">/feed.xml</a>{' '}
        for machines.
      </p>

      <h2>Editorial rules</h2>
      <ul>
        <li>Never republish article text: headline, our own ≤2-sentence summary, and a link out.</li>
        <li>Every item links its source prominently — the site&apos;s job is to send readers outward.</li>
        <li>Feeds are fetched respectfully (robots.txt, honest user-agent, one crawl a day).</li>
        <li>No accounts, no comments, no cookies, no tracking.</li>
      </ul>

      <h2>The QuantumVerse relationship</h2>
      <p>
        The Observatory is a sister project to{' '}
        <a href="https://github.com/karelgo/QuantumVerse">QuantumVerse</a>, the home for quantum
        artifacts — circuits, results, and claims made shareable, runnable, and verifiable.
        QuantumVerse hosts what the field <em>builds</em>; the Observatory reports what the field{' '}
        <em>does</em>. They share one visual identity, and the Observatory&apos;s{' '}
        <a href="/pulse.json">pulse feed</a> is the contract that will let QuantumVerse render the
        field&apos;s daily pulse on its own pages.
      </p>
    </main>
  );
}

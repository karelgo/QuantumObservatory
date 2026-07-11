import type { Metadata } from 'next';
import { Fraunces } from 'next/font/google';
import Link from 'next/link';
import './globals.css';

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'The Quantum Observatory',
  description:
    'A daily-updated, categorized overview of everything happening in quantum computing. A QuantumVerse sister project.',
  alternates: {
    types: { 'application/rss+xml': '/feed.xml' },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fraunces.variable}>
      <body>
        <header className="masthead page">
          <p className="site-title">
            <Link href="/">The Quantum Observatory</Link>
          </p>
          <p className="tagline">
            Everything that happened in quantum computing, collapsed into one daily digest.
          </p>
          <nav className="site-nav" aria-label="Site">
            <Link href="/">Today</Link>
            <Link href="/about/">About</Link>
            <Link href="/sources/">Sources</Link>
            <a href="/feed.xml">RSS</a>
            <a href="/pulse.json">Pulse</a>
          </nav>
        </header>
        {children}
        <footer className="site-footer">
          <p>
            A <a href="https://github.com/karelgo/QuantumVerse">QuantumVerse</a> sister project —
            one observatory watches the machines, this one watches the field.
          </p>
          <p className="footer-links">
            <a href="https://github.com/karelgo/QuantumObservatory">Source</a>
          </p>
        </footer>
      </body>
    </html>
  );
}

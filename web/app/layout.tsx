import type { Metadata } from 'next';
import { Fraunces } from 'next/font/google';
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
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fraunces.variable}>
      <body>
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

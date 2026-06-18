import type { Metadata } from 'next';
import { Inter, Cinzel } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });
// Engraved-serif display face for "royal" numerals/titles (e.g. Smoke Signals
// card values). Exposed as a CSS variable so components opt in via Tailwind.
const cinzel = Cinzel({ subsets: ['latin'], weight: ['600', '700', '800', '900'], variable: '--font-cinzel' });

export const metadata: Metadata = {
  title: 'Foxflame',
  description: 'A suite of party games for remote teams. Gather round the fire and play.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.className} ${cinzel.variable} foxflame-bg min-h-screen`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}

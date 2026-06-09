import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

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
        className={`${inter.className} foxflame-bg min-h-screen`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}

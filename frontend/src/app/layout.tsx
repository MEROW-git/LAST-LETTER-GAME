import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Last Letter - Multiplayer Word Game',
  description: 'A real-time multiplayer word-chain game. Enter words that start with the last letter of the previous word!',
  keywords: ['word game', 'multiplayer', 'last letter', 'chain game', 'real-time'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}

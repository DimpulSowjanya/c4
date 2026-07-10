import '../styles/globals.css';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FanCompass AI — FIFA World Cup 2026 navigation & accessibility assistant',
  description: 'Smart multilingual stadium navigation and real-time crowd-aware routing support for fans and volunteers at the 2026 World Cup.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}

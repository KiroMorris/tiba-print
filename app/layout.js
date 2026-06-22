import './globals.css';
import { Bagel_Fat_One, Prompt } from 'next/font/google';

// MyTurtle brand fonts. Bagel Fat One = headings, Prompt = body.
const bagel = Bagel_Fat_One({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-bagel',
  display: 'swap',
});
const prompt = Prompt({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-prompt',
  display: 'swap',
});

export const metadata = {
  title: 'Tiba Print — DTF Layout & Nesting',
  description: 'Organize designs and pack them into DTF roll print files.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${bagel.variable} ${prompt.variable}`}>
      <body>{children}</body>
    </html>
  );
}

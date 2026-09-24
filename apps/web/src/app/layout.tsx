import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-plus-jakarta-sans',
});

export const metadata: Metadata = {
  title: 'Quiz MB — Foundation',
  description: 'Phase 0 foundation for Quiz MB.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className="min-h-screen font-sans bg-canvas text-text-primary">
        <header className="border-b border-border-surface bg-surface">
          <nav
            aria-label="Main navigation"
            className="mx-auto flex max-w-content flex-wrap items-center justify-between gap-space-sm px-margin-sm py-space-md md:px-margin lg:px-margin-lg"
          >
            <Link href="/" className="text-section-heading">
              Quiz MB
            </Link>
            <div className="flex gap-space-md text-body-secondary">
              <Link href="/login" className="underline underline-offset-4">
                Login placeholder
              </Link>
              <Link href="/signup" className="underline underline-offset-4">
                Signup placeholder
              </Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-content px-margin-sm py-space-2xl md:px-margin lg:px-margin-lg">
          {children}
        </main>
      </body>
    </html>
  );
}

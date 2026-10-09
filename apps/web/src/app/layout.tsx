import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { NavigationGuardProvider } from '@/components/forms/navigation-provider';
import {
  NO_INDEX,
  sharingMetadata,
  SITE_DESCRIPTION,
  SITE_TITLE,
  SITE_URL,
} from '@/config/seo';
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-plus-jakarta-sans',
});
export const metadata: Metadata = {
  ...sharingMetadata({ title: SITE_TITLE, description: SITE_DESCRIPTION }),
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_TITLE, template: '%s | QuizMB' },
  description: SITE_DESCRIPTION,
  robots: NO_INDEX,
  icons: { shortcut: '/favicon.ico' },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className="min-h-screen font-sans bg-canvas text-text-primary">
        <NavigationGuardProvider>{children}</NavigationGuardProvider>
      </body>
    </html>
  );
}

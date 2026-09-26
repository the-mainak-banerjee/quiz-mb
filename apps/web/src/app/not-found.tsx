import Link from 'next/link';
import { APP_LINKS } from '@/config/navigation';

export default function NotFound() {
  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-bold">Page not found</h1>
      <Link href={APP_LINKS.HOME} className="underline">
        Return home
      </Link>
    </section>
  );
}

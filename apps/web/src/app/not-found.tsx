import { House } from 'lucide-react';
import { MiloMessage } from '@/components/milo/milo-states';
import { NavigationItem } from '@/components/workspace/navigation-item';
import { APP_LINKS } from '@/config/navigation';

export default function NotFound() {
  return (
    <MiloMessage
      pose="error"
      eyebrow="404 · Page not found"
      title="Milo looked everywhere"
      description="This page doesn’t exist, or the link may be out of date."
    >
      <NavigationItem
        href={APP_LINKS.HOME}
        icon={<House size={18} aria-hidden="true" />}
        className="ds-primary-motion bg-action-primary text-action-on-primary hover:bg-action-primary-hover hover:text-action-on-primary"
      >
        Return home
      </NavigationItem>
    </MiloMessage>
  );
}

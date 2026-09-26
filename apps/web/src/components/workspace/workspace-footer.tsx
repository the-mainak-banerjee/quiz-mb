import { Text } from '@/components/ui';
import { FOOTER_NAVIGATION } from '@/config/navigation';
import { NavigationItem } from './navigation-item';

export function WorkspaceFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border-surface py-space-md">
      <div className="mx-auto flex max-w-content flex-wrap items-center justify-between gap-space-sm px-margin-sm md:px-margin lg:px-space-xl">
        <div>
          <Text variant="caption" tone="secondary">
            © {currentYear} QuizMB. Crafted for intellectual clarity.
          </Text>
        </div>
        <div className="flex flex-wrap gap-space-xs">
          {FOOTER_NAVIGATION.map(({ label, href }) => (
            <NavigationItem key={href} href={href}>
              {label}
            </NavigationItem>
          ))}
        </div>
      </div>
    </footer>
  );
}

import { Text } from '@/components/ui';
import { FOOTER_NAVIGATION } from '@/config/navigation';
import { NavigationItem } from './navigation-item';

export function WorkspaceFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border-surface py-space-md">
      <div className="mx-auto flex max-w-content flex-col gap-space-sm px-margin-sm md:flex-row md:flex-wrap md:items-center md:justify-between md:px-margin lg:px-space-xl">
        {/* On phones the copyright sits under the links, centred. */}
        <div className="order-last text-center md:order-none md:text-left">
          <Text variant="caption" tone="secondary">
            © {currentYear} QuizMB. Crafted by{' '}
            <a
              href="http://themainakb.com/work-with-me?ref=quizmb"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline transition-colors hover:text-accent-hover font-semibold underline-offset-2"
            >
              Mainak Banerjee
            </a>
            .
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

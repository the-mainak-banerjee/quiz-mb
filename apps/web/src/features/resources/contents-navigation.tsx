'use client';

import { useEffect, useState } from 'react';
import { Text, Surface } from '@/components/ui';
import { NavigationItem } from '@/components/workspace/navigation-item';

export type ContentsItem = { id: string; title: string };

export function ContentsNavigation({ items }: { items: ContentsItem[] }) {
  const [active, setActive] = useState(items[0]?.id);
  useEffect(() => {
    const sections = items
      .map(({ id }) => document.getElementById(id))
      .filter((section): section is HTMLElement => !!section);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-20% 0px -60% 0px' },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [items]);
  return (
    <Surface className="space-y-space-sm">
      <Text variant="caption" tone="secondary" className="uppercase">
        On this page
      </Text>
      <nav aria-label="On this page" className="flex flex-col gap-space-xs">
        {items.map(({ id, title }, index) => (
          <NavigationItem
            key={id}
            href={`#${id}`}
            active={active === id}
            aria-current={active === id ? 'location' : undefined}
            onClick={() => setActive(id)}
            className="justify-between text-left px-space-xs"
          >
            <Text as="span" variant="label">
              {title}
            </Text>
            <Text as="span" variant="caption" tone="secondary">
              {String(index + 1).padStart(2, '0')}
            </Text>
          </NavigationItem>
        ))}
      </nav>
    </Surface>
  );
}

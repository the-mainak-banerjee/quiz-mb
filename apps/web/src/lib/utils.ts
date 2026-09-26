import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// Semantic font sizes must not be mistaken for text colors and discarded.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        {
          text: [
            'display',
            'display-mobile',
            'page-title',
            'page-title-mobile',
            'section-heading',
            'card-title',
            'body',
            'body-secondary',
            'label',
            'caption',
            'badge',
          ],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getGreeting(date = new Date()) {
  const hour = date.getHours();

  if (hour < 12) {
    return 'Good morning,';
  }

  if (hour < 18) {
    return 'Good afternoon,';
  }

  if (hour < 22) {
    return 'Good evening,';
  }

  return 'Hello Night Owl,';
}
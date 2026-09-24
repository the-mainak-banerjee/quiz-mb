import base from '@quizmb/config/eslint';
import next from 'eslint-config-next/core-web-vitals';

const config = [
  ...base,
  ...next,
  {
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            '@quizmb/database',
            '@quizmb/database/*',
            '@prisma/*',
            '**/apps/api/**',
            '**/packages/database/**',
          ],
        },
      ],
    },
  },
];
export default config;

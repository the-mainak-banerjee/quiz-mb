import base from '@quizmb/config/eslint';
export default [
  ...base,
  {
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            'next',
            'next/*',
            'react',
            'react-dom',
            '@quizmb/web',
            '@quizmb/web/*',
          ],
        },
      ],
    },
  },
];

import js from '@eslint/js';
import ts from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default [
  { ignores: ['dist/**', '.next/**', 'node_modules/**', 'next-env.d.ts'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  prettier,
];

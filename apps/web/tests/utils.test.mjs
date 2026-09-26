import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cn } from '../src/lib/utils.ts';

test('semantic typography coexists with colors and still supports size overrides', () => {
  assert.equal(
    cn('text-section-heading', 'text-text-primary'),
    'text-section-heading text-text-primary',
  );
  assert.equal(
    cn('text-caption text-text-secondary', 'text-danger'),
    'text-caption text-danger',
  );
  assert.equal(cn('text-body', 'text-card-title'), 'text-card-title');
  assert.equal(
    cn('text-display-mobile md:text-display', 'text-text-primary'),
    'text-display-mobile md:text-display text-text-primary',
  );
});

/**
 * Regression coverage for the `isUApiSlug` multi-connection slug matcher.
 *
 * The keyless special case in `auth/state.ts` and several UI selectors in
 * `AiSettingsPage.tsx` rely on this predicate to recognise every U-API slug
 * — primary (`u-api-default`), bare (`u-api`), and numbered duplicates
 * (`u-api-1`, `u-api-2`, ...). Edge cases (lookalike slugs, falsy inputs)
 * must not match.
 */

import { describe, it, expect } from 'bun:test';
import { isUApiSlug } from '../u-api-defaults.ts';

describe('isUApiSlug', () => {
  describe('matches every U-API slug variant', () => {
    it('matches the bare base slug "u-api"', () => {
      expect(isUApiSlug('u-api')).toBe(true);
    });

    it('matches the primary slug "u-api-default"', () => {
      expect(isUApiSlug('u-api-default')).toBe(true);
    });

    it('matches numbered duplicate slugs', () => {
      expect(isUApiSlug('u-api-1')).toBe(true);
      expect(isUApiSlug('u-api-99')).toBe(true);
    });
  });

  describe('rejects lookalike slugs', () => {
    it('rejects "u-apix" (extra char, no dash)', () => {
      expect(isUApiSlug('u-apix')).toBe(false);
    });

    it('rejects "u-api-1a" (numeric suffix with trailing letter)', () => {
      expect(isUApiSlug('u-api-1a')).toBe(false);
    });
  });

  describe('rejects falsy inputs', () => {
    it('returns false for null', () => {
      expect(isUApiSlug(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isUApiSlug(undefined)).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isUApiSlug('')).toBe(false);
    });
  });
});

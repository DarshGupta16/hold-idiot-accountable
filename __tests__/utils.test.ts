import { describe, it, expect } from 'vitest';
import { formatDuration, cn } from '@/lib/utils';

describe('utils', () => {
  describe('formatDuration', () => {
    it('formats hours, minutes, and seconds correctly', () => {
      expect(formatDuration(3600)).toBe('1hr');
      expect(formatDuration(3660)).toBe('1hr 1min');
      expect(formatDuration(3665)).toBe('1hr 1min 5s');
      expect(formatDuration(900)).toBe('15min');
      expect(formatDuration(5)).toBe('5s');
      expect(formatDuration(0)).toBe('0s');
    });
  });

  describe('cn', () => {
    it('merges tailwind classes', () => {
      expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500');
      expect(cn('px-2', 'p-4')).toBe('p-4');
    });
  });

  describe('parsePocketBaseDate', () => {
    it('should no longer exist', async () => {
      const utils = await import('@/lib/utils');
      // @ts-ignore
      expect(utils.parsePocketBaseDate).toBeUndefined();
    });
  });
});

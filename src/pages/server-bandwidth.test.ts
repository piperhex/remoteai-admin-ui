import { expect, it } from 'vitest';
import { formatBandwidthBytes } from './server-bandwidth';

it('scales at binary unit boundaries and caps units at MB', () => {
  for (const language of ['zh', 'en'] as const) {
    for (const [bytes, expected] of [
      [0, '0 B'], [512, '512 B'], [1023, '1,023 B'], [1024, '1 KB'],
      [1536, '1.5 KB'], [1024 ** 2, '1 MB'], [1.25 * 1024 ** 2, '1.25 MB'], [1024 ** 3, '1,024 MB'],
    ] as const) expect(formatBandwidthBytes(bytes, language)).toBe(expected);
  }
});

it('normalizes invalid byte counts', () => {
  for (const bytes of [-1, NaN, Infinity, -Infinity]) expect(formatBandwidthBytes(bytes, 'zh')).toBe('0 B');
});

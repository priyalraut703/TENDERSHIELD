import { describe, expect, it } from 'vitest';

import {
  extractErrorMessage,
  formatTurnover,
  friendlyError,
  fromHex,
  isEmptyCommitment,
  isHexContractAddress,
  randomBytes32,
  toBytes32,
  toHex,
  truncateAddress,
} from './utils.js';

describe('toBytes32 / toHex / fromHex', () => {
  it('pads text to exactly 32 bytes', () => {
    expect(toBytes32('abc').length).toBe(32);
    expect(new TextDecoder().decode(toBytes32('abc').slice(0, 3))).toBe('abc');
  });

  it('truncates text longer than 32 bytes', () => {
    expect(toBytes32('a'.repeat(64)).length).toBe(32);
  });

  it('round-trips hex encoding', () => {
    const bytes = new Uint8Array([0, 1, 15, 16, 255]);
    expect(toHex(bytes)).toBe('00010f10ff');
    expect(toHex(fromHex('00010f10ff'))).toBe('00010f10ff');
    expect(toHex(fromHex('0x00010f10ff'))).toBe('00010f10ff');
  });

  it('generates random 32-byte values', () => {
    const a = randomBytes32();
    const b = randomBytes32();
    expect(a.length).toBe(32);
    expect(toHex(a)).not.toBe(toHex(b));
  });
});

describe('truncateAddress', () => {
  it('shortens long addresses with ellipsis', () => {
    const address = 'a'.repeat(64);
    expect(truncateAddress(address)).toBe('aaaaaaaaaaaaaa...aaaaaaaa');
  });

  it('returns short values unchanged', () => {
    expect(truncateAddress('short')).toBe('short');
  });
});

describe('formatTurnover', () => {
  it('uses Indian digit grouping', () => {
    expect(formatTurnover(5_000_000n)).toBe('50,00,000');
    expect(formatTurnover(1_250_000n)).toBe('12,50,000');
    expect(formatTurnover(999n)).toBe('999');
    expect(formatTurnover(10_000_000_000n)).toBe('10,00,00,00,000');
  });
});

describe('isHexContractAddress', () => {
  it('accepts exactly 64 hex characters', () => {
    expect(isHexContractAddress('a'.repeat(64))).toBe(true);
    expect(isHexContractAddress('0'.repeat(64))).toBe(true);
  });

  it('rejects wrong lengths and non-hex characters', () => {
    expect(isHexContractAddress('')).toBe(false);
    expect(isHexContractAddress('a'.repeat(63))).toBe(false);
    expect(isHexContractAddress('g'.repeat(64))).toBe(false);
    expect(isHexContractAddress('a'.repeat(64).toUpperCase().slice(0, 62) + 'zz')).toBe(false);
  });
});

describe('isEmptyCommitment', () => {
  it('detects all-zero commitments', () => {
    expect(isEmptyCommitment(new Uint8Array(32))).toBe(true);
    const nonZero = new Uint8Array(32);
    nonZero[0] = 1;
    expect(isEmptyCommitment(nonZero)).toBe(false);
  });
});

describe('friendlyError / extractErrorMessage', () => {
  it('maps proof-server failures to guidance', () => {
    expect(friendlyError(new Error('Failed to fetch proof'))).toContain('proof server');
  });

  it('maps rejected wallet requests', () => {
    expect(friendlyError({ cause: { failure: { message: 'User rejected' } } })).toContain('cancelled');
  });

  it('maps tender-closed failures', () => {
    expect(friendlyError(new Error('Transaction failed: Tender is not open for bids'))).toContain(
      'no longer OPEN',
    );
  });

  it('maps ledger network not-found failures', () => {
    expect(friendlyError(new Error('Contract not found on the selected network.'))).toContain(
      'selected network',
    );
  });

  it('extracts nested failure messages', () => {
    expect(
      extractErrorMessage({ cause: { failure: { cause: { message: 'inner cause' } } } }),
    ).toBe('inner cause');
  });

  it('falls back for unknown errors', () => {
    expect(friendlyError(undefined)).toContain('An unexpected error occurred');
    expect(friendlyError(new Error(''))).toBe('An unexpected error occurred. Check the browser console for details.');
  });
});
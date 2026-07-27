import { describe, it, expect, vi, afterEach } from 'vitest';
import { truncateHash, copyToClipboard } from './hash';

describe('truncateHash', () => {
  it('returns a short string unchanged (nothing to gain by truncating)', () => {
    expect(truncateHash('0xabc123')).toBe('0xabc123');
  });

  it('returns falsy values unchanged', () => {
    expect(truncateHash('')).toBe('');
    expect(truncateHash(null)).toBe(null);
    expect(truncateHash(undefined)).toBe(undefined);
  });

  it('truncates a typical 42-char address with the default head/tail', () => {
    const address = '0x1234567890abcdef1234567890abcdef12345678';
    expect(truncateHash(address)).toBe('0x1234…5678');
  });

  it('respects a custom head/tail', () => {
    const address = '0x1234567890abcdef1234567890abcdef12345678';
    expect(truncateHash(address, { head: 4, tail: 6 })).toBe('0x12…345678');
  });

  it('leaves a value unchanged when it is exactly at the head+tail+1 boundary', () => {
    // head=6 + tail=4 + 1 = 11 chars: nothing to gain, returned as-is.
    const value = '0x12345678';
    expect(value).toHaveLength(10);
    expect(truncateHash(value + '9')).toHaveLength(11);
    expect(truncateHash(value + '9')).toBe(value + '9');
  });

  it('truncates once a value is one character past the boundary', () => {
    const value = '0x123456789a'; // 12 chars, one past the 11-char boundary
    expect(truncateHash(value)).toBe('0x1234…789a');
  });
});

describe('copyToClipboard', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete document.execCommand;
  });

  it('resolves true when navigator.clipboard.writeText succeeds', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    const result = await copyToClipboard('hello world');

    expect(writeText).toHaveBeenCalledWith('hello world');
    expect(result).toBe(true);
  });

  it('resolves false (does not reject) when navigator.clipboard.writeText rejects', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    await expect(copyToClipboard('hello world')).resolves.toBe(false);
  });

  it('falls back to execCommand when navigator.clipboard is undefined', async () => {
    vi.stubGlobal('navigator', {});
    // jsdom doesn't implement execCommand at all, so vi.spyOn (which requires
    // the property to already exist) isn't an option here — define it directly.
    document.execCommand = vi.fn().mockReturnValue(true);

    const result = await copyToClipboard('fallback text');

    expect(document.execCommand).toHaveBeenCalledWith('copy');
    expect(result).toBe(true);
  });

  it('resolves false when the execCommand fallback also fails', async () => {
    vi.stubGlobal('navigator', {});
    document.execCommand = vi.fn().mockReturnValue(false);

    await expect(copyToClipboard('fallback text')).resolves.toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { arrayBufferToBase64, base64ToArrayBuffer } from '@/services/audio/base64';

describe('base64 audio transport', () => {
  it('round-trips arbitrary binary data', () => {
    const original = Uint8Array.from({ length: 256 }, (_, index) => index);

    const restored = new Uint8Array(base64ToArrayBuffer(arrayBufferToBase64(original.buffer)));

    expect(Array.from(restored)).toEqual(Array.from(original));
  });

  it('round-trips a buffer larger than the chunk size', () => {
    const original = Uint8Array.from({ length: 70000 }, (_, index) => index % 256);

    const restored = new Uint8Array(base64ToArrayBuffer(arrayBufferToBase64(original.buffer)));

    expect(restored.length).toBe(original.length);
    expect(restored[69999]).toBe(original[69999]);
  });
});

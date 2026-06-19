import { describe, expect, it } from 'vitest';
import { AudioClip } from '@/domain/audio-clip';

describe('AudioClip', () => {
  it('exposes the byte length of the wrapped audio', () => {
    const clip = new AudioClip({ bytes: new ArrayBuffer(128), mimeType: 'audio/ogg' });

    expect(clip.byteLength).toBe(128);
  });

  it('keeps the optional source id when provided', () => {
    const clip = new AudioClip({
      bytes: new ArrayBuffer(8),
      mimeType: 'audio/ogg',
      sourceId: 'msg-1',
    });

    expect(clip.sourceId).toBe('msg-1');
  });

  it('rejects empty audio', () => {
    expect(() => new AudioClip({ bytes: new ArrayBuffer(0), mimeType: 'audio/ogg' })).toThrow();
  });
});

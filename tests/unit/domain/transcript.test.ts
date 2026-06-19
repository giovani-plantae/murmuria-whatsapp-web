import { describe, expect, it } from 'vitest';
import { Transcript } from '@/domain/transcript';

describe('Transcript', () => {
  it('reports empty when the text is only whitespace', () => {
    const transcript = new Transcript({
      text: '   ',
      language: 'portuguese',
      modelId: 'm',
      device: 'wasm',
      durationMs: 1,
    });

    expect(transcript.isEmpty).toBe(true);
  });

  it('reports non-empty when there is recognized text', () => {
    const transcript = new Transcript({
      text: 'olá',
      language: 'portuguese',
      modelId: 'm',
      device: 'wasm',
      durationMs: 1,
    });

    expect(transcript.isEmpty).toBe(false);
  });
});

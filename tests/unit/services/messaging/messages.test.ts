import { describe, expect, it } from 'vitest';
import { isAddressedTo, isTranscribeRequest } from '@/services/messaging/messages';

const validRequest = {
  kind: 'transcribe-request',
  target: 'background',
  requestId: 'r-1',
  audio: { base64: 'AA==', mimeType: 'audio/ogg' },
};

describe('message guards', () => {
  it('recognizes a transcribe request', () => {
    expect(isTranscribeRequest(validRequest)).toBe(true);
  });

  it('rejects unrelated payloads', () => {
    expect(isTranscribeRequest({ kind: 'something-else' })).toBe(false);
    expect(isTranscribeRequest(null)).toBe(false);
  });

  it('matches the addressed target', () => {
    expect(isAddressedTo(validRequest, 'background')).toBe(true);
    expect(isAddressedTo(validRequest, 'offscreen')).toBe(false);
  });
});

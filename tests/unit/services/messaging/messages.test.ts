import { describe, expect, it } from 'vitest';
import {
    isAddressedTo,
    isCheckHostRequest,
    isTranscribeRequest,
} from '@/services/messaging/messages';

const validRequest = {
    kind: 'transcribe-request',
    target: 'background',
    requestId: 'r-1',
    audio: { base64: 'AA==', mimeType: 'audio/ogg' },
};

const checkHostRequest = {
    kind: 'check-host',
    target: 'background',
    requestId: 'c-1',
    url: 'http://murmuria.local:8771',
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

    it('recognizes a check-host request and does not confuse it with a transcribe request', () => {
        expect(isCheckHostRequest(checkHostRequest)).toBe(true);
        expect(isCheckHostRequest(validRequest)).toBe(false);
        expect(isTranscribeRequest(checkHostRequest)).toBe(false);
    });
});

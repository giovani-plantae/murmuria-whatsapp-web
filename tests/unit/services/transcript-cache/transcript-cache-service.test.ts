import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { TranscriptCacheService } from '@/services/transcript-cache/transcript-cache-service';

describe('TranscriptCacheService', () => {
    beforeEach(() => {
        fakeBrowser.reset();
    });

    it('returns null for a message that was never cached', async () => {
        const cache = new TranscriptCacheService();

        expect(await cache.get('unknown')).toBeNull();
    });

    it('stores a transcript and reads it back by message id', async () => {
        const cache = new TranscriptCacheService();

        await cache.set('msg-1', { text: 'olá mundo', language: 'portuguese' });

        const cached = await cache.get('msg-1');
        expect(cached?.text).toBe('olá mundo');
        expect(cached?.language).toBe('portuguese');
        expect(typeof cached?.at).toBe('number');
    });

    it('keeps transcripts isolated per message id', async () => {
        const cache = new TranscriptCacheService();

        await cache.set('msg-1', { text: 'one', language: 'english' });
        await cache.set('msg-2', { text: 'two', language: 'english' });

        expect((await cache.get('msg-1'))?.text).toBe('one');
        expect((await cache.get('msg-2'))?.text).toBe('two');
    });

    it('overwrites the previous transcript for the same message', async () => {
        const cache = new TranscriptCacheService();

        await cache.set('msg-1', { text: 'first', language: 'english' });
        await cache.set('msg-1', { text: 'second', language: 'english' });

        expect((await cache.get('msg-1'))?.text).toBe('second');
    });
});

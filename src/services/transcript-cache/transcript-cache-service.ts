export interface CachedTranscript {
  readonly text: string;
  readonly language: string;
  /** When it was cached (epoch ms); lets a future cleanup evict stale entries. */
  readonly at: number;
}

/**
 * Persists successful transcripts in `browser.storage.local`, keyed by the
 * WhatsApp message id. WhatsApp virtualizes the chat list and rebuilds its DOM
 * when you switch conversations, which discards the transcript text injected
 * into a bubble. Caching it here lets the content script re-render the text the
 * next time the same bubble is scanned, so a transcription survives navigating
 * away and back instead of having to be requested from the server again.
 */
export class TranscriptCacheService {
  private static readonly keyPrefix = 'murmuria.transcript.';

  /** Returns the cached transcript for a message, or null if none is stored. */
  async get(messageId: string): Promise<CachedTranscript | null> {
    const area = localStorageArea();
    if (!area) {
      return null;
    }
    const key = TranscriptCacheService.keyFor(messageId);
    const result = await area.get(key);
    const value = result[key];
    return isCachedTranscript(value) ? value : null;
  }

  /** Stores (overwriting any prior value) the transcript for a message. */
  async set(messageId: string, transcript: { text: string; language: string }): Promise<void> {
    const value: CachedTranscript = {
      text: transcript.text,
      language: transcript.language,
      at: Date.now(),
    };
    await localStorageArea()?.set({ [TranscriptCacheService.keyFor(messageId)]: value });
  }

  private static keyFor(messageId: string): string {
    return `${TranscriptCacheService.keyPrefix}${messageId}`;
  }
}

function isCachedTranscript(value: unknown): value is CachedTranscript {
  return (
    typeof value === 'object' && value !== null && typeof (value as CachedTranscript).text === 'string'
  );
}

function localStorageArea() {
  return browser.storage?.local ?? null;
}

import { OffscreenManager } from '@/services/offscreen/offscreen-manager';
import { isAddressedTo, isTranscribeRequest } from '@/services/messaging/messages';
import type { TranscribeRequest, TranscribeResponse } from '@/services/messaging/messages';

/**
 * The service worker is intentionally a thin router: it can't use the Web Audio
 * API needed to decode the audio, so it only guarantees the offscreen document
 * exists and relays transcription requests to it. The decoding and the server
 * call live in the offscreen document.
 */
class BackgroundRouter {
  private readonly offscreen: OffscreenManager;

  constructor(offscreen: OffscreenManager) {
    this.offscreen = offscreen;
    this.handleMessage = this.handleMessage.bind(this);
  }

  start(): void {
    browser.runtime.onMessage.addListener(this.handleMessage);
  }

  private handleMessage(message: unknown): Promise<TranscribeResponse> | undefined {
    if (!isAddressedTo(message, 'background') || !isTranscribeRequest(message)) {
      return undefined;
    }

    return this.relayToOffscreen(message);
  }

  private async relayToOffscreen(message: TranscribeRequest): Promise<TranscribeResponse> {
    await this.offscreen.ensure();
    return browser.runtime.sendMessage({
      ...message,
      target: 'offscreen',
    }) as Promise<TranscribeResponse>;
  }
}

export default defineBackground(() => {
  new BackgroundRouter(new OffscreenManager('offscreen.html')).start();
});

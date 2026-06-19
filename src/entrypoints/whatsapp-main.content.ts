import { arrayBufferToBase64 } from '@/services/audio/base64';
import {
  BRIDGE_SOURCE,
  EXTRACT_RESPONSE,
  isExtractRequest,
} from '@/services/whatsapp-internals/extraction-bridge';
import type { ExtractResponseMessage } from '@/services/whatsapp-internals/extraction-bridge';
import { extractWhatsAppAudio } from '@/services/whatsapp-internals/whatsapp-internals';
import { describeError } from '@/shared/errors';

/**
 * Runs in WhatsApp Web's MAIN world — the only place `window.require` and the
 * internal modules are reachable. Listens for extraction requests from the
 * ISOLATED content script over window.postMessage, downloads + decrypts the
 * audio, and posts the base64 bytes back. This is the only entrypoint that
 * touches WhatsApp internals.
 */
class MainWorldExtractor {
  constructor() {
    this.handleMessage = this.handleMessage.bind(this);
  }

  listen(): void {
    window.addEventListener('message', this.handleMessage);
  }

  private handleMessage(event: MessageEvent): void {
    if (event.origin !== window.origin || !isExtractRequest(event.data)) {
      return;
    }
    void this.respond(event.data.requestId, event.data.messageId);
  }

  private async respond(requestId: string, messageId: string): Promise<void> {
    try {
      const { arrayBuffer, mimeType } = await extractWhatsAppAudio(messageId);
      this.post({
        source: BRIDGE_SOURCE,
        kind: EXTRACT_RESPONSE,
        requestId,
        ok: true,
        base64: arrayBufferToBase64(arrayBuffer),
        mimeType,
      });
    } catch (error) {
      this.post({
        source: BRIDGE_SOURCE,
        kind: EXTRACT_RESPONSE,
        requestId,
        ok: false,
        error: describeError(error),
      });
    }
  }

  private post(message: ExtractResponseMessage): void {
    window.postMessage(message, window.origin);
  }
}

export default defineContentScript({
  matches: ['*://web.whatsapp.com/*'],
  world: 'MAIN',
  main() {
    new MainWorldExtractor().listen();
  },
});

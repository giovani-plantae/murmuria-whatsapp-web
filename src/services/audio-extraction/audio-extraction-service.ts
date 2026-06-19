import type { SerializedAudioClip } from '@/services/messaging/messages';
import {
  BRIDGE_SOURCE,
  EXTRACT_REQUEST,
  isExtractResponse,
} from '@/services/whatsapp-internals/extraction-bridge';

const EXTRACTION_TIMEOUT_MS = 30_000;

interface PendingExtraction {
  resolve(clip: SerializedAudioClip): void;
  reject(error: Error): void;
  messageId: string;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Extracts the decrypted bytes of a WhatsApp voice message as a base64 clip.
 *
 * The decryption only works from the page's MAIN world, so this (ISOLATED-world)
 * service is just the requester half of a window.postMessage bridge: it asks the
 * MAIN-world script (whatsapp-main.ts) to do the work and resolves when the
 * matching response arrives. Requests are keyed by id and time out so a broken
 * or missing MAIN-world side surfaces a clear error instead of hanging.
 */
export class AudioExtractionService {
  private readonly pending = new Map<string, PendingExtraction>();
  private listening = false;

  constructor() {
    this.handleMessage = this.handleMessage.bind(this);
  }

  async extract(messageId: string): Promise<SerializedAudioClip> {
    this.ensureListening();
    const requestId = crypto.randomUUID();

    return new Promise<SerializedAudioClip>((resolve, reject) => {
      const timer = setTimeout(() => this.settleTimeout(requestId), EXTRACTION_TIMEOUT_MS);
      this.pending.set(requestId, { resolve, reject, messageId, timer });
      window.postMessage(
        { source: BRIDGE_SOURCE, kind: EXTRACT_REQUEST, requestId, messageId },
        window.origin,
      );
    });
  }

  private ensureListening(): void {
    if (!this.listening) {
      window.addEventListener('message', this.handleMessage);
      this.listening = true;
    }
  }

  private handleMessage(event: MessageEvent): void {
    if (event.origin !== window.origin || !isExtractResponse(event.data)) {
      return;
    }

    const response = event.data;
    const pending = this.pending.get(response.requestId);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timer);
    this.pending.delete(response.requestId);

    if (response.ok && response.base64) {
      pending.resolve({
        base64: response.base64,
        mimeType: response.mimeType ?? 'audio/ogg; codecs=opus',
        sourceId: pending.messageId,
      });
    } else {
      pending.reject(new Error(response.error ?? 'Falha desconhecida ao extrair o áudio.'));
    }
  }

  private settleTimeout(requestId: string): void {
    const pending = this.pending.get(requestId);
    if (!pending) {
      return;
    }
    this.pending.delete(requestId);
    pending.reject(
      new Error('Tempo esgotado ao extrair o áudio (os internos do WhatsApp podem ter mudado).'),
    );
  }
}

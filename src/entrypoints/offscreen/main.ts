import { AudioDecoder } from '@/services/audio/audio-decoder';
import { isAddressedTo, isTranscribeRequest } from '@/services/messaging/messages';
import type { TranscribeRequest, TranscribeResponse } from '@/services/messaging/messages';
import {
  MURMURIA_ENDPOINT,
  MurmuriaTranscriptionService,
} from '@/services/transcription/murmuria-transcription-service';
import { TranscriptionCoordinator } from '@/services/transcription/transcription-coordinator';
import { DEFAULT_TRANSCRIPTION_CONFIG } from '@/services/transcription/transcription-config';
import { describeError } from '@/shared/errors';

/**
 * Bootstraps the offscreen document. It decodes the Opus audio to PCM with the
 * Web Audio API (only available in a DOM context, not in the service worker) and
 * POSTs it to the murmuria server for transcription.
 */
class OffscreenHost {
  private readonly coordinator: TranscriptionCoordinator;

  constructor() {
    this.handleMessage = this.handleMessage.bind(this);
    this.coordinator = new TranscriptionCoordinator({
      decoder: new AudioDecoder(),
      transcriber: new MurmuriaTranscriptionService({
        endpoint: MURMURIA_ENDPOINT,
        language: DEFAULT_TRANSCRIPTION_CONFIG.language,
      }),
    });
  }

  start(): void {
    browser.runtime.onMessage.addListener(this.handleMessage);
  }

  private handleMessage(message: unknown): Promise<TranscribeResponse> | undefined {
    if (!isAddressedTo(message, 'offscreen') || !isTranscribeRequest(message)) {
      return undefined;
    }
    return this.respond(message);
  }

  private async respond(message: TranscribeRequest): Promise<TranscribeResponse> {
    try {
      const transcript = await this.coordinator.transcribe(message.audio);
      return {
        kind: 'transcribe-success',
        requestId: message.requestId,
        transcript: {
          text: transcript.text,
          language: transcript.language,
          modelId: transcript.modelId,
          device: transcript.device,
          durationMs: transcript.durationMs,
        },
      };
    } catch (error) {
      return {
        kind: 'transcribe-failure',
        requestId: message.requestId,
        message: describeError(error),
      };
    }
  }
}

new OffscreenHost().start();

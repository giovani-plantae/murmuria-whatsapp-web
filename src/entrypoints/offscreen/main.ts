import { AudioDecoder } from '@/services/audio/audio-decoder';
import {
  isAddressedTo,
  isCheckHostRequest,
  isTranscribeRequest,
} from '@/services/messaging/messages';
import type {
  CheckHostRequest,
  CheckHostResult,
  TranscribeRequest,
  TranscribeResponse,
} from '@/services/messaging/messages';
import { MurmuriaTranscriptionService } from '@/services/transcription/murmuria-transcription-service';
import {
  BrowserEndpointStore,
  MurmuriaDiscoveryService,
  probeMurmuriaHealth,
  toCheckHostResult,
} from '@/services/transcription/murmuria-discovery-service';
import {
  DEFAULT_MURMURIA_HOSTS,
  DEFAULT_MURMURIA_PORTS,
  DISCOVERY_PROBE_TIMEOUT_MS,
} from '@/services/transcription/murmuria-discovery-config';
import { TranscriptionCoordinator } from '@/services/transcription/transcription-coordinator';
import { DEFAULT_TRANSCRIPTION_CONFIG } from '@/services/transcription/transcription-config';
import { describeError } from '@/core/errors';

/**
 * Bootstraps the offscreen document. It decodes audio to PCM with the Web Audio
 * API (only available in a DOM context, not in the service worker), POSTs it to
 * the murmuria server for transcription, and answers connection-health probes
 * (which also need network access the popup can't always reach directly).
 */
class OffscreenHost {
  private readonly discovery: MurmuriaDiscoveryService;
  private readonly coordinator: TranscriptionCoordinator;

  constructor() {
    this.handleMessage = this.handleMessage.bind(this);
    this.discovery = new MurmuriaDiscoveryService({
      hosts: DEFAULT_MURMURIA_HOSTS,
      ports: DEFAULT_MURMURIA_PORTS,
      probeTimeoutMs: DISCOVERY_PROBE_TIMEOUT_MS,
      store: new BrowserEndpointStore(),
      fetch: globalThis.fetch.bind(globalThis),
    });
    this.coordinator = new TranscriptionCoordinator({
      decoder: new AudioDecoder(),
      transcriber: new MurmuriaTranscriptionService({
        discovery: this.discovery,
        language: DEFAULT_TRANSCRIPTION_CONFIG.language,
      }),
    });
  }

  start(): void {
    browser.runtime.onMessage.addListener(this.handleMessage);
  }

  private handleMessage(
    message: unknown,
  ): Promise<TranscribeResponse> | Promise<CheckHostResult> | undefined {
    if (!isAddressedTo(message, 'offscreen')) {
      return undefined;
    }
    if (isTranscribeRequest(message)) {
      return this.transcribe(message);
    }
    if (isCheckHostRequest(message)) {
      return this.checkHost(message);
    }
    return undefined;
  }

  private async transcribe(message: TranscribeRequest): Promise<TranscribeResponse> {
    try {
      const transcript = await this.coordinator.transcribe(message.audio, {
        language: message.language,
        endpoint: message.endpoint,
      });
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

  private async checkHost(message: CheckHostRequest): Promise<CheckHostResult> {
    try {
      const host = message.url ?? (await this.discovery.resolve());
      const probe = await probeMurmuriaHealth(
        host,
        globalThis.fetch.bind(globalThis),
        DISCOVERY_PROBE_TIMEOUT_MS,
      );
      return toCheckHostResult(message.requestId, host, probe);
    } catch (error) {
      return {
        kind: 'check-host-result',
        requestId: message.requestId,
        ok: false,
        message: describeError(error),
      };
    }
  }
}

new OffscreenHost().start();

import { Transcript } from '@/domain/transcript';
import { encodeWav } from '@/services/audio/wav-encoder';
import type { Transcriber } from './transcriber';

/** murmuria server endpoint. Must match the running murmuria instance's port. */
export const MURMURIA_ENDPOINT = 'http://localhost:8771';

const SAMPLE_RATE = 16000;

export interface MurmuriaTranscriptionConfig {
  readonly endpoint: string;
  readonly language: string;
}

/**
 * Transcriber backed by the local murmuria server. The offscreen document
 * decodes the Opus audio to PCM, this wraps it as WAV and POSTs to the server's
 * /inference endpoint. The fetch works cross-origin because the extension holds
 * host_permissions for the localhost endpoint (no server CORS).
 */
export class MurmuriaTranscriptionService implements Transcriber {
  private readonly endpoint: string;
  private readonly language: string;

  constructor(config: MurmuriaTranscriptionConfig) {
    this.endpoint = config.endpoint;
    this.language = config.language;
  }

  async init(): Promise<void> {
    // Stateless: the model lives on the murmuria server. Nothing to warm up.
  }

  async transcribe(samples: Float32Array): Promise<Transcript> {
    const form = new FormData();
    form.append(
      'file',
      new Blob([encodeWav(samples, SAMPLE_RATE)], { type: 'audio/wav' }),
      'audio.wav',
    );
    form.append('language', this.language);
    form.append('temperature', '0');
    form.append('response_format', 'json');

    const startedAt = performance.now();
    const response = await fetch(`${this.endpoint}/inference`, { method: 'POST', body: form });
    if (!response.ok) {
      throw new Error(
        `murmuria respondeu ${response.status} — o servidor está rodando em ${this.endpoint}?`,
      );
    }

    const payload = (await response.json()) as { text?: string };
    return new Transcript({
      text: (payload.text ?? '').trim(),
      language: this.language,
      modelId: 'murmuria',
      device: 'murmuria',
      durationMs: performance.now() - startedAt,
    });
  }
}

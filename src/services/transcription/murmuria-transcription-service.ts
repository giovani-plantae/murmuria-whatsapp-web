import { Transcript } from '@/domain/transcript';
import { encodeWav } from '@/services/audio/wav-encoder';
import type { EndpointResolver } from './endpoint-resolver';
import type { Transcriber } from './transcriber';

const SAMPLE_RATE = 16000;

export interface MurmuriaTranscriptionConfig {
  readonly discovery: EndpointResolver;
  readonly language: string;
}

/**
 * Transcriber backed by the local murmuria server. The offscreen document
 * decodes the Opus audio to PCM, this wraps it as WAV and POSTs to the server's
 * /inference endpoint. The server address is resolved lazily via discovery; if a
 * POST fails because the server is unreachable (it moved or restarted), the
 * cached address is dropped and discovery runs once more before giving up.
 */
export class MurmuriaTranscriptionService implements Transcriber {
  private readonly discovery: EndpointResolver;
  private readonly language: string;

  constructor(config: MurmuriaTranscriptionConfig) {
    this.discovery = config.discovery;
    this.language = config.language;
  }

  async init(): Promise<void> {
    // Stateless: the model lives on the murmuria server. Nothing to warm up.
  }

  async transcribe(samples: Float32Array): Promise<Transcript> {
    const form = this.buildForm(samples);
    try {
      return await this.post(await this.discovery.resolve(), form);
    } catch (error) {
      if (!isServerUnreachable(error)) {
        throw error;
      }
      await this.discovery.forget();
      return this.post(await this.discovery.resolve(), form);
    }
  }

  private buildForm(samples: Float32Array): FormData {
    const form = new FormData();
    form.append(
      'file',
      new Blob([encodeWav(samples, SAMPLE_RATE)], { type: 'audio/wav' }),
      'audio.wav',
    );
    form.append('language', this.language);
    form.append('temperature', '0');
    form.append('response_format', 'json');
    return form;
  }

  private async post(endpoint: string, form: FormData): Promise<Transcript> {
    const startedAt = performance.now();
    const response = await fetch(`${endpoint}/inference`, { method: 'POST', body: form });
    if (!response.ok) {
      throw new Error(`murmuria responded ${response.status} — check the server at ${endpoint}.`);
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

/** A `fetch` that rejects (rather than returning a response) means the host could not be reached. */
function isServerUnreachable(error: unknown): boolean {
  return error instanceof TypeError;
}

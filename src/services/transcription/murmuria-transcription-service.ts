import { Transcript } from '@/domain/transcript';
import { encodeWav } from '@/services/audio/wav-encoder';
import type { EndpointResolver } from './endpoint-resolver';
import type { Transcriber, TranscribeOptions } from './transcriber';

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

  async transcribe(samples: Float32Array, options: TranscribeOptions = {}): Promise<Transcript> {
    const language = options.language ?? this.language;
    const form = this.buildForm(samples, language);

    // A manually configured host is tried first, with no probing. If it is
    // unreachable (it moved, or its optional host-permission was revoked), fall
    // back to auto-discovery instead of a hard, unrecoverable failure.
    if (options.endpoint) {
      try {
        return await this.post(options.endpoint, form, language);
      } catch (error) {
        if (!isServerUnreachable(error)) {
          throw error;
        }
        return this.post(await this.discovery.resolve(), form, language);
      }
    }

    try {
      return await this.post(await this.discovery.resolve(), form, language);
    } catch (error) {
      if (!isServerUnreachable(error)) {
        throw error;
      }
      await this.discovery.forget();
      return this.post(await this.discovery.resolve(), form, language);
    }
  }

  private buildForm(samples: Float32Array, language: string): FormData {
    const form = new FormData();
    form.append(
      'file',
      new Blob([encodeWav(samples, SAMPLE_RATE)], { type: 'audio/wav' }),
      'audio.wav',
    );
    form.append('language', language);
    form.append('temperature', '0');
    form.append('response_format', 'json');
    return form;
  }

  private async post(endpoint: string, form: FormData, language: string): Promise<Transcript> {
    const startedAt = performance.now();
    const response = await fetch(`${endpoint}/inference`, { method: 'POST', body: form });
    if (!response.ok) {
      const reason = await readServerError(response);
      throw new Error(
        `murmuria responded ${response.status}${reason ? ` (${reason})` : ''} — check the server at ${endpoint}.`,
      );
    }

    const payload = (await response.json()) as { text?: string };
    return new Transcript({
      text: (payload.text ?? '').trim(),
      language,
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

/**
 * Pulls the server's own explanation out of a failed response so the thrown
 * error names the actual reason (e.g. a rejected or unreadable audio) instead of
 * a bare status code. Read defensively: a server that sends nothing, or a body
 * we cannot read, must never mask the original HTTP failure.
 */
async function readServerError(response: Response): Promise<string> {
  try {
    const body = (await response.text()).trim();
    if (!body) {
      return '';
    }
    try {
      const parsed = JSON.parse(body) as { error?: unknown };
      if (typeof parsed.error === 'string' && parsed.error.trim()) {
        return parsed.error.trim();
      }
    } catch {
      // Not JSON — fall through and surface the raw text.
    }
    return body.slice(0, 200);
  } catch {
    return '';
  }
}

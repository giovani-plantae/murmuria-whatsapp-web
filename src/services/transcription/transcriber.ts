import type { Transcript } from '@/domain/transcript';

/** Per-request overrides; both fall back to the transcriber's configured defaults / discovery. */
export interface TranscribeOptions {
  /** Forced transcription language (e.g. 'portuguese', 'english', 'auto'). */
  readonly language?: string;
  /** Server base URL to POST to, bypassing discovery (used for a manually set host). */
  readonly endpoint?: string;
}

/**
 * Port consumed by the TranscriptionCoordinator. Decouples the coordinator from
 * any concrete backend (today: the murmuria server) and keeps it
 * unit-testable with a fake.
 */
export interface Transcriber {
  init(): Promise<void>;
  transcribe(samples: Float32Array, options?: TranscribeOptions): Promise<Transcript>;
}

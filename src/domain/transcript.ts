export interface TranscriptData {
  readonly text: string;
  readonly language: string;
  readonly modelId: string;
  /** Backend that produced this transcript (e.g. 'murmuria'); useful for diagnostics. */
  readonly device: string;
  readonly durationMs: number;
}

/**
 * Immutable result of transcribing one audio clip, carrying the recognized text
 * plus the provenance needed to reason about quality (which model produced it,
 * which language was forced, which backend ran it, how long inference took).
 */
export class Transcript {
  readonly text: string;
  readonly language: string;
  readonly modelId: string;
  readonly device: string;
  readonly durationMs: number;

  constructor(data: TranscriptData) {
    this.text = data.text;
    this.language = data.language;
    this.modelId = data.modelId;
    this.device = data.device;
    this.durationMs = data.durationMs;
  }

  get isEmpty(): boolean {
    return this.text.trim().length === 0;
  }
}

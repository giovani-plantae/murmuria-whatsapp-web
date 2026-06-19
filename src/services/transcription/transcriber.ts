import type { Transcript } from '@/domain/transcript';

/**
 * Port consumed by the TranscriptionCoordinator. Decouples the coordinator from
 * any concrete backend (today: the murmuria server) and keeps it
 * unit-testable with a fake.
 */
export interface Transcriber {
  init(): Promise<void>;
  transcribe(samples: Float32Array): Promise<Transcript>;
}

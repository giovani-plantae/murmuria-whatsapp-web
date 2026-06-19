import type { TranscriptData } from '@/domain/transcript';

/**
 * Identifies which extension context a runtime message is addressed to. Both the
 * background service worker and the offscreen document listen on the same
 * `browser.runtime.onMessage` channel, so every message is tagged with a target
 * and each context ignores messages that are not its own.
 */
export type MessageTarget = 'background' | 'offscreen';

/**
 * Audio crossing the runtime-messaging boundary is base64-encoded because
 * `chrome.runtime.sendMessage` serializes payloads as JSON and would drop a raw
 * ArrayBuffer. Voice notes are small enough that the ~33% overhead is negligible.
 */
export interface SerializedAudioClip {
  readonly base64: string;
  readonly mimeType: string;
  readonly sourceId?: string;
}

export interface TranscribeRequest {
  readonly kind: 'transcribe-request';
  readonly target: MessageTarget;
  readonly requestId: string;
  readonly audio: SerializedAudioClip;
}

export interface TranscribeSuccess {
  readonly kind: 'transcribe-success';
  readonly requestId: string;
  readonly transcript: TranscriptData;
}

export interface TranscribeFailure {
  readonly kind: 'transcribe-failure';
  readonly requestId: string;
  readonly message: string;
}

export type TranscribeResponse = TranscribeSuccess | TranscribeFailure;

export type ExtensionMessage = TranscribeRequest;

export function isTranscribeRequest(value: unknown): value is TranscribeRequest {
  return isRecord(value) && value.kind === 'transcribe-request';
}

export function isAddressedTo(value: unknown, target: MessageTarget): boolean {
  return isRecord(value) && value.target === target;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

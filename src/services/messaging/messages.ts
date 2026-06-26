import type { TranscriptData } from '@/core/domain/transcript';

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
  /** Forced transcription language for this request; falls back to the configured default when omitted. */
  readonly language?: string;
  /** Server base URL to use instead of auto-discovery; injected by the background router from the user's manual host. */
  readonly endpoint?: string;
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

/**
 * Asks a context with network access to probe a murmuria server's `/health`.
 * With `url` set it probes that exact host; without it, the offscreen document
 * resolves the current auto-discovered server and probes the winner.
 */
export interface CheckHostRequest {
  readonly kind: 'check-host';
  readonly target: MessageTarget;
  readonly requestId: string;
  readonly url?: string;
}

export interface CheckHostResult {
  readonly kind: 'check-host-result';
  readonly requestId: string;
  readonly ok: boolean;
  readonly host?: string;
  readonly service?: string;
  readonly latencyMs?: number;
  readonly message?: string;
}

export type ExtensionMessage = TranscribeRequest | CheckHostRequest;

export function isTranscribeRequest(value: unknown): value is TranscribeRequest {
  return isRecord(value) && value.kind === 'transcribe-request';
}

export function isCheckHostRequest(value: unknown): value is CheckHostRequest {
  return isRecord(value) && value.kind === 'check-host';
}

export function isAddressedTo(value: unknown, target: MessageTarget): boolean {
  return isRecord(value) && value.target === target;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

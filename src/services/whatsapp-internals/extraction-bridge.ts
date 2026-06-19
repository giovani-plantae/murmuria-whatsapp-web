/**
 * Protocol for the window.postMessage bridge between the ISOLATED content script
 * (which can talk to the extension) and the MAIN-world script (which can reach
 * WhatsApp's internal modules). Every message is namespaced with `source: 'wa2t'`
 * so it never collides with WhatsApp's own postMessage traffic.
 */
export const BRIDGE_SOURCE = 'wa2t';
export const EXTRACT_REQUEST = 'wa2t:extract:request';
export const EXTRACT_RESPONSE = 'wa2t:extract:response';

export interface ExtractRequestMessage {
  readonly source: typeof BRIDGE_SOURCE;
  readonly kind: typeof EXTRACT_REQUEST;
  readonly requestId: string;
  readonly messageId: string;
}

export interface ExtractResponseMessage {
  readonly source: typeof BRIDGE_SOURCE;
  readonly kind: typeof EXTRACT_RESPONSE;
  readonly requestId: string;
  readonly ok: boolean;
  readonly base64?: string;
  readonly mimeType?: string;
  readonly error?: string;
}

export function isExtractRequest(value: unknown): value is ExtractRequestMessage {
  return isBridgeMessage(value) && value.kind === EXTRACT_REQUEST;
}

export function isExtractResponse(value: unknown): value is ExtractResponseMessage {
  return isBridgeMessage(value) && value.kind === EXTRACT_RESPONSE;
}

function isBridgeMessage(value: unknown): value is { source: string; kind: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { source?: unknown }).source === BRIDGE_SOURCE
  );
}

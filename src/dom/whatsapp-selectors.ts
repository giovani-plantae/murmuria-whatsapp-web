/**
 * Centralized DOM signals for WhatsApp Web, kept in one place because they are
 * the most likely thing to break when WhatsApp ships a new build. Derived from a
 * real voice-message bubble (2026-05). Notes:
 *
 * - The per-message `data-id` is now a bare hash (no `false_`/`true_` prefix), so
 *   direction comes from the `.message-in` / `.message-out` class, not the id.
 * - Voice notes are detected via locale-INDEPENDENT signals first (`data-icon` /
 *   `data-testid` / `role` are not translated); the `aria-label` is a fallback
 *   since it changes with the UI language.
 */
export const WHATSAPP_SELECTORS = {
    /** Each rendered message row carries a hashed data-id. */
    messageContainer: 'div[data-id]',

    /** Any of these inside a message marks it as a voice note (locale-independent first). */
    voiceSignals: [
        '[data-icon="ptt-status"]',
        '[data-testid="ptt-status"]',
        '[role="slider"] canvas',
        '[aria-label="Voice message"]',
    ],

    /** Present only on messages sent by the current user. */
    outgoingMarker: '.message-out',

    /**
   * Fallback anchors for the transcript UI if the primary "colored balloon"
   * detection (walking up from the waveform to the first painted ancestor) fails.
   * `._ak49` is the audio balloon (hashed, may rotate); NOT `msg-container`, which
   * is a full-width wrapper that would stretch the caption across the whole pane.
   */
    bubbleAnchors: ['._ak49'],
} as const;

export type WhatsAppSelectors = typeof WHATSAPP_SELECTORS;

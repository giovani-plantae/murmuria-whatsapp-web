import { WHATSAPP_SELECTORS, type WhatsAppSelectors } from './whatsapp-selectors';

export type MessageDirection = 'incoming' | 'outgoing';

export interface AudioBubble {
  /** The `[data-id]` element wrapping the whole message. */
  readonly element: HTMLElement;
  /** The message's data-id hash; used as the source id for extraction. */
  readonly messageId: string;
  readonly direction: MessageDirection;
}

const MARK_ATTRIBUTE = 'data-wa2t-scanned';

/**
 * Finds WhatsApp voice-message bubbles in the DOM using the stable signals in
 * whatsapp-selectors.ts. Idempotent across re-scans: each bubble is marked with
 * the message id it was processed for. Because WhatsApp virtualizes the list and
 * recycles DOM nodes, a node whose data-id changed is treated as new and
 * returned again, so callers can refresh the injected UI.
 */
export class WhatsAppBubbleScanner {
  private readonly selectors: WhatsAppSelectors;

  constructor(selectors: WhatsAppSelectors = WHATSAPP_SELECTORS) {
    this.selectors = selectors;
  }

  /** Returns voice bubbles that have not yet been processed for their current message id. */
  scan(root: ParentNode): AudioBubble[] {
    const found: AudioBubble[] = [];

    for (const element of root.querySelectorAll<HTMLElement>(this.selectors.messageContainer)) {
      const messageId = element.getAttribute('data-id');
      if (!messageId || !this.isVoiceBubble(element)) {
        continue;
      }
      if (element.getAttribute(MARK_ATTRIBUTE) === messageId) {
        continue;
      }

      element.setAttribute(MARK_ATTRIBUTE, messageId);
      found.push({ element, messageId, direction: this.readDirection(element) });
    }

    return found;
  }

  private isVoiceBubble(element: HTMLElement): boolean {
    return this.selectors.voiceSignals.some((selector) => element.querySelector(selector) !== null);
  }

  private readDirection(element: HTMLElement): MessageDirection {
    return element.querySelector(this.selectors.outgoingMarker) ? 'outgoing' : 'incoming';
  }
}

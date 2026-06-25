import type { TranscriptData } from '@/domain/transcript';
import { INJECTED_UI_CLASS, TranscribeButton } from '@/dom/transcribe-button';
import type { AudioBubble } from '@/dom/whatsapp-bubble-scanner';
import { WhatsAppBubbleScanner } from '@/dom/whatsapp-bubble-scanner';
import { WHATSAPP_SELECTORS } from '@/dom/whatsapp-selectors';
import { AudioExtractionService } from '@/services/audio-extraction/audio-extraction-service';
import type { TranscribeRequest, TranscribeResponse } from '@/services/messaging/messages';
import { TranscriptCacheService } from '@/services/transcript-cache/transcript-cache-service';

/**
 * Runs in WhatsApp Web's isolated world. Watches the (virtualized) message list,
 * detects voice bubbles, and injects a "Transcribe" control next to each. On
 * click it asks the audio-extraction service for the decrypted bytes (via the
 * MAIN-world bridge), routes them through the background → offscreen pipeline,
 * and renders the returned transcript back into the bubble. The extraction leans
 * on WhatsApp's obfuscated internal modules, so it is inherently fragile across
 * WhatsApp updates.
 */
class WhatsAppContentScript {
  private readonly scanner = new WhatsAppBubbleScanner();
  private readonly extraction = new AudioExtractionService();
  private readonly cache = new TranscriptCacheService();
  private observer: MutationObserver | null = null;
  private scanScheduled = false;

  constructor() {
    this.handleMutations = this.handleMutations.bind(this);
    this.runScan = this.runScan.bind(this);
    this.transcribe = this.transcribe.bind(this);
  }

  start(): void {
    this.scanNow();
    this.observer = new MutationObserver(this.handleMutations);
    this.observer.observe(document.body, { childList: true, subtree: true });
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
  }

  private handleMutations(): void {
    if (this.scanScheduled) {
      return;
    }
    this.scanScheduled = true;
    requestAnimationFrame(this.runScan);
  }

  private runScan(): void {
    this.scanScheduled = false;
    this.scanNow();
  }

  private scanNow(): void {
    for (const bubble of this.scanner.scan(document)) {
      void this.injectInto(bubble);
    }
  }

  /**
   * Reads any cached transcript first so a bubble re-rendered by WhatsApp (e.g.
   * after switching chats) comes back showing its text instead of a blank
   * button. The cache read precedes the DOM mutation, so the remove-and-mount
   * stays atomic.
   */
  private async injectInto(bubble: AudioBubble): Promise<void> {
    const cached = await this.cache.get(bubble.messageId);
    bubble.element.querySelectorAll(`.${INJECTED_UI_CLASS}`).forEach((node) => node.remove());
    new TranscribeButton(bubble, this.transcribe, cached?.text).mount(this.resolveAnchor(bubble));
  }

  private resolveAnchor(bubble: AudioBubble): HTMLElement {
    const widget = this.findAudioWidget(bubble.element);
    if (widget) {
      return widget;
    }

    for (const selector of WHATSAPP_SELECTORS.bubbleAnchors) {
      const anchor = bubble.element.querySelector<HTMLElement>(selector);
      if (anchor) {
        return anchor;
      }
    }
    return bubble.element;
  }

  /**
   * Returns the audio-widget block that visually sits on top of the colored
   * balloon: walk up from the waveform and stop at the last transparent ancestor
   * before the first one that paints a background. Injecting there keeps the
   * caption on the bubble's background at the bubble's (narrow) width, without
   * depending on WhatsApp's rotating class hashes or hitting the full-width
   * `msg-container` wrapper (whose background-painting child would stretch us).
   */
  private findAudioWidget(root: HTMLElement): HTMLElement | null {
    const probe = root.querySelector<HTMLElement>(
      '[role="slider"], [data-icon="ptt-status"], [aria-label="Voice message"]',
    );

    let element: HTMLElement | null = probe;
    let previous: HTMLElement | null = probe;
    while (element && element !== root) {
      const background = getComputedStyle(element).backgroundColor;
      if (background && !background.startsWith('rgba(0, 0, 0, 0') && background !== 'transparent') {
        return previous;
      }
      previous = element;
      element = element.parentElement;
    }
    return null;
  }

  private async transcribe(bubble: AudioBubble): Promise<TranscriptData> {
    const audio = await this.extraction.extract(bubble.messageId);
    const request: TranscribeRequest = {
      kind: 'transcribe-request',
      target: 'background',
      requestId: crypto.randomUUID(),
      audio: { ...audio, sourceId: bubble.messageId },
    };

    const response = (await browser.runtime.sendMessage(request)) as TranscribeResponse;
    if (response.kind === 'transcribe-failure') {
      throw new Error(response.message);
    }

    void this.cache.set(bubble.messageId, response.transcript);
    return response.transcript;
  }
}

export default defineContentScript({
  matches: ['*://web.whatsapp.com/*'],
  world: 'ISOLATED',
  main(ctx) {
    const script = new WhatsAppContentScript();
    script.start();
    ctx.onInvalidated(() => script.stop());
  },
});

// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { WhatsAppBubbleScanner } from '@/dom/whatsapp-bubble-scanner';
import { INCOMING_VOICE, OUTGOING_VOICE, TEXT_MESSAGE } from '../../fixtures/whatsapp-bubbles';

function render(...fragments: string[]): void {
  document.body.innerHTML = fragments.join('\n');
}

describe('WhatsAppBubbleScanner', () => {
  let scanner: WhatsAppBubbleScanner;

  beforeEach(() => {
    scanner = new WhatsAppBubbleScanner();
    document.body.innerHTML = '';
  });

  it('detects an incoming voice bubble and reads its id', () => {
    render(INCOMING_VOICE);

    const bubbles = scanner.scan(document);

    expect(bubbles).toHaveLength(1);
    expect(bubbles[0]?.messageId).toBe('ACDD1C9AABBF0BC8B356255C0A118FE2');
    expect(bubbles[0]?.direction).toBe('incoming');
  });

  it('reads the outgoing direction from the message-out marker', () => {
    render(OUTGOING_VOICE);

    expect(scanner.scan(document)[0]?.direction).toBe('outgoing');
  });

  it('ignores non-audio (text) messages', () => {
    render(TEXT_MESSAGE);

    expect(scanner.scan(document)).toHaveLength(0);
  });

  it('does not return the same bubble twice', () => {
    render(INCOMING_VOICE);

    scanner.scan(document);

    expect(scanner.scan(document)).toHaveLength(0);
  });

  it('reprocesses a recycled node whose data-id changed', () => {
    render(INCOMING_VOICE);
    scanner.scan(document);

    const element = document.querySelector<HTMLElement>('[data-id]');
    element?.setAttribute('data-id', 'RECYCLED000000000000000000000001');

    const bubbles = scanner.scan(document);
    expect(bubbles).toHaveLength(1);
    expect(bubbles[0]?.messageId).toBe('RECYCLED000000000000000000000001');
  });
});

// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { INJECTED_UI_CLASS, TranscribeButton } from '@/dom/transcribe-button';
import type { TranscribeHandler } from '@/dom/transcribe-button';
import type { AudioBubble } from '@/dom/whatsapp-bubble-scanner';

function mountButton(handler: TranscribeHandler) {
  const host = document.createElement('div');
  const bubble: AudioBubble = { element: host, messageId: 'X', direction: 'incoming' };
  new TranscribeButton(bubble, handler).mount(host);
  const root = host.querySelector(`.${INJECTED_UI_CLASS}`) as HTMLElement;
  return {
    button: root.querySelector('button') as HTMLButtonElement,
    output: root.querySelector('div') as HTMLDivElement,
  };
}

const transcript = {
  text: 'olá mundo',
  language: 'portuguese',
  modelId: 'm',
  device: 'webgpu',
  durationMs: 1,
};

describe('TranscribeButton', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders the transcript text on success', async () => {
    const { button, output } = mountButton(vi.fn().mockResolvedValue(transcript));

    button.click();

    await vi.waitFor(() => expect(output.textContent).toBe('olá mundo'));
    expect(button.disabled).toBe(false);
  });

  it('shows the error message on failure', async () => {
    const { button, output } = mountButton(vi.fn().mockRejectedValue(new Error('Fase 3 pendente')));

    button.click();

    await vi.waitFor(() => expect(output.textContent).toContain('Fase 3 pendente'));
  });

  it('ignores clicks while a transcription is in flight', async () => {
    const handler = vi.fn().mockResolvedValue(transcript);
    const { button } = mountButton(handler);

    button.click();
    button.click();

    await vi.waitFor(() => expect(button.disabled).toBe(false));
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

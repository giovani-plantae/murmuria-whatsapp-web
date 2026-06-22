import { arrayBufferToBase64 } from '@/services/audio/base64';
import type { TranscribeRequest, TranscribeResponse } from '@/services/messaging/messages';
import { describeError } from '@/shared/errors';

/**
 * Pilot-only test surface: lets a developer pick any audio file and run it
 * through the full offscreen + worker transcription pipeline, with no WhatsApp
 * involved yet. Validates the "solid" half of the architecture in isolation.
 */
class PopupController {
  private readonly fileInput: HTMLInputElement;
  private readonly transcribeButton: HTMLButtonElement;
  private readonly statusElement: HTMLElement;
  private readonly transcriptElement: HTMLElement;

  constructor(document: Document) {
    this.fileInput = requireElement<HTMLInputElement>(document, '#audio-file');
    this.transcribeButton = requireElement<HTMLButtonElement>(document, '#transcribe-button');
    this.statusElement = requireElement<HTMLElement>(document, '#status');
    this.transcriptElement = requireElement<HTMLElement>(document, '#transcript');
    this.handleTranscribeClick = this.handleTranscribeClick.bind(this);
  }

  start(): void {
    this.transcribeButton.addEventListener('click', this.handleTranscribeClick);
  }

  private async handleTranscribeClick(): Promise<void> {
    const file = this.fileInput.files?.[0];
    if (!file) {
      this.setStatus('Select an audio file first.');
      return;
    }

    this.setBusy(true);
    this.transcriptElement.textContent = '';
    this.setStatus('Transcribing…');

    try {
      const response = await this.sendTranscribeRequest(file);
      this.render(response);
    } catch (error) {
      this.setStatus(`Failed: ${describeError(error)}`);
    } finally {
      this.setBusy(false);
    }
  }

  private async sendTranscribeRequest(file: File): Promise<TranscribeResponse> {
    const base64 = arrayBufferToBase64(await file.arrayBuffer());
    const request: TranscribeRequest = {
      kind: 'transcribe-request',
      target: 'background',
      requestId: crypto.randomUUID(),
      audio: { base64, mimeType: file.type || 'audio/ogg', sourceId: file.name },
    };

    return browser.runtime.sendMessage(request) as Promise<TranscribeResponse>;
  }

  private render(response: TranscribeResponse): void {
    if (response.kind === 'transcribe-failure') {
      this.setStatus(`Failed: ${response.message}`);
      return;
    }

    const { transcript } = response;
    const seconds = (transcript.durationMs / 1000).toFixed(1);
    this.setStatus(`Done in ${seconds}s · ${transcript.modelId}`);
    this.transcriptElement.textContent = transcript.text || '(no speech detected)';
  }

  private setStatus(message: string): void {
    this.statusElement.textContent = message;
  }

  private setBusy(busy: boolean): void {
    this.transcribeButton.disabled = busy;
  }
}

function requireElement<T extends Element>(document: Document, selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Popup is missing required element: ${selector}`);
  }
  return element;
}

new PopupController(document).start();

import type { TranscriptData } from '@/core/domain/transcript';
import { describeError } from '@/core/errors';
import type { AudioBubble } from './whatsapp-bubble-scanner';

export const INJECTED_UI_CLASS = 'wa2t-ui';

export type TranscribeHandler = (bubble: AudioBubble) => Promise<TranscriptData>;

const WHATSAPP_GREEN = '#00a884';

/**
 * The injected "Transcribe" control plus its result, styled to blend into the
 * WhatsApp balloon: it inherits the bubble's text color (so it works in light and
 * dark themes) and sits under a subtle divider. The transcript renders below the
 * button, and the button stays available so a fresh transcription can be forced
 * on demand. When a `cachedText` is supplied (a transcript restored from a
 * previous run), the control mounts already showing that text.
 */
export class TranscribeButton {
    private readonly bubble: AudioBubble;
    private readonly onTranscribe: TranscribeHandler;
    private readonly root: HTMLDivElement;
    private readonly button: HTMLButtonElement;
    private readonly output: HTMLDivElement;
    private busy = false;

    constructor(bubble: AudioBubble, onTranscribe: TranscribeHandler, cachedText?: string) {
        this.bubble = bubble;
        this.onTranscribe = onTranscribe;
        this.handleClick = this.handleClick.bind(this);

        // Fill the audio widget's width (it's a fixed, narrow block sitting on the
        // balloon), so the caption wraps at the bubble width instead of the pane.
        this.root = document.createElement('div');
        this.root.className = INJECTED_UI_CLASS;
        this.root.style.cssText =
            'width:100%;flex:1 0 100%;box-sizing:border-box;margin-top:5px;padding-top:5px;' +
      'border-top:1px solid rgba(134,150,160,.18);display:flex;flex-direction:column;gap:5px;';

        this.button = document.createElement('button');
        this.button.type = 'button';
        this.button.textContent = 'Transcribe';
        this.button.style.cssText =
            `align-self:flex-start;padding:3px 11px;border:none;border-radius:14px;background:${WHATSAPP_GREEN};` +
      'color:#fff;font-size:12px;font-weight:500;font-family:inherit;cursor:pointer;';
        this.button.addEventListener('click', this.handleClick);

        // Inherits the balloon's text color; slightly muted so it reads as a caption.
        // WhatsApp marks bubbles unselectable, so force selection back on (with
        // !important to beat any inherited rule) — the transcript must be copyable.
        this.output = document.createElement('div');
        this.output.style.cssText =
            'font-size:13.5px;line-height:1.4;color:inherit;opacity:.92;cursor:text;' +
      'user-select:text !important;-webkit-user-select:text !important;';

        this.root.append(this.button, this.output);

        if (cachedText !== undefined) {
            this.renderTranscript(cachedText);
        }
    }

    mount(parent: HTMLElement): void {
        parent.appendChild(this.root);
    }

    private async handleClick(): Promise<void> {
        if (this.busy) {
            return;
        }

        this.setBusy(true);
        this.button.textContent = 'Transcribing…';
        this.output.textContent = '';

        try {
            const transcript = await this.onTranscribe(this.bubble);
            this.renderTranscript(transcript.text);
        } catch (error) {
            this.button.textContent = 'Transcribe';
            this.output.textContent = `⚠ ${describeError(error)}`;
        } finally {
            this.setBusy(false);
        }
    }

    private renderTranscript(text: string): void {
    // Keep the button visible so a new transcription can be forced; relabel it so
    // it reads as a re-run rather than a first pass.
        this.button.textContent = 'Transcribe again';
        this.output.textContent = this.flatten(text) || '(no speech detected)';
    }

    private flatten(text: string): string {
        return text
            .replace(/\s*\n\s*/g, ' ')
            .replace(/[ \t]+/g, ' ')
            .trim();
    }

    private setBusy(busy: boolean): void {
        this.busy = busy;
        this.button.disabled = busy;
        this.button.style.opacity = busy ? '0.6' : '1';
    }
}

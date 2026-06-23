import './popup.css';
import { arrayBufferToBase64 } from '@/services/audio/base64';
import { describeError } from '@/shared/errors';
import { RecorderService } from '@/services/recording/recorder-service';
import type { RecorderState } from '@/services/recording/recorder-service';
import {
  HostSettingsService,
  hostPermissionPattern,
  normalizeHost,
} from '@/services/transcription/host-settings';
import type {
  CheckHostRequest,
  CheckHostResult,
  SerializedAudioClip,
  TranscribeRequest,
  TranscribeResponse,
} from '@/services/messaging/messages';
import type { TranscriptData } from '@/domain/transcript';

interface Language {
  readonly value: string;
  readonly label: string;
}

const LANGUAGES: readonly Language[] = [
  { value: 'portuguese', label: 'Portuguese' },
  { value: 'english', label: 'English' },
  { value: 'auto', label: 'Auto-detect' },
];

const DEFAULT_LANGUAGE = 'portuguese';
const LANGUAGE_KEY = 'murmuria.language';

/**
 * Drives the popup: pick or drag a file, record from the mic, choose the
 * transcription language, and configure/test the murmuria server — all on the
 * existing popup → background → offscreen pipeline.
 */
class PopupController {
  private readonly hostSettings = new HostSettingsService();
  private readonly recorder: RecorderService;
  private language = DEFAULT_LANGUAGE;
  private timer: ReturnType<typeof setInterval> | null = null;
  private recordingStartedAt = 0;
  private busy = false;

  private readonly drop = el<HTMLElement>('drop');
  private readonly fileInput = el<HTMLInputElement>('file');
  private readonly chooseButton = el<HTMLButtonElement>('choose');
  private readonly langRoot = el<HTMLElement>('lang');
  private readonly recordButton = el<HTMLButtonElement>('record');
  private readonly recordLabel = el<HTMLElement>('record-label');
  private readonly result = el<HTMLElement>('result');
  private readonly server = el<HTMLElement>('server');
  private readonly conn = el<HTMLButtonElement>('conn');
  private readonly connDot = el<HTMLElement>('conn-dot');
  private readonly connLabel = el<HTMLElement>('conn-label');

  constructor() {
    this.recorder = new RecorderService({ onStateChange: (state) => this.onRecorderState(state) });
    this.openPicker = this.openPicker.bind(this);
    this.pickFile = this.pickFile.bind(this);
    this.onFileChange = this.onFileChange.bind(this);
    this.onDragOver = this.onDragOver.bind(this);
    this.onDragLeave = this.onDragLeave.bind(this);
    this.onDrop = this.onDrop.bind(this);
    this.toggleLang = this.toggleLang.bind(this);
    this.onTriggerKey = this.onTriggerKey.bind(this);
    this.onListKey = this.onListKey.bind(this);
    this.onOptionClick = this.onOptionClick.bind(this);
    this.onDocClick = this.onDocClick.bind(this);
    this.onRecordClick = this.onRecordClick.bind(this);
    this.toggleServer = this.toggleServer.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
    this.tick = this.tick.bind(this);
  }

  async start(): Promise<void> {
    this.language = await this.readLanguage();
    this.buildLanguageSelect();
    this.buildServerPanel();
    this.renderIdle();

    this.drop.addEventListener('click', this.openPicker);
    this.drop.addEventListener('keydown', this.onKeyDown);
    this.drop.addEventListener('dragover', this.onDragOver);
    this.drop.addEventListener('dragleave', this.onDragLeave);
    this.drop.addEventListener('drop', this.onDrop);
    this.fileInput.addEventListener('change', this.onFileChange);
    this.chooseButton.addEventListener('click', this.pickFile);
    this.recordButton.addEventListener('click', this.onRecordClick);
    this.conn.addEventListener('click', this.toggleServer);
    document.addEventListener('click', this.onDocClick);

    if (!RecorderService.isSupported()) {
      this.recordButton.disabled = true;
      this.recordButton.title = 'Recording is not supported in this browser.';
    }

    void this.checkConnection();
  }

  // ---- input: file + drag-and-drop ----

  private pickFile(): void {
    this.fileInput.click();
  }

  private openPicker(event: Event): void {
    // The action controls live inside the drop zone; a click on any of them must
    // not bubble up and also open the file picker.
    if (this.isInteractive(event.target)) {
      return;
    }
    this.fileInput.click();
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (event.target === this.drop && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      this.fileInput.click();
    }
  }

  private onFileChange(): void {
    const file = this.fileInput.files?.[0];
    if (file) {
      void this.transcribeFile(file);
    }
    this.fileInput.value = '';
  }

  private onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.drop.classList.add('is-drag');
  }

  private onDragLeave(): void {
    this.drop.classList.remove('is-drag');
  }

  private onDrop(event: DragEvent): void {
    event.preventDefault();
    this.drop.classList.remove('is-drag');
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      void this.transcribeFile(file);
    }
  }

  private async transcribeFile(file: File): Promise<void> {
    if (this.busy) {
      return;
    }
    // Picking a file supersedes an in-progress recording; drop it and free the mic.
    if (this.recorder.isRecording) {
      this.recorder.cancel();
    }
    const base64 = arrayBufferToBase64(await file.arrayBuffer());
    await this.sendTranscribe({ base64, mimeType: file.type || 'audio/ogg', sourceId: file.name });
  }

  // ---- language: a custom listbox (native <select> can't be themed for dark) ----

  private buildLanguageSelect(): void {
    const current = LANGUAGES.find((language) => language.value === this.language);
    this.langRoot.innerHTML =
      `<button class="combo__trigger" id="lang-trigger" type="button" aria-haspopup="listbox" ` +
      `aria-expanded="false" aria-labelledby="lang-label lang-current">` +
      `<span id="lang-current">${current?.label ?? ''}</span>` +
      `<span class="combo__chevron" aria-hidden="true">▾</span></button>` +
      `<ul class="combo__list" id="lang-list" role="listbox" tabindex="-1" aria-label="Transcription language" hidden>` +
      LANGUAGES.map(
        (language) =>
          `<li class="combo__option" id="lang-opt-${language.value}" role="option" ` +
          `data-value="${language.value}" tabindex="-1" aria-selected="${String(language.value === this.language)}">` +
          `${language.label}</li>`,
      ).join('') +
      `</ul>`;
    const trigger = el<HTMLButtonElement>('lang-trigger');
    trigger.addEventListener('click', this.toggleLang);
    trigger.addEventListener('keydown', this.onTriggerKey);
    const list = el<HTMLElement>('lang-list');
    list.addEventListener('click', this.onOptionClick);
    list.addEventListener('keydown', this.onListKey);
  }

  private setLangOpen(open: boolean): void {
    el<HTMLElement>('lang-list').hidden = !open;
    el<HTMLButtonElement>('lang-trigger').setAttribute('aria-expanded', String(open));
    if (open) {
      this.focusOption(this.selectedOption() ?? this.langOptions()[0]);
    }
  }

  private toggleLang(): void {
    this.setLangOpen(el<HTMLElement>('lang-list').hidden);
  }

  private onTriggerKey(event: KeyboardEvent): void {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault();
      this.setLangOpen(true);
    }
  }

  private onListKey(event: KeyboardEvent): void {
    const options = this.langOptions();
    const index = options.indexOf(document.activeElement as HTMLElement);
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.focusOption(options[Math.min(index + 1, options.length - 1)]);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.focusOption(options[Math.max(index - 1, 0)]);
        break;
      case 'Home':
        event.preventDefault();
        this.focusOption(options[0]);
        break;
      case 'End':
        event.preventDefault();
        this.focusOption(options[options.length - 1]);
        break;
      case 'Enter':
      case ' ': {
        event.preventDefault();
        const value = (document.activeElement as HTMLElement | null)?.dataset.value;
        if (value) {
          this.selectLanguage(value);
        }
        break;
      }
      case 'Escape':
      case 'Tab':
        this.closeLang();
        break;
    }
  }

  private onOptionClick(event: MouseEvent): void {
    const value = (event.target as Element | null)?.closest<HTMLElement>('.combo__option')?.dataset
      .value;
    if (value) {
      this.selectLanguage(value);
    }
  }

  private onDocClick(event: MouseEvent): void {
    if (!el<HTMLElement>('lang-list').hidden && !this.langRoot.contains(event.target as Node)) {
      this.setLangOpen(false);
    }
  }

  private selectLanguage(value: string): void {
    this.language = value || DEFAULT_LANGUAGE;
    el<HTMLElement>('lang-current').textContent =
      LANGUAGES.find((language) => language.value === this.language)?.label ?? '';
    this.langOptions().forEach((option) =>
      option.setAttribute('aria-selected', String(option.dataset.value === this.language)),
    );
    void browser.storage?.local?.set({ [LANGUAGE_KEY]: this.language });
    this.closeLang();
  }

  private closeLang(): void {
    this.setLangOpen(false);
    el<HTMLButtonElement>('lang-trigger').focus();
  }

  private langOptions(): HTMLElement[] {
    return Array.from(el<HTMLElement>('lang-list').querySelectorAll<HTMLElement>('.combo__option'));
  }

  private selectedOption(): HTMLElement | undefined {
    return this.langOptions().find((option) => option.dataset.value === this.language);
  }

  private focusOption(option: HTMLElement | undefined): void {
    option?.focus();
  }

  private async readLanguage(): Promise<string> {
    const stored = await browser.storage?.local?.get(LANGUAGE_KEY);
    const value = stored?.[LANGUAGE_KEY];
    return LANGUAGES.some((language) => language.value === value)
      ? (value as string)
      : DEFAULT_LANGUAGE;
  }

  // ---- recording ----

  private async onRecordClick(): Promise<void> {
    if (this.recorder.isRecording) {
      const blob = await this.recorder.stop();
      await this.sendTranscribe({
        base64: arrayBufferToBase64(await blob.arrayBuffer()),
        mimeType: blob.type || 'audio/webm',
        sourceId: 'mic recording',
      });
      return;
    }
    if (this.busy) {
      return;
    }
    // A browser-action popup cannot surface the getUserMedia prompt — it loses
    // focus and the request is denied. So only start recording once the mic is
    // already granted; otherwise route the one-time grant to the options page.
    if ((await this.micPermissionState()) !== 'granted') {
      this.renderMicSetup();
      return;
    }
    try {
      await this.recorder.start();
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        this.renderMicSetup();
        return;
      }
      this.renderError(micError(error));
    }
  }

  private async micPermissionState(): Promise<string> {
    try {
      const status = await navigator.permissions?.query({ name: 'microphone' as PermissionName });
      return status?.state ?? 'unknown';
    } catch {
      return 'unknown';
    }
  }

  private onRecorderState(state: RecorderState): void {
    const recording = state === 'recording';
    this.recordButton.classList.toggle('is-rec', recording);
    this.recordButton.setAttribute('aria-pressed', String(recording));
    this.recordButton.setAttribute(
      'aria-label',
      recording ? 'Stop recording and transcribe' : 'Record from the microphone',
    );
    if (recording) {
      this.recordingStartedAt = Date.now();
      this.stopTimer();
      this.timer = setInterval(this.tick, 250);
      this.tick();
    } else {
      this.stopTimer();
      this.recordLabel.textContent = 'Record';
    }
  }

  private tick(): void {
    const seconds = Math.floor((Date.now() - this.recordingStartedAt) / 1000);
    this.recordLabel.textContent = `Stop · ${formatClock(seconds)}`;
  }

  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  // ---- transcription request ----

  private async sendTranscribe(clip: SerializedAudioClip): Promise<void> {
    this.busy = true;
    this.renderBusy(clip.sourceId ?? 'audio');
    const request: TranscribeRequest = {
      kind: 'transcribe-request',
      target: 'background',
      requestId: crypto.randomUUID(),
      audio: clip,
      language: this.language,
    };
    try {
      const response = (await browser.runtime.sendMessage(request)) as TranscribeResponse;
      if (response.kind === 'transcribe-failure') {
        this.renderError(response.message);
        return;
      }
      this.renderSuccess(response.transcript);
    } catch (error) {
      this.renderError(describeError(error));
    } finally {
      this.busy = false;
    }
  }

  // ---- server panel ----

  private buildServerPanel(): void {
    this.server.innerHTML = `
      <p class="server__title">Server</p>
      <fieldset class="seg">
        <legend class="visually-hidden">Discovery mode</legend>
        <label class="seg__opt"><input type="radio" name="discovery-mode" value="auto" checked /><span>Auto-discover</span></label>
        <label class="seg__opt"><input type="radio" name="discovery-mode" value="manual" /><span>Manual</span></label>
      </fieldset>
      <div class="manual" id="manual" hidden>
        <div class="field">
          <input class="input" id="host-input" type="text" inputmode="url" spellcheck="false"
            placeholder="http://192.168.1.50:8771" aria-label="Server address" />
          <button class="btn btn--ghost" id="host-test" type="button">Test</button>
        </div>
        <p class="test-result" id="test-result" role="status" aria-live="polite"></p>
      </div>`;
    this.server
      .querySelectorAll<HTMLInputElement>('input[name="discovery-mode"]')
      .forEach((radio) => radio.addEventListener('change', () => void this.setMode(radio.value)));
    el<HTMLButtonElement>('host-test').addEventListener('click', () => void this.testHost());
    void this.prefillServerPanel();
  }

  private async prefillServerPanel(): Promise<void> {
    const settings = await this.hostSettings.read();
    if (settings.manualHost) {
      el<HTMLInputElement>('host-input').value = settings.manualHost;
    }
    this.reflectMode(settings.mode);
  }

  private reflectMode(mode: string): void {
    this.server
      .querySelectorAll<HTMLInputElement>('input[name="discovery-mode"]')
      .forEach((radio) => {
        radio.checked = radio.value === mode;
      });
    el<HTMLElement>('manual').hidden = mode !== 'manual';
  }

  private async setMode(mode: string): Promise<void> {
    this.reflectMode(mode);
    if (mode === 'auto') {
      const previous = await this.hostSettings.read();
      await this.revokeHost(previous.manualHost);
      await this.hostSettings.useAutoDiscovery();
      void this.checkConnection();
    } else {
      // The chip was reporting the auto-discovered server; it no longer applies.
      this.renderChip('checking', 'Manual — test to connect');
    }
  }

  private async testHost(): Promise<void> {
    const input = el<HTMLInputElement>('host-input');
    let host: string;
    try {
      host = normalizeHost(input.value);
    } catch (error) {
      this.renderTest('bad', describeError(error));
      return;
    }

    this.renderTest('checking', 'Requesting access…');
    const granted = await browser.permissions.request({ origins: [hostPermissionPattern(host)] });
    if (!granted) {
      this.renderTest('bad', 'Permission to reach this host was denied.');
      return;
    }

    this.renderTest('checking', 'Testing…');
    const result = await this.checkHost(host);
    if (result.ok) {
      const previous = (await this.hostSettings.read()).manualHost;
      await this.hostSettings.useManualHost(host);
      input.value = host;
      if (previous && previous !== host) {
        await this.revokeHost(previous);
      }
      this.renderTest(
        'ok',
        `Connected · ${result.service ?? 'murmuria'} · ${result.latencyMs ?? '?'} ms`,
      );
      void this.checkConnection();
    } else {
      this.renderTest('bad', result.message ?? 'Could not reach this server.');
    }
  }

  private async revokeHost(host: string | null): Promise<void> {
    if (!host) {
      return;
    }
    try {
      await browser.permissions.remove({ origins: [hostPermissionPattern(host)] });
    } catch {
      // Best-effort least-privilege cleanup; a failure here is not user-facing.
    }
  }

  private renderTest(state: 'checking' | 'ok' | 'bad', message: string): void {
    const node = el<HTMLElement>('test-result');
    node.dataset.state = state;
    node.textContent = message;
  }

  // ---- connection chip ----

  private toggleServer(): void {
    const open = this.server.hidden;
    this.server.hidden = !open;
    this.conn.setAttribute('aria-expanded', String(open));
  }

  private async checkConnection(): Promise<void> {
    this.renderChip('checking', 'Checking…');
    const settings = await this.hostSettings.read();
    const url = settings.mode === 'manual' ? (settings.manualHost ?? undefined) : undefined;
    const result = await this.checkHost(url);
    if (result.ok) {
      this.renderChip('online', `${stripScheme(result.host)} · ${result.latencyMs ?? '?'} ms`);
    } else {
      this.renderChip('offline', 'Offline');
    }
  }

  private async checkHost(url?: string): Promise<CheckHostResult> {
    const request: CheckHostRequest = {
      kind: 'check-host',
      target: 'background',
      requestId: crypto.randomUUID(),
      url,
    };
    try {
      const response = (await browser.runtime.sendMessage(request)) as CheckHostResult | undefined;
      if (!response || typeof response.ok !== 'boolean') {
        return { kind: 'check-host-result', requestId: request.requestId, ok: false };
      }
      return response;
    } catch (error) {
      return {
        kind: 'check-host-result',
        requestId: request.requestId,
        ok: false,
        message: describeError(error),
      };
    }
  }

  private renderChip(state: 'checking' | 'online' | 'offline', label: string): void {
    this.connDot.dataset.state = state;
    this.connLabel.textContent = label;
  }

  // ---- result states ----

  private renderIdle(): void {
    this.result.innerHTML =
      '<div class="result__panel"><p class="result__hint">Pick a file or record to get a transcript.</p></div>';
  }

  private renderBusy(source: string): void {
    this.result.innerHTML =
      `<div class="result__panel"><div class="busy"><span class="spinner"></span>` +
      `<span>Transcribing ${escapeHtml(source)}…</span></div></div>`;
  }

  private renderSuccess(transcript: TranscriptData): void {
    const seconds = (transcript.durationMs / 1000).toFixed(1);
    const text = transcript.text || '(no speech detected)';
    this.result.innerHTML =
      `<div class="result__panel"><div class="result__head">` +
      `<span class="result__meta">${seconds} s · ${escapeHtml(transcript.language)}</span>` +
      `<button class="copy" id="copy" type="button">Copy</button></div>` +
      `<p class="transcript">${escapeHtml(text)}</p></div>`;
    const copy = el<HTMLButtonElement>('copy');
    copy.addEventListener('click', () => void this.copyTranscript(copy, transcript.text));
  }

  private async copyTranscript(button: HTMLButtonElement, text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = 'Copied';
    } catch {
      button.textContent = 'Copy failed';
    }
    setTimeout(() => (button.textContent = 'Copy'), 1200);
  }

  private renderError(message: string): void {
    this.result.innerHTML =
      `<div class="result__panel"><div class="alert"><span class="alert__icon" aria-hidden="true">⚠</span>` +
      `<span>${escapeHtml(message)}</span></div></div>`;
  }

  private renderMicSetup(): void {
    this.result.innerHTML =
      `<div class="result__panel"><div class="alert"><span class="alert__icon" aria-hidden="true">⚠</span>` +
      `<span>Recording needs microphone access, which Chrome can only grant on a full page — ` +
      `not this popup. Enable it once and recording will work here.</span></div>` +
      `<button class="btn btn--primary result__cta" id="enable-mic" type="button">Enable microphone</button></div>`;
    el<HTMLButtonElement>('enable-mic').addEventListener('click', () => {
      void browser.runtime.openOptionsPage();
    });
  }

  // ---- misc ----

  private isInteractive(target: EventTarget | null): boolean {
    return (
      target instanceof Element && !!target.closest('.actions, .langbar') && target !== this.drop
    );
  }
}

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) {
    throw new Error(`Popup is missing required element: #${id}`);
  }
  return node as T;
}

function micError(error: unknown): string {
  if (error instanceof DOMException && error.name === 'NotFoundError') {
    return 'No microphone was found.';
  }
  return describeError(error);
}

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function stripScheme(url: string | undefined): string {
  return url ? url.replace(/^https?:\/\//, '') : 'server';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

void new PopupController().start();

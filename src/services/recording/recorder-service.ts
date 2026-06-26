export type RecorderState = 'idle' | 'recording';

export interface RecorderServiceConfig {
    /** Called whenever recording starts or stops, so the UI can reflect the state. */
    readonly onStateChange?: (state: RecorderState) => void;
}

/**
 * Captures microphone audio with `MediaRecorder`, kept behind a service so the
 * popup never touches the media APIs directly. Two-phase by nature: `start()`
 * acquires the mic and begins recording; `stop()` resolves with the recorded
 * audio as a Blob and releases the mic track. The produced blob (webm/opus in
 * Chrome) decodes through the same offscreen `AudioDecoder` as any other clip.
 */
export class RecorderService {
    private readonly onStateChange?: (state: RecorderState) => void;
    private recorder: MediaRecorder | null = null;
    private stream: MediaStream | null = null;
    private chunks: Blob[] = [];
    private stopResolver: ((blob: Blob) => void) | null = null;
    private starting = false;

    constructor(config: RecorderServiceConfig = {}) {
        this.onStateChange = config.onStateChange;
        this.collect = this.collect.bind(this);
        this.finalize = this.finalize.bind(this);
    }

    get isRecording(): boolean {
        return this.recorder?.state === 'recording';
    }

    /** Whether the browser exposes the APIs needed to record at all. */
    static isSupported(): boolean {
        return (
            typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof MediaRecorder !== 'undefined'
        );
    }

    async start(): Promise<void> {
    // Guard the whole in-flight window, not just an assigned recorder: a second
    // click before the awaited getUserMedia resolves would otherwise open a
    // second mic stream and leak the first (stuck mic LED).
        if (this.recorder || this.starting) {
            return;
        }
        this.starting = true;
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.chunks = [];
            this.recorder = new MediaRecorder(this.stream);
            this.recorder.addEventListener('dataavailable', this.collect);
            this.recorder.addEventListener('stop', this.finalize);
            this.recorder.start();
            this.onStateChange?.('recording');
        } finally {
            this.starting = false;
        }
    }

    stop(): Promise<Blob> {
        const recorder = this.recorder;
        if (!recorder) {
            return Promise.reject(new Error('Not recording.'));
        }
        return new Promise<Blob>((resolve) => {
            this.stopResolver = resolve;
            recorder.stop();
        });
    }

    /** Aborts an in-progress recording and releases the mic without producing a blob. */
    cancel(): void {
        if (!this.recorder) {
            return;
        }
        this.stopResolver = null;
        this.release();
        this.onStateChange?.('idle');
    }

    private collect(event: BlobEvent): void {
        if (event.data.size > 0) {
            this.chunks.push(event.data);
        }
    }

    private finalize(): void {
        const type = this.recorder?.mimeType || 'audio/webm';
        const blob = new Blob(this.chunks, { type });
        const resolve = this.stopResolver;
        this.stopResolver = null;
        this.release();
        this.onStateChange?.('idle');
        resolve?.(blob);
    }

    private release(): void {
        this.stream?.getTracks().forEach((track) => track.stop());
        this.stream = null;
        this.recorder = null;
        this.chunks = [];
    }
}

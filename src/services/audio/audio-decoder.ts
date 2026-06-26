export interface AudioDecoderConfig {
    /** Sample rate the murmuria server expects. */
    readonly targetSampleRate: number;
}

const DEFAULT_CONFIG: AudioDecoderConfig = { targetSampleRate: 16000 };

/**
 * Port consumed by the coordinator, so it can be faked in tests without the Web
 * Audio API.
 */
export interface PcmDecoder {
    decodeToMonoPcm(bytes: ArrayBuffer): Promise<Float32Array>;
}

/**
 * Turns encoded audio bytes (Opus/OGG from WhatsApp, or any browser-decodable
 * format in the pilot) into the mono Float32 PCM at 16 kHz that the murmuria server expects.
 * Relies on the Web Audio API, so it must run in a context that has a DOM — the
 * offscreen document.
 */
export class AudioDecoder implements PcmDecoder {
    private readonly targetSampleRate: number;

    constructor(config: AudioDecoderConfig = DEFAULT_CONFIG) {
        this.targetSampleRate = config.targetSampleRate;
    }

    /**
   * Decodes the given bytes and returns a single channel of PCM resampled to the
   * target sample rate. A copy of the buffer is decoded because `decodeAudioData`
   * detaches (neutralizes) the ArrayBuffer it receives.
   */
    async decodeToMonoPcm(bytes: ArrayBuffer): Promise<Float32Array> {
        const decoded = await this.decode(bytes.slice(0));
        return this.resampleToMono(decoded);
    }

    private async decode(bytes: ArrayBuffer): Promise<AudioBuffer> {
        const context = new AudioContext();
        try {
            return await context.decodeAudioData(bytes);
        } finally {
            await context.close();
        }
    }

    private async resampleToMono(source: AudioBuffer): Promise<Float32Array> {
        const frameCount = Math.ceil(source.duration * this.targetSampleRate);
        const offline = new OfflineAudioContext(1, frameCount, this.targetSampleRate);

        const bufferSource = offline.createBufferSource();
        bufferSource.buffer = source;
        bufferSource.connect(offline.destination);
        bufferSource.start();

        const rendered = await offline.startRendering();
        return rendered.getChannelData(0);
    }
}

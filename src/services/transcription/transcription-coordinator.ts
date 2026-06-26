import { AudioClip } from '@/core/domain/audio-clip';
import type { Transcript } from '@/core/domain/transcript';
import { base64ToArrayBuffer } from '@/services/audio/base64';
import type { PcmDecoder } from '@/services/audio/audio-decoder';
import type { SerializedAudioClip } from '@/services/messaging/messages';
import type { Transcriber, TranscribeOptions } from './transcriber';

export interface TranscriptionCoordinatorConfig {
    readonly decoder: PcmDecoder;
    readonly transcriber: Transcriber;
}

/**
 * Owns the offscreen-side transcription pipeline: decode the incoming clip to
 * PCM, then transcribe it. Model initialization is lazy and happens at most
 * once, on the first request, so the offscreen document stays cheap until a
 * transcription is actually requested.
 */
export class TranscriptionCoordinator {
    private readonly decoder: PcmDecoder;
    private readonly transcriber: Transcriber;
    private initialization: Promise<void> | null = null;

    constructor(config: TranscriptionCoordinatorConfig) {
        this.decoder = config.decoder;
        this.transcriber = config.transcriber;
    }

    async transcribe(audio: SerializedAudioClip, options?: TranscribeOptions): Promise<Transcript> {
        await this.ensureInitialized();

        const clip = new AudioClip({
            bytes: base64ToArrayBuffer(audio.base64),
            mimeType: audio.mimeType,
            sourceId: audio.sourceId,
        });
        const samples = await this.decoder.decodeToMonoPcm(clip.bytes);

        return this.transcriber.transcribe(samples, options);
    }

    private async ensureInitialized(): Promise<void> {
        if (!this.initialization) {
            this.initialization = this.transcriber.init();
        }
        await this.initialization;
    }
}

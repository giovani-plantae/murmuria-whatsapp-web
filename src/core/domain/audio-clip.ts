export interface AudioClipData {
    readonly bytes: ArrayBuffer;
    readonly mimeType: string;
    readonly sourceId?: string;
}

/**
 * Immutable container for the raw, already-decrypted bytes of a single audio
 * message, independent of where they came from (a picked file in the pilot, a
 * WhatsApp voice note later). It carries no decoding logic — that belongs to the
 * AudioDecoder service.
 */
export class AudioClip {
    readonly bytes: ArrayBuffer;
    readonly mimeType: string;
    readonly sourceId: string | undefined;

    constructor(data: AudioClipData) {
        if (data.bytes.byteLength === 0) {
            throw new Error('AudioClip requires non-empty audio bytes.');
        }

        this.bytes = data.bytes;
        this.mimeType = data.mimeType;
        this.sourceId = data.sourceId;
    }

    get byteLength(): number {
        return this.bytes.byteLength;
    }
}

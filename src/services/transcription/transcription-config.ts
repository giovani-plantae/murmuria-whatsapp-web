export interface TranscriptionConfig {
    /** Forced transcription language (e.g. 'portuguese'); avoids language auto-detection drift on short clips. */
    readonly language: string;
}

/**
 * Client-side defaults for the murmuria server. The model lives on the murmuria
 * server; only the forced language is a client concern. Overridable at build
 * time via VITE_TRANSCRIPTION_LANGUAGE.
 */
export const DEFAULT_TRANSCRIPTION_CONFIG: TranscriptionConfig = {
    language: import.meta.env.VITE_TRANSCRIPTION_LANGUAGE ?? 'portuguese',
};

const CHUNK_SIZE = 0x8000;

/**
 * Encodes binary audio as base64 for transport across the extension's
 * runtime-messaging boundary. Chunked to stay under the argument-count limit of
 * `String.fromCharCode` on large buffers.
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';

    for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
        const chunk = bytes.subarray(offset, offset + CHUNK_SIZE);
        binary += String.fromCharCode(...chunk);
    }

    return btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }

    return bytes.buffer;
}

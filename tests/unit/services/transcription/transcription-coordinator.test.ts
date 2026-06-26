import { describe, expect, it, vi } from 'vitest';
import { Transcript } from '@/core/domain/transcript';
import { arrayBufferToBase64 } from '@/services/audio/base64';
import { TranscriptionCoordinator } from '@/services/transcription/transcription-coordinator';

const transcript = new Transcript({
  text: 'oi',
  language: 'portuguese',
  modelId: 'm',
  device: 'wasm',
  durationMs: 1,
});

function buildCoordinator() {
  const decoder = { decodeToMonoPcm: vi.fn().mockResolvedValue(new Float32Array([0.1])) };
  const transcriber = {
    init: vi.fn().mockResolvedValue(undefined),
    transcribe: vi.fn().mockResolvedValue(transcript),
  };
  const coordinator = new TranscriptionCoordinator({ decoder, transcriber });
  return { coordinator, decoder, transcriber };
}

function clipOf(bytes: number[]) {
  return { base64: arrayBufferToBase64(Uint8Array.from(bytes).buffer), mimeType: 'audio/ogg' };
}

describe('TranscriptionCoordinator', () => {
  it('decodes then transcribes the clip', async () => {
    const { coordinator, decoder, transcriber } = buildCoordinator();

    const result = await coordinator.transcribe(clipOf([1, 2, 3]));

    expect(decoder.decodeToMonoPcm).toHaveBeenCalledOnce();
    expect(transcriber.transcribe).toHaveBeenCalledWith(expect.any(Float32Array), undefined);
    expect(result.text).toBe('oi');
  });

  it('forwards per-request options (language, endpoint) to the transcriber', async () => {
    const { coordinator, transcriber } = buildCoordinator();

    await coordinator.transcribe(clipOf([1, 2, 3]), {
      language: 'english',
      endpoint: 'http://host:1',
    });

    expect(transcriber.transcribe).toHaveBeenCalledWith(expect.any(Float32Array), {
      language: 'english',
      endpoint: 'http://host:1',
    });
  });

  it('initializes the transcriber only once across requests', async () => {
    const { coordinator, transcriber } = buildCoordinator();

    await coordinator.transcribe(clipOf([1, 2, 3]));
    await coordinator.transcribe(clipOf([4, 5, 6]));

    expect(transcriber.init).toHaveBeenCalledOnce();
  });

  it('rejects empty audio before reaching the transcriber', async () => {
    const { coordinator, transcriber } = buildCoordinator();

    await expect(coordinator.transcribe(clipOf([]))).rejects.toThrow();
    expect(transcriber.transcribe).not.toHaveBeenCalled();
  });
});

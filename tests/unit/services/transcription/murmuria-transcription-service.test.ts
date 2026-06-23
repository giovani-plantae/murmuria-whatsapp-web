import { afterEach, describe, expect, it, vi } from 'vitest';
import { MurmuriaTranscriptionService } from '@/services/transcription/murmuria-transcription-service';
import type { EndpointResolver } from '@/services/transcription/endpoint-resolver';

function okResponse(text: string): Response {
  return { ok: true, json: async () => ({ text }) } as Response;
}

const samples = new Float32Array([0.1, 0.2]);

describe('MurmuriaTranscriptionService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts to the resolved endpoint and returns the transcript', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse('  oi  '));
    vi.stubGlobal('fetch', fetchMock);
    const discovery: EndpointResolver = {
      resolve: vi.fn().mockResolvedValue('http://murmuria.local:8771'),
      forget: vi.fn().mockResolvedValue(undefined),
    };
    const service = new MurmuriaTranscriptionService({ discovery, language: 'portuguese' });

    const transcript = await service.transcribe(samples);

    expect(transcript.text).toBe('oi');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://murmuria.local:8771/inference',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('rediscovers and retries once when the server is unreachable', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(okResponse('reachable'));
    vi.stubGlobal('fetch', fetchMock);
    const discovery: EndpointResolver = {
      resolve: vi
        .fn()
        .mockResolvedValueOnce('http://localhost:8771')
        .mockResolvedValueOnce('http://murmuria.local:8771'),
      forget: vi.fn().mockResolvedValue(undefined),
    };
    const service = new MurmuriaTranscriptionService({ discovery, language: 'portuguese' });

    const transcript = await service.transcribe(samples);

    expect(discovery.forget).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(transcript.text).toBe('reachable');
  });

  it('does not rediscover on an HTTP error response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);
    vi.stubGlobal('fetch', fetchMock);
    const discovery: EndpointResolver = {
      resolve: vi.fn().mockResolvedValue('http://localhost:8771'),
      forget: vi.fn().mockResolvedValue(undefined),
    };
    const service = new MurmuriaTranscriptionService({ discovery, language: 'portuguese' });

    await expect(service.transcribe(samples)).rejects.toThrow(/500/);
    expect(discovery.forget).not.toHaveBeenCalled();
  });

  it('posts a manual endpoint directly, bypassing discovery', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse('manual'));
    vi.stubGlobal('fetch', fetchMock);
    const discovery: EndpointResolver = {
      resolve: vi.fn().mockResolvedValue('http://discovered:8771'),
      forget: vi.fn().mockResolvedValue(undefined),
    };
    const service = new MurmuriaTranscriptionService({ discovery, language: 'portuguese' });

    const transcript = await service.transcribe(samples, { endpoint: 'http://manual:9000' });

    expect(transcript.text).toBe('manual');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://manual:9000/inference',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(discovery.resolve).not.toHaveBeenCalled();
    expect(discovery.forget).not.toHaveBeenCalled();
  });

  it('falls back to discovery when the manual endpoint is unreachable', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(okResponse('via discovery'));
    vi.stubGlobal('fetch', fetchMock);
    const discovery: EndpointResolver = {
      resolve: vi.fn().mockResolvedValue('http://discovered:8771'),
      forget: vi.fn().mockResolvedValue(undefined),
    };
    const service = new MurmuriaTranscriptionService({ discovery, language: 'portuguese' });

    const transcript = await service.transcribe(samples, { endpoint: 'http://manual:9000' });

    expect(transcript.text).toBe('via discovery');
    expect(fetchMock).toHaveBeenNthCalledWith(1, 'http://manual:9000/inference', expect.anything());
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://discovered:8771/inference',
      expect.anything(),
    );
    expect(discovery.resolve).toHaveBeenCalledOnce();
  });

  it('honors a per-request language override and otherwise uses the configured default', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse('x'));
    vi.stubGlobal('fetch', fetchMock);
    const discovery: EndpointResolver = {
      resolve: vi.fn().mockResolvedValue('http://murmuria.local:8771'),
      forget: vi.fn().mockResolvedValue(undefined),
    };
    const service = new MurmuriaTranscriptionService({ discovery, language: 'portuguese' });

    expect((await service.transcribe(samples, { language: 'english' })).language).toBe('english');
    expect((await service.transcribe(samples)).language).toBe('portuguese');
  });
});

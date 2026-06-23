import { afterEach, describe, expect, it, vi } from 'vitest';
import { RecorderService } from '@/services/recording/recorder-service';

type Listener = (event: unknown) => void;

/** Minimal MediaRecorder stand-in: stop() emits one dataavailable chunk then stop. */
class FakeMediaRecorder {
  state: 'inactive' | 'recording' = 'inactive';
  readonly mimeType = 'audio/webm';
  private readonly listeners = new Map<string, Listener[]>();

  addEventListener(type: string, listener: Listener): void {
    const existing = this.listeners.get(type) ?? [];
    existing.push(listener);
    this.listeners.set(type, existing);
  }

  start(): void {
    this.state = 'recording';
  }

  stop(): void {
    this.state = 'inactive';
    this.emit('dataavailable', { data: new Blob(['chunk'], { type: 'audio/webm' }) });
    this.emit('stop', {});
  }

  private emit(type: string, event: unknown): void {
    (this.listeners.get(type) ?? []).forEach((listener) => listener(event));
  }
}

function stubMediaApis() {
  const track = { stop: vi.fn() };
  const stream = { getTracks: () => [track] };
  const getUserMedia = vi.fn().mockResolvedValue(stream);
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
  vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
  return { track, getUserMedia };
}

describe('RecorderService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('records, resolves with the captured blob, and releases the mic', async () => {
    const { track, getUserMedia } = stubMediaApis();
    const states: string[] = [];
    const service = new RecorderService({ onStateChange: (state) => states.push(state) });

    await service.start();
    expect(service.isRecording).toBe(true);

    const blob = await service.stop();

    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(blob.size).toBeGreaterThan(0);
    expect(service.isRecording).toBe(false);
    expect(track.stop).toHaveBeenCalledOnce();
    expect(states).toEqual(['recording', 'idle']);
  });

  it('rejects stop() when not recording', async () => {
    stubMediaApis();
    const service = new RecorderService();

    await expect(service.stop()).rejects.toThrow();
  });

  it('cancels an in-progress recording, releasing the mic without producing a blob', async () => {
    const { track } = stubMediaApis();
    const states: string[] = [];
    const service = new RecorderService({ onStateChange: (state) => states.push(state) });

    await service.start();
    service.cancel();

    expect(track.stop).toHaveBeenCalledOnce();
    expect(service.isRecording).toBe(false);
    expect(states).toEqual(['recording', 'idle']);
  });

  it('ignores a second start() while the first is still acquiring the mic', async () => {
    const { getUserMedia } = stubMediaApis();
    const service = new RecorderService();

    await Promise.all([service.start(), service.start()]);

    expect(getUserMedia).toHaveBeenCalledOnce();
  });

  it('reports unsupported when the media APIs are missing', () => {
    vi.stubGlobal('navigator', {});
    vi.stubGlobal('MediaRecorder', undefined);

    expect(RecorderService.isSupported()).toBe(false);
  });
});

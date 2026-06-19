import { describe, expect, it } from 'vitest';
import { encodeWav } from '@/services/audio/wav-encoder';

function ascii(view: DataView, offset: number, length: number): string {
  let out = '';
  for (let index = 0; index < length; index += 1)
    out += String.fromCharCode(view.getUint8(offset + index));
  return out;
}

describe('encodeWav', () => {
  it('writes a valid mono 16-bit PCM header for the given sample rate', () => {
    const samples = new Float32Array([0, 0.5, -0.5, 1, -1]);

    const view = new DataView(encodeWav(samples, 16000));

    expect(ascii(view, 0, 4)).toBe('RIFF');
    expect(ascii(view, 8, 4)).toBe('WAVE');
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(16000);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(samples.length * 2);
  });

  it('clamps samples to the int16 range', () => {
    const view = new DataView(encodeWav(new Float32Array([1, -1]), 16000));

    expect(view.getInt16(44, true)).toBe(0x7fff);
    expect(view.getInt16(46, true)).toBe(-0x8000);
  });
});

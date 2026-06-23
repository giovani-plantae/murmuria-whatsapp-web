import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import {
  HostSettingsService,
  hostPermissionPattern,
  normalizeHost,
} from '@/services/transcription/host-settings';

describe('HostSettingsService', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('defaults to auto-discovery with no manual host', async () => {
    const settings = await new HostSettingsService().read();

    expect(settings).toEqual({ mode: 'auto', manualHost: null });
  });

  it('stores and reads back a normalized manual host', async () => {
    const service = new HostSettingsService();

    const stored = await service.useManualHost('192.168.1.50:8771');

    expect(stored).toBe('http://192.168.1.50:8771');
    expect(await service.read()).toEqual({
      mode: 'manual',
      manualHost: 'http://192.168.1.50:8771',
    });
  });

  it('reverts to auto-discovery while keeping the remembered host', async () => {
    const service = new HostSettingsService();
    await service.useManualHost('http://host:1');

    await service.useAutoDiscovery();

    expect(await service.read()).toEqual({ mode: 'auto', manualHost: 'http://host:1' });
  });
});

describe('normalizeHost', () => {
  it('prepends http:// when no scheme is given and strips a trailing slash', () => {
    expect(normalizeHost('murmuria.local:8771/')).toBe('http://murmuria.local:8771');
  });

  it('keeps an explicit https scheme', () => {
    expect(normalizeHost('https://example.test')).toBe('https://example.test');
  });

  it('throws on empty input', () => {
    expect(() => normalizeHost('   ')).toThrow();
  });

  it('throws on input that is not a parseable URL', () => {
    expect(() => normalizeHost('http://')).toThrow();
    expect(() => normalizeHost('has spaces')).toThrow();
  });
});

describe('hostPermissionPattern', () => {
  it('builds a port-agnostic match pattern for the origin', () => {
    expect(hostPermissionPattern('http://192.168.1.50:8771')).toBe('http://192.168.1.50/*');
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import {
  MurmuriaDiscoveryService,
  type EndpointStore,
} from '@/services/transcription/murmuria-discovery-service';

function memoryStore(initial: string | null = null): EndpointStore {
  let value = initial;
  return {
    read: async () => value,
    write: async (endpoint) => {
      value = endpoint;
    },
    clear: async () => {
      value = null;
    },
  };
}

function fetchReaching(reachable: Set<string>): typeof globalThis.fetch {
  const fetch = async (input: RequestInfo | URL): Promise<Response> => {
    const endpoint = String(input).replace(/\/health$/, '');
    if (!reachable.has(endpoint)) {
      throw new TypeError('Failed to fetch');
    }
    return { ok: true, json: async () => ({ service: 'murmuria' }) } as Response;
  };
  return fetch as unknown as typeof globalThis.fetch;
}

function buildDiscovery(reachable: Set<string>, store: EndpointStore) {
  return new MurmuriaDiscoveryService({
    hosts: ['murmuria.local', 'localhost', '127.0.0.1'],
    ports: [8771],
    probeTimeoutMs: 50,
    store,
    fetch: fetchReaching(reachable),
  });
}

describe('MurmuriaDiscoveryService', () => {
  let store: EndpointStore;

  beforeEach(() => {
    store = memoryStore();
  });

  it('resolves the highest-priority reachable host', async () => {
    const discovery = buildDiscovery(new Set(['http://localhost:8771']), store);

    expect(await discovery.resolve()).toBe('http://localhost:8771');
  });

  it('prefers the mDNS name over loopback when both answer', async () => {
    const reachable = new Set(['http://murmuria.local:8771', 'http://localhost:8771']);
    const discovery = buildDiscovery(reachable, store);

    expect(await discovery.resolve()).toBe('http://murmuria.local:8771');
  });

  it('persists and tries the last-known-good address first', async () => {
    store = memoryStore('http://127.0.0.1:8771');
    const discovery = buildDiscovery(new Set(['http://127.0.0.1:8771']), store);

    expect(await discovery.resolve()).toBe('http://127.0.0.1:8771');
    expect(await store.read()).toBe('http://127.0.0.1:8771');
  });

  it('re-probes after forget() when the server moved', async () => {
    const reachable = new Set(['http://localhost:8771']);
    const discovery = buildDiscovery(reachable, store);
    await discovery.resolve();

    reachable.delete('http://localhost:8771');
    reachable.add('http://murmuria.local:8771');
    await discovery.forget();

    expect(await discovery.resolve()).toBe('http://murmuria.local:8771');
  });

  it('throws when no candidate answers', async () => {
    const discovery = buildDiscovery(new Set(), store);

    await expect(discovery.resolve()).rejects.toThrow(/murmuria/i);
  });
});

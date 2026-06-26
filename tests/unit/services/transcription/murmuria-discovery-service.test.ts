import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    MurmuriaDiscoveryService,
    probeMurmuriaHealth,
    toCheckHostResult,
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

describe('probeMurmuriaHealth', () => {
    it('confirms a murmuria server and reports latency', async () => {
        const fetchImpl = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ service: 'murmuria' }),
        } as Response);

        const probe = await probeMurmuriaHealth('http://h:8771', fetchImpl, 1000);

        expect(probe).toMatchObject({ reachable: true, isMurmuria: true, service: 'murmuria' });
        expect(typeof probe.latencyMs).toBe('number');
        expect(fetchImpl).toHaveBeenCalledWith(
            'http://h:8771/health',
            expect.objectContaining({ signal: expect.any(AbortSignal) }),
        );
    });

    it('flags a host that answers but is not murmuria', async () => {
        const fetchImpl = vi
            .fn()
            .mockResolvedValue({ ok: true, json: async () => ({ service: 'other' }) } as Response);

        const probe = await probeMurmuriaHealth('http://h:8771', fetchImpl, 1000);

        expect(probe.reachable).toBe(true);
        expect(probe.isMurmuria).toBe(false);
    });

    it('reports unreachable when the request fails', async () => {
        const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

        const probe = await probeMurmuriaHealth('http://h:8771', fetchImpl, 1000);

        expect(probe.reachable).toBe(false);
        expect(probe.isMurmuria).toBe(false);
        expect(probe.error).toBeTruthy();
    });
});

describe('toCheckHostResult', () => {
    it('maps a healthy probe to an ok result with host and latency', () => {
        const result = toCheckHostResult('r-1', 'http://h:8771', {
            reachable: true,
            isMurmuria: true,
            service: 'murmuria',
            latencyMs: 42,
        });

        expect(result).toEqual({
            kind: 'check-host-result',
            requestId: 'r-1',
            ok: true,
            host: 'http://h:8771',
            service: 'murmuria',
            latencyMs: 42,
            message: undefined,
        });
    });

    it('explains a reachable host that is not murmuria', () => {
        const result = toCheckHostResult('r-2', 'http://h:8771', {
            reachable: true,
            isMurmuria: false,
            service: 'other',
        });

        expect(result.ok).toBe(false);
        expect(result.message).toMatch(/not a murmuria/i);
    });

    it('passes through the probe error for an unreachable host', () => {
        const result = toCheckHostResult('r-3', 'http://h:8771', {
            reachable: false,
            isMurmuria: false,
            error: 'Failed to fetch',
        });

        expect(result.ok).toBe(false);
        expect(result.message).toBe('Failed to fetch');
    });
});

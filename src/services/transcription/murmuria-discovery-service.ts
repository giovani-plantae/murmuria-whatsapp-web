/* eslint-disable max-classes-per-file -- TODO: extract BrowserEndpointStore into its own module, then drop this. */
import { describeError } from '@/core/errors';
import type { CheckHostResult } from '@/services/messaging/messages';
import type { EndpointResolver } from './endpoint-resolver';

/**
 * Persists the last murmuria address that answered, so a known-good server is
 * probed first on the next run instead of re-sweeping every candidate.
 */
export interface EndpointStore {
    read(): Promise<string | null>;
    write(endpoint: string): Promise<void>;
    clear(): Promise<void>;
}

export interface MurmuriaDiscoveryConfig {
    /** Hosts to try, in priority order (e.g. 'murmuria.local', 'localhost'). */
    readonly hosts: readonly string[];
    /** Ports to try on each host, in priority order. */
    readonly ports: readonly number[];
    /** Per-candidate probe budget; a host that does not answer within it is skipped. */
    readonly probeTimeoutMs: number;
    readonly store: EndpointStore;
    readonly fetch: typeof globalThis.fetch;
}

interface HealthPayload {
    readonly service?: string;
}

/**
 * Finds a reachable murmuria server without any socket-level discovery (a MV3
 * extension only has `fetch`): it probes a priority-ordered candidate list and
 * keeps the first address whose `/health` identifies itself as murmuria. The
 * `.local` candidate is resolved by the OS mDNS responder, so it follows the
 * server across the LAN even when its IP changes; loopback candidates cover the
 * same-machine case. The winning address is cached in memory and persisted so it
 * is tried first next time.
 */
export class MurmuriaDiscoveryService implements EndpointResolver {
    private readonly hosts: readonly string[];
    private readonly ports: readonly number[];
    private readonly probeTimeoutMs: number;
    private readonly store: EndpointStore;
    private readonly fetch: typeof globalThis.fetch;
    private resolved: string | null = null;

    constructor(config: MurmuriaDiscoveryConfig) {
        this.hosts = config.hosts;
        this.ports = config.ports;
        this.probeTimeoutMs = config.probeTimeoutMs;
        this.store = config.store;
        this.fetch = config.fetch;
    }

    async resolve(): Promise<string> {
        if (this.resolved) {
            return this.resolved;
        }

        const candidates = await this.candidateEndpoints();
        const reachable = await this.firstReachable(candidates);
        if (!reachable) {
            throw new Error(
                'Could not find the murmuria server. Make sure it is running and announcing "murmuria.local" on your network.',
            );
        }

        this.resolved = reachable;
        await this.store.write(reachable);
        return reachable;
    }

    async forget(): Promise<void> {
        this.resolved = null;
        await this.store.clear();
    }

    private async candidateEndpoints(): Promise<string[]> {
        const grid = this.hosts.flatMap((host) => this.ports.map((port) => `http://${host}:${port}`));
        const lastKnownGood = await this.store.read();
        return unique([lastKnownGood, ...grid].filter((endpoint): endpoint is string => !!endpoint));
    }

    private async firstReachable(candidates: readonly string[]): Promise<string | null> {
        const probes = await Promise.all(
            candidates.map(async (endpoint) => ({ endpoint, alive: await this.probe(endpoint) })),
        );
        return probes.find((probe) => probe.alive)?.endpoint ?? null;
    }

    private async probe(endpoint: string): Promise<boolean> {
        const result = await probeMurmuriaHealth(endpoint, this.fetch, this.probeTimeoutMs);
        return result.isMurmuria;
    }
}

/** Outcome of a single `/health` probe, with enough detail to drive a status UI. */
export interface HealthProbe {
    /** The host answered at all (any HTTP status), vs. no connection / timeout. */
    readonly reachable: boolean;
    /** The host answered `/health` identifying itself as murmuria. */
    readonly isMurmuria: boolean;
    readonly service?: string;
    readonly latencyMs?: number;
    readonly error?: string;
}

/**
 * Probes `<baseUrl>/health` once, aborting after `timeoutMs`. Never throws —
 * returns a structured outcome so both discovery (boolean) and the popup's
 * connection test (full detail + latency) can share one implementation.
 */
export async function probeMurmuriaHealth(
    baseUrl: string,
    fetchImpl: typeof globalThis.fetch,
    timeoutMs: number,
): Promise<HealthProbe> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const startedAt = performance.now();
    try {
        const response = await fetchImpl(`${baseUrl}/health`, { signal: controller.signal });
        const latencyMs = Math.round(performance.now() - startedAt);
        if (!response.ok) {
            return { reachable: true, isMurmuria: false, latencyMs, error: `HTTP ${response.status}` };
        }
        const payload = (await response.json()) as HealthPayload;
        return {
            reachable: true,
            isMurmuria: payload.service === 'murmuria',
            service: payload.service,
            latencyMs,
        };
    } catch (error) {
        return { reachable: false, isMurmuria: false, error: describeError(error) };
    } finally {
        clearTimeout(timeout);
    }
}

/** Shapes a health probe into the `CheckHostResult` message the popup renders. */
export function toCheckHostResult(
    requestId: string,
    host: string,
    probe: HealthProbe,
): CheckHostResult {
    return {
        kind: 'check-host-result',
        requestId,
        ok: probe.isMurmuria,
        host,
        service: probe.service,
        latencyMs: probe.latencyMs,
        message: probe.isMurmuria
            ? undefined
            : (probe.error ?? (probe.reachable ? 'Reachable, but not a murmuria server.' : undefined)),
    };
}

function unique(values: readonly string[]): string[] {
    return [...new Set(values)];
}

/**
 * Stores the resolved murmuria address in `browser.storage.local`. Lives in the
 * extension runtime; unit tests inject an in-memory EndpointStore instead.
 */
export class BrowserEndpointStore implements EndpointStore {
    private static readonly storageKey = 'murmuria.endpoint';

    async read(): Promise<string | null> {
        const local = localStorageArea();
        if (!local) {
            return null;
        }
        const result = await local.get(BrowserEndpointStore.storageKey);
        const value = result[BrowserEndpointStore.storageKey];
        return typeof value === 'string' ? value : null;
    }

    async write(endpoint: string): Promise<void> {
        await localStorageArea()?.set({ [BrowserEndpointStore.storageKey]: endpoint });
    }

    async clear(): Promise<void> {
        await localStorageArea()?.remove(BrowserEndpointStore.storageKey);
    }
}

/**
 * The offscreen document — where discovery runs — does not expose
 * `chrome.storage`. Returns the local area when present, otherwise null so the
 * store degrades to no persistence; the in-memory memo keeps discovery cheap
 * across requests within the document's lifetime regardless.
 */
function localStorageArea() {
    return browser.storage?.local ?? null;
}

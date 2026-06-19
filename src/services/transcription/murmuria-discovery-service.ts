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
        'Não encontrei o servidor murmuria. Verifique se ele está rodando e anunciando "murmuria.local" na rede.',
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
    const grid = this.hosts.flatMap((host) =>
      this.ports.map((port) => `http://${host}:${port}`),
    );
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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.probeTimeoutMs);
    try {
      const response = await this.fetch(`${endpoint}/health`, { signal: controller.signal });
      if (!response.ok) {
        return false;
      }
      const payload = (await response.json()) as HealthPayload;
      return payload.service === 'murmuria';
    } catch {
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }
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

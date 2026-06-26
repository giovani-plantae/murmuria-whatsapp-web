/**
 * Build-time defaults for murmuria discovery. The `.local` host comes first so a
 * LAN server found by name wins over loopback; ports default to the canonical
 * 8771 but accept extras for non-standard deployments. All overridable via Vite
 * env at build time.
 */
function parseHosts(value: string | undefined, fallback: readonly string[]): string[] {
    if (!value) {
        return [...fallback];
    }
    return value
        .split(',')
        .map((host) => host.trim())
        .filter(Boolean);
}

function parsePorts(value: string | undefined, fallback: readonly number[]): number[] {
    if (!value) {
        return [...fallback];
    }
    return value
        .split(',')
        .map((port) => Number(port.trim()))
        .filter((port) => Number.isInteger(port) && port > 0);
}

export const DEFAULT_MURMURIA_HOSTS: readonly string[] = parseHosts(
    import.meta.env.VITE_MURMURIA_HOSTS,
    ['murmuria.local', 'localhost', '127.0.0.1'],
);

export const DEFAULT_MURMURIA_PORTS: readonly number[] = parsePorts(
    import.meta.env.VITE_MURMURIA_PORTS,
    [8771],
);

export const DISCOVERY_PROBE_TIMEOUT_MS = Number(
    import.meta.env.VITE_DISCOVERY_PROBE_TIMEOUT_MS ?? 1500,
);

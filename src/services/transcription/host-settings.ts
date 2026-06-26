export type HostMode = 'auto' | 'manual';

export interface HostSettings {
    readonly mode: HostMode;
    /** Normalized base URL (e.g. `http://192.168.1.50:8771`) when mode is manual, otherwise null. */
    readonly manualHost: string | null;
}

/**
 * Persists the user's server preference — auto-discovery (default) or a manually
 * entered host — in `browser.storage.local`, so every context (popup setting it,
 * background reading it to route transcriptions) sees the same value.
 */
export class HostSettingsService {
    private static readonly modeKey = 'murmuria.mode';
    private static readonly hostKey = 'murmuria.manualHost';

    async read(): Promise<HostSettings> {
        const area = localStorageArea();
        if (!area) {
            return { mode: 'auto', manualHost: null };
        }
        const result = await area.get([HostSettingsService.modeKey, HostSettingsService.hostKey]);
        const stored = result[HostSettingsService.hostKey];
        const manualHost = typeof stored === 'string' ? stored : null;
        const mode: HostMode =
            result[HostSettingsService.modeKey] === 'manual' && manualHost ? 'manual' : 'auto';
        return { mode, manualHost };
    }

    /** Switches to a manually configured server and returns the normalized host that was stored. */
    async useManualHost(rawHost: string): Promise<string> {
        const host = normalizeHost(rawHost);
        await localStorageArea()?.set({
            [HostSettingsService.modeKey]: 'manual',
            [HostSettingsService.hostKey]: host,
        });
        return host;
    }

    async useAutoDiscovery(): Promise<void> {
        await localStorageArea()?.set({ [HostSettingsService.modeKey]: 'auto' });
    }
}

/**
 * Coerces user input into a base URL: prepends `http://` when no scheme is given
 * and strips a trailing slash. Throws if the result is not a parseable URL, so
 * callers can surface an inline validation error.
 */
export function normalizeHost(rawHost: string): string {
    const trimmed = rawHost.trim();
    if (!trimmed) {
        throw new Error('Enter a server address.');
    }
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
    const url = new URL(withScheme);
    return `${url.protocol}//${url.host}`;
}

/** Match pattern (`http://host/*`, port-agnostic) for an optional host-permission request. */
export function hostPermissionPattern(normalizedHost: string): string {
    const url = new URL(normalizedHost);
    return `${url.protocol}//${url.hostname}/*`;
}

function localStorageArea() {
    return browser.storage?.local ?? null;
}

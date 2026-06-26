/**
 * Resolves the base URL of a reachable murmuria server. Decouples the
 * transcription service from how the address is found (cached value, mDNS
 * `.local` name, or loopback probe) and lets it ask for a fresh address after a
 * server move.
 */
export interface EndpointResolver {
    /** Returns a reachable murmuria base URL, memoizing the result. */
    resolve(): Promise<string>;

    /** Drops the memoized address so the next resolve() probes the network again. */
    forget(): Promise<void>;
}

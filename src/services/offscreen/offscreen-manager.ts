/**
 * Wraps the `chrome.offscreen` API so the background worker can guarantee a
 * single live offscreen document exists before routing work to it. Only one
 * offscreen document may exist per profile, and concurrent `ensure()` calls must
 * not race into a double `createDocument`, so creation is de-duplicated.
 */
export class OffscreenManager {
    private readonly url: string;
    private creating: Promise<void> | null = null;

    constructor(url: string) {
        this.url = url;
    }

    async ensure(): Promise<void> {
        if (await this.exists()) {
            return;
        }

        if (!this.creating) {
            this.creating = this.create();
        }

        try {
            await this.creating;
        } finally {
            this.creating = null;
        }
    }

    private async exists(): Promise<boolean> {
        return chrome.offscreen.hasDocument();
    }

    private async create(): Promise<void> {
        await chrome.offscreen.createDocument({
            url: this.url,
            reasons: [chrome.offscreen.Reason.WORKERS],
            justification:
        'Use the Web Audio API to decode voice-message audio (unavailable in the service worker).',
        });
    }
}

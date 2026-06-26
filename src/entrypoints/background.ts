import { OffscreenManager } from '@/services/offscreen/offscreen-manager';
import {
    isAddressedTo,
    isCheckHostRequest,
    isTranscribeRequest,
} from '@/services/messaging/messages';
import type {
    CheckHostRequest,
    CheckHostResult,
    TranscribeRequest,
    TranscribeResponse,
} from '@/services/messaging/messages';
import { HostSettingsService } from '@/services/transcription/host-settings';

/**
 * The service worker is intentionally a thin router: it can't use the Web Audio
 * API needed to decode the audio, so it only guarantees the offscreen document
 * exists and relays work to it. It is also the single chokepoint every
 * transcription passes through (popup and WhatsApp content script alike), so it
 * is where the user's manually configured host is injected onto the request.
 */
class BackgroundRouter {
    private readonly offscreen: OffscreenManager;
    private readonly hostSettings: HostSettingsService;

    constructor(offscreen: OffscreenManager, hostSettings: HostSettingsService) {
        this.offscreen = offscreen;
        this.hostSettings = hostSettings;
        this.handleMessage = this.handleMessage.bind(this);
    }

    start(): void {
        browser.runtime.onMessage.addListener(this.handleMessage);
    }

    private handleMessage(
        message: unknown,
    ): Promise<TranscribeResponse> | Promise<CheckHostResult> | undefined {
        if (!isAddressedTo(message, 'background')) {
            return undefined;
        }
        if (isTranscribeRequest(message)) {
            return this.relayTranscribe(message);
        }
        if (isCheckHostRequest(message)) {
            return this.relayCheckHost(message);
        }
        return undefined;
    }

    private async relayTranscribe(message: TranscribeRequest): Promise<TranscribeResponse> {
        await this.offscreen.ensure();
        const settings = await this.hostSettings.read();
        const endpoint = settings.mode === 'manual' ? (settings.manualHost ?? undefined) : undefined;
        return browser.runtime.sendMessage({
            ...message,
            target: 'offscreen',
            endpoint,
        }) as Promise<TranscribeResponse>;
    }

    private async relayCheckHost(message: CheckHostRequest): Promise<CheckHostResult> {
        await this.offscreen.ensure();
        return browser.runtime.sendMessage({
            ...message,
            target: 'offscreen',
        }) as Promise<CheckHostResult>;
    }
}

export default defineBackground(() => {
    new BackgroundRouter(new OffscreenManager('offscreen.html'), new HostSettingsService()).start();
});

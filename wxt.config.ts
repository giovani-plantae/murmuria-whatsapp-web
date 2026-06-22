import { defineConfig } from 'wxt';

// WhatsApp's internal modules are only reachable from the page's MAIN world; the
// audio decode and transcription happen on the extension origin (the offscreen
// document), which POSTs the audio to a murmuria server discovered at runtime.
// The host permissions are deliberately narrow: loopback for a same-machine
// server, plus the link-local `murmuria.local` mDNS name for a LAN server (the
// OS resolves `.local`; match patterns ignore the port, so any port is covered).
// The extension still cannot reach any third party — the "stays on your network"
// guarantee is enforced by the manifest itself, not just by convention.
export default defineConfig({
  srcDir: 'src',
  manifest: {
    name: 'murmuria — WhatsApp Web audio transcription',
    description: 'Transcribes WhatsApp Web audio locally using a murmuria server on your network.',
    minimum_chrome_version: '116',
    permissions: ['offscreen', 'storage', 'unlimitedStorage'],
    host_permissions: ['http://localhost/*', 'http://127.0.0.1/*', 'http://murmuria.local/*'],
  },
});

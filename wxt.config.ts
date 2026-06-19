import { defineConfig } from 'wxt';

// WhatsApp's internal modules are only reachable from the page's MAIN world; the
// audio decode and transcription happen on the extension origin (the offscreen
// document), which POSTs the audio to a local murmuria server. The manifest
// stays minimal: the only host permission is the loopback transcription server,
// so the extension cannot reach any third party — the "nothing leaves your
// machine" guarantee is enforced by the manifest itself, not just by convention.
export default defineConfig({
  srcDir: 'src',
  manifest: {
    name: 'WhatsApp Audio → Texto (piloto)',
    description: 'Transcreve áudios do WhatsApp Web localmente via um servidor murmuria local.',
    minimum_chrome_version: '116',
    permissions: ['offscreen', 'unlimitedStorage'],
    host_permissions: ['http://localhost:8771/*', 'http://127.0.0.1:8771/*'],
  },
});

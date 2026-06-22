<div align="center">

<img src="assets/icon.svg" width="120" height="120" alt="murmuria" />

# murmuria-whatsapp-web

**WhatsApp Web audio to text, in one click — on your own server.**

[![CI](https://github.com/giovani-plantae/murmuria-whatsapp-web/actions/workflows/ci.yml/badge.svg)](https://github.com/giovani-plantae/murmuria-whatsapp-web/actions/workflows/ci.yml)
![License: MIT](https://img.shields.io/badge/license-MIT-blue)

</div>

MV3 extension that injects a **"Transcribe"** button into WhatsApp Web audio messages. Transcription
runs on your own [**murmuria**](https://github.com/giovani-plantae/murmuria) server — the audio never
goes to any third-party service.

> ⚠️ **UNOFFICIAL client, for educational purposes only.** It uses WhatsApp's internal modules
> (reverse-engineered), violates Meta's ToS, and **may lead to account bans**. See
> [DISCLAIMER.md](DISCLAIMER.md).

## Requirements

- **Node 22+** and the [murmuria](https://github.com/giovani-plantae/murmuria) server running (`localhost:8771`).

## Running

```bash
npm install
npm run build        # → .output/chrome-mv3
```

In `chrome://extensions` (or `brave://extensions`) → **Developer mode** → **Load unpacked** → select
`.output/chrome-mv3`. Open WhatsApp Web and click **Transcribe** on an audio message. Reload the card
after every `npm run build`.

> `npm run dev` (HMR) needs Chrome/Chromium; with Brave only, use
> `CHROME_PATH=/usr/bin/brave-browser npm run dev`.

## How it works

A content script detects the bubble and injects the button → `whatsapp-main` (MAIN world) extracts the
decrypted bytes → the offscreen document decodes them (Opus → PCM → WAV) and `POST`s to murmuria → the
text goes back into the bubble.

### Server discovery

The extension finds murmuria on its own, with no port/IP hardcoded. It tries, in order, the last
address that worked → `murmuria.local` (resolved by the OS mDNS, so it works even with the server on
**another machine on the LAN**) → `localhost`/`127.0.0.1`. The first one to answer `GET /health` with
`{ "service": "murmuria" }` wins and is cached; if the server goes down, it rediscovers on the next
click.

For this, murmuria must **announce `murmuria.local` over mDNS** and expose `/health`. The hosts and
ports probed are configurable at build time via `VITE_MURMURIA_HOSTS` and `VITE_MURMURIA_PORTS`.

## Scripts

`build` · `dev` · `compile` (tsc) · `test:run` (Vitest) · `format` (Prettier)

## Risks

- Extraction depends on WhatsApp's obfuscated internal modules (`WAWeb*`) — it breaks when they change.
- Read-only by design (never sends/automates), which reduces but does not eliminate the ban risk.

## License

[MIT](LICENSE)

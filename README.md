<div align="center">

# 🎙️ murmuria-whatsapp-web

**Áudios do WhatsApp Web em texto, com um clique — no seu próprio servidor.**

[![CI](https://github.com/giovani-plantae/murmuria-whatsapp-web/actions/workflows/ci.yml/badge.svg)](https://github.com/giovani-plantae/murmuria-whatsapp-web/actions/workflows/ci.yml)
![License: MIT](https://img.shields.io/badge/license-MIT-blue)

</div>

Extensão MV3 que injeta um botão **"Transcrever"** nos áudios do WhatsApp Web. A transcrição
roda no seu servidor [**murmuria**](https://github.com/giovani-plantae/murmuria) — o áudio não vai para
nenhum serviço de terceiros.

> ⚠️ **Cliente NÃO-OFICIAL, só para fins educacionais.** Usa módulos internos do WhatsApp
> (engenharia reversa), viola o ToS da Meta e **pode levar a banimento de conta**. Veja o
> [DISCLAIMER.md](DISCLAIMER.md).

## Requisitos

- **Node 22+** e o servidor [murmuria](https://github.com/giovani-plantae/murmuria) rodando (`localhost:8771`).

## Rodando

```bash
npm install
npm run build        # → .output/chrome-mv3
```

Em `chrome://extensions` (ou `brave://extensions`) → **Modo do desenvolvedor** → **Carregar sem
compactação** → selecione `.output/chrome-mv3`. Abra o WhatsApp Web e clique em **Transcrever**
num áudio. Recarregue o card a cada `npm run build`.

> `npm run dev` (HMR) precisa de Chrome/Chromium; com só o Brave, use
> `CHROME_PATH=/usr/bin/brave-browser npm run dev`.

## Como funciona

Content script detecta o balão e injeta o botão → `whatsapp-main` (MAIN world) extrai os bytes
decriptados → offscreen decodifica (Opus → PCM → WAV) e faz `POST` no murmuria → o texto volta
pro balão.

### Descoberta do servidor

A extensão acha o murmuria sozinha, sem porta/IP fixos no código. Ela testa, em ordem, o
último endereço que funcionou → `murmuria.local` (resolvido pelo mDNS do SO, então funciona
mesmo com o servidor em **outra máquina da LAN**) → `localhost`/`127.0.0.1`. O primeiro que
responder `GET /health` com `{ "service": "murmuria" }` vence e fica em cache; se o servidor
sair do ar, ela redescobre no próximo clique.

Para isso o murmuria precisa **anunciar `murmuria.local` via mDNS** e expor o `/health`. Hosts e
portas testados são ajustáveis no build via `VITE_MURMURIA_HOSTS` e `VITE_MURMURIA_PORTS`.

## Scripts

`build` · `dev` · `compile` (tsc) · `test:run` (Vitest) · `format` (Prettier)

## Riscos

- A extração depende de módulos internos ofuscados do WhatsApp (`WAWeb*`) — quebra quando ele muda.
- Read-only por design (nunca envia/automatiza), o que reduz mas não zera o risco de banimento.

## Licença

[MIT](LICENSE)

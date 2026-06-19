# Contribuindo

Obrigado pelo interesse! Este é um projeto-piloto — antes de contribuir, leia o
[DISCLAIMER.md](DISCLAIMER.md) (cliente não-oficial, fins educacionais).

## Ambiente

- **Node 22+** (veja [`.nvmrc`](.nvmrc); use `nvm use`).
- O servidor [**murmuria**](https://github.com/OWNER/murmuria) rodando (repositório separado) para transcrever.

```bash
npm ci          # instala as dependências exatamente como no lockfile
npm run dev     # ou: npm run build  (veja o README sobre dev vs build)
```

## Antes de abrir um PR

Rode os mesmos checks que o CI roda:

```bash
npm run compile     # tsc --noEmit (type-check)
npm run test:run    # testes unitários (Vitest)
npm run build       # build de produção (.output/chrome-mv3)
npm run format:check # formatação (Prettier)
```

- Use `npm run format` para aplicar a formatação automaticamente.
- Siga o padrão de camadas existente em `src/` (`domain/`, `services/`, `dom/`,
  `entrypoints/`); `chrome.*` só aparece dentro de `services/` e `entrypoints/`.
- Mantenha o projeto **read-only** em relação ao WhatsApp (nunca enviar/automatizar).

## Testes manuais (extensão real)

Não há E2E automatizado no CI (precisa de um navegador real + servidor rodando).
Para testar manualmente: `npm run build`, carregue `.output/chrome-mv3` em
`chrome://extensions` (ou `brave://extensions`) → "Carregar sem compactação", com o
servidor murmuria no ar. Detalhes no [README](README.md).

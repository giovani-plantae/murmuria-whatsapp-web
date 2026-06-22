# Contributing

Thanks for your interest! Before contributing, read
[DISCLAIMER.md](DISCLAIMER.md) (unofficial client, educational purposes).

## Environment

- **Node 22+** (see [`.nvmrc`](.nvmrc); use `nvm use`).
- The [**murmuria**](https://github.com/giovani-plantae/murmuria) server running (separate repository) to transcribe.

```bash
npm ci          # install dependencies exactly as in the lockfile
npm run dev     # or: npm run build  (see the README about dev vs build)
```

## Before opening a PR

Run the same checks the CI runs:

```bash
npm run compile     # tsc --noEmit (type-check)
npm run test:run    # unit tests (Vitest)
npm run build       # production build (.output/chrome-mv3)
npm run format:check # formatting (Prettier)
```

- Use `npm run format` to apply formatting automatically.
- Follow the existing layered structure in `src/` (`domain/`, `services/`, `dom/`,
  `entrypoints/`); `chrome.*` only appears inside `services/` and `entrypoints/`.
- Keep the project **read-only** with respect to WhatsApp (never send/automate).

## Manual testing (real extension)

There is no automated E2E in CI (it needs a real browser + a running server).
To test manually: `npm run build`, load `.output/chrome-mv3` in
`chrome://extensions` (or `brave://extensions`) → "Load unpacked", with the
murmuria server up. Details in the [README](README.md).

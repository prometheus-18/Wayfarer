# Contributing to Wayfarer

Hey Kartikey 👋 — here's how we work together on this repo so `main` always stays buildable and demo-ready for the hackathon.

## Branch → PR flow

We **never push directly to `main`**. Every change goes through a branch and a Pull Request.

```bash
# Always start from the latest main
git checkout main
git pull origin main

# Create a feature branch (see naming below)
git checkout -b feat/voice-input

# …make changes, commit…
git push -u origin feat/voice-input

# Then open a Pull Request on GitHub against `main`
```

The other person reviews, then we merge (squash). Pull `main` again before starting your next branch.

### Branch naming

| Prefix | Use for |
|---|---|
| `feat/…` | a new feature or capability |
| `fix/…` | a bug fix |
| `ui/…` | visual / UX polish |
| `docs/…` | docs only |
| `chore/…` | deps, config, tooling |

Example: `feat/live-camera-ocr`, `fix/translate-pivot-crash`.

### Commit messages

Short, imperative, prefixed: `feat: add voice input to assistant`. Group related work into meaningful commits.

## Before you open a PR

1. **Typecheck passes:** `npx tsc --noEmit`
2. **Config is valid:** `npx expo config --type public` runs without errors
3. **It runs on a real device** (`npx expo run:android --device`) for anything touching native modules or models — remember, **no emulators**.
4. Keep PRs focused and describe what you changed + how you tested it.

## Where things live

All QVAC/model code lives in **`src/qvac/`** — that's the only layer that imports `@qvac/sdk`. Screens should call the helpers (`translateText`, `scanImage`, `askAssistant`) and never touch the SDK directly. This keeps the UI clean and the AI swappable.

### Common tasks

**Add a translation language**
1. Confirm QVAC ships the pair: it must export both `BERGAMOT_EN_<CODE>` and `BERGAMOT_<CODE>_EN`.
   ```bash
   node -e "const m=require('@qvac/sdk/models'); console.log(['BERGAMOT_EN_SV','BERGAMOT_SV_EN'].map(k=>k+':'+!!m[k]))"
   ```
2. Add an entry to `TARGET_LANGUAGES` in [`src/data/languages.ts`](src/data/languages.ts). That's it — the picker and routing pick it up automatically.

**Swap the assistant model** — edit `ASSISTANT_MODELS` in [`src/qvac/models.ts`](src/qvac/models.ts) (e.g. a Qwen3-VL or Gemma multimodal). Pair the model with its matching `MMPROJ_*` projection.

**Add a feature/screen** — add `src/screens/XScreen.tsx`, a service in `src/qvac/`, and a tab in [`src/components/TabBar.tsx`](src/components/TabBar.tsx).

## Code style

- TypeScript strict mode; no `any` unless truly unavoidable (and comment why).
- Match the existing component patterns and the `theme.ts` tokens — no hard-coded colors/spacing.
- Keep model loads going through `ModelManager` so we stay RAM-safe.

## Need the SDK reference?

- Docs: https://docs.qvac.tether.io/
- Consolidated plaintext (great for AI tools): https://docs.qvac.tether.io/llms-full.txt
- Inspect real exports locally: `node -e "console.log(Object.keys(require('@qvac/sdk/models')))"`

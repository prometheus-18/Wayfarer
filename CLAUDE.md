# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

Wayfarer — a privacy-first, 100% offline travel app (QVAC "Unleash Edge AI" hackathon, Mobile track) built on Tether's **@qvac/sdk**. Three features, each backed by an on-device model: **Translate** (Bergamot NMT, streaming, + Whisper voice input), **Scan** (OCR → translate), **Assistant** (SmolVLM2 multimodal chat). No network calls at inference time; models download once from the QVAC registry on first use.

## Hard constraints

- **Physical device only.** QVAC's native runtimes (llama.cpp / Bergamot / ONNX) do not run on emulators or simulators. Anything touching native modules or models must be verified on a real Android phone (API 29+, arm64).
- **Node ≥ 22.17** — the QVAC worker bundler (`bare-pack`) runs during prebuild and fails on older Node.
- `android/`, `ios/`, and `qvac/` are **gitignored, prebuild-generated** — a fresh clone needs `npx expo prebuild --clean` before any native build.
- Expo SDK 56: consult the versioned docs (see AGENTS.md), not memory.

## Commands

```powershell
npm install
npx expo prebuild --clean            # regen native projects + QVAC worker (required after app.json/native-dep changes)
npx expo run:android --device        # dev build on a USB-connected phone (uses expo-dev-client)

npx tsc --noEmit                     # typecheck — THE pre-PR verification (no test suite, no linter)
npx expo config --type public        # validate app.json/plugin config

cd android; ./gradlew :app:assembleRelease   # standalone release APK → android/app/build/outputs/apk/release/
```

There is no test suite. `npx tsc --noEmit` + an on-device run is the verification bar (see CONTRIBUTING.md). If `adb install` is blocked on the dev phone, see NEXT_STEPS.md for the no-cable APK delivery workflow (local http server + cloudflared tunnel).

## Architecture (the rules that span files)

Layering — strictly one-directional:

```
screens (UI state only) → src/qvac/* helpers → @qvac/sdk → Bare worker (native C++ inference via react-native-bare-kit)
```

- **`src/qvac/` is the only layer that may import `@qvac/sdk`.** Screens call the app-level helpers: `translateText()`, `scanImage()`, `runAgent()` (the live tool-calling agent), `transcribeAudio()`.
- **Every model load goes through `ModelManager.ts`** — it caches by logical key, dedupes concurrent loads via an in-flight promise map, and enforces the RAM policy: translation models (~35 MB each) stay cached per direction; OCR (~98 MB) and the assistant VLM (~900 MB) are *heavy* and **mutually exclusive** (loading one unloads the other). Never call `loadModel` directly from a screen or new service without going through `ensure*`.
- **`loadModel` needs more than the descriptor** (hard-won on-device fixes — don't regress):
  - Bergamot NMT: `modelType: 'nmtcpp-translation'` **and** `modelConfig: { engine: 'Bergamot', from, to }` — the descriptor alone carries no direction and the load silently misbehaves without it.
  - Whisper: `modelType: 'whispercpp-transcription'`.
- **Translation is English-pivot**: `routeFor()` in `translate.ts` splits non-English↔non-English into two hops (X→en, en→Y); only the final hop streams to the UI.
- **Images/audio go to the native worker as absolute paths**: pickers/recorders return `file://` URIs; `image.ts#toModelPath()` strips the scheme + URL-decodes before passing to `ocr()`/attachments/`transcribe`.
- **Model-download UX**: `useModelLoader` (hook) drives the progress overlay; progress is clamped 0–100 and monotonic, and handles multi-file/sharded downloads.
- **Security layer is deliberate**: user input passes through `sanitizeText`/`LIMITS` (`security.ts`); scanned/OCR text is treated as data, never as assistant instructions (prompt-injection resistance); every inference is logged to the on-device audit log via `telemetry.ts#logEvent` (exportable in-app). Keep new features on this path.

## Conventions that matter here

- Branch → PR to `main`, never push `main` directly (CONTRIBUTING.md). Prefixes: `feat/`, `fix/`, `ui/`, `docs/`, `chore/`. Commits: short imperative with the same prefixes.
- TypeScript strict; no `any` without a comment justifying it.
- Style through `theme.ts` tokens only — no hard-coded colors/spacing.
- **Add a translation language**: verify QVAC ships *both* directions (`BERGAMOT_EN_<CODE>` and `BERGAMOT_<CODE>_EN`), then add one entry to `TARGET_LANGUAGES` in `src/data/languages.ts` — picker and routing pick it up automatically. Check exports with: `node -e "console.log(Object.keys(require('@qvac/sdk/models')))"`.

## QVAC SDK reference

- Docs: https://docs.qvac.tether.io/ — consolidated plaintext for AI tools: https://docs.qvac.tether.io/llms-full.txt
- Current model wiring (feature → SDK call → constants) is tabulated in `docs/ARCHITECTURE.md`.

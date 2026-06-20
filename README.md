# 🧭 Wayfarer

**Your private, offline travel companion.** Translate text, scan signs & menus with the camera, and chat with a multimodal AI assistant — all running **100% on-device** with zero network calls. Built for the [**QVAC "Unleash Edge AI" hackathon**](https://dorahacks.io/hackathon/qvac-unleach-edge-ai-i/tracks) (**Mobile** track) on [Tether's QVAC SDK](https://docs.qvac.tether.io/).

> Flagship _and_ mid-range phones can deliver production-quality AI without sending a single byte to the cloud. Wayfarer proves it.

---

## ✨ Features

| | Feature | What it does | QVAC under the hood |
|---|---|---|---|
| 🗣️ | **Translate** | Offline neural translation across 49 languages, streamed token-by-token. Non-English ↔ non-English pivots through English automatically. | `translate()` + Bergamot NMT models (`BERGAMOT_*`) |
| 🎙️ | **Voice in** | Tap **Speak**, talk in any supported language — Whisper transcribes it on-device straight into the translator. | `transcribe()` + `WHISPER_BASE_Q8_0` |
| 🔊 | **Voice out** | Tap **Listen** and the phone speaks the translation aloud — full voice-to-voice translation (en/es/de/it). | `textToSpeech()` + Supertonic TTS |
| 📷 | **Scan** | Snap or pick a photo → on-device OCR extracts the text → translate it into your language (or have it spoken). | `ocr()` + `OCR_LATIN_RECOGNIZER_1` & `OCR_CRAFT_DETECTOR` |
| 🧭 | **Agent** | A warm, offline travel assistant that **orchestrates tools** — it routes your question to translation, photo scanning, or the offline phrasebook, shows its tool trace, then answers. | `completion()` with grammar-constrained `responseFormat` + `SMOLVLM2_500M` multimodal VLM |
| 📖 | **Phrasebook (RAG)** | 92 curated travel phrases + city guides, semantically searchable offline; grounds the agent's answers. | `ragIngest()` / `ragSearch()` + `EMBEDDINGGEMMA_300M` |
| 🧪 | **Benchmark** | A 20-case stress suite *inside the app* (privacy footer) — live TTFT/tokens-per-sec HUD on every screen, exportable audit log. | `stats` from every modality |

**Why it matters:** no signal abroad, no roaming fees, no data leaving your phone, no privacy trade-offs. Everything happens locally.

---

## 🧱 Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  React Native UI (Expo 56)                                     │
│  TranslateScreen   ScanScreen   AssistantScreen                │
└───────────────┬────────────────────────────────────────────────┘
                │  service layer (src/qvac/*)
                ▼
   translateText()      scanImage()        runAgent()
                \           |             /
                 ▼          ▼            ▼
        ┌───────────────────────────────────────┐
        │  ModelManager  (load / cache / unload) │  ← keeps mobile RAM safe:
        └───────────────────────────────────────┘    heavy models are mutually exclusive
                          │  @qvac/sdk
                          ▼
        ┌───────────────────────────────────────┐
        │  react-native-bare-kit  (Bare worker)  │  ← native C++ inference
        │  llama.cpp · Bergamot · ONNX Runtime   │
        └───────────────────────────────────────┘
```

- **`src/qvac/`** — the only place that talks to `@qvac/sdk`. `ModelManager` lazily loads models, caches the lightweight translation models, and guarantees only one *heavy* model (OCR or the assistant VLM) is resident at a time so we never OOM on a phone.
- **`src/screens/`** — one screen per feature; pure UI + state.
- **`src/components/` + `src/theme.ts`** — a small design system (cards, buttons, language picker, loading overlay, tab bar).
- Models download from the QVAC registry **on first use** and are cached on the device forever after — the loading overlay shows progress.

See [`docs/APP_GUIDE.md`](docs/APP_GUIDE.md) for what each feature does and how, and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for a deeper code tour.

---

## 🛠️ Tech stack

- **Expo SDK 56** / React Native 0.85 / React 19 / TypeScript (strict)
- **[@qvac/sdk](https://docs.qvac.tether.io/) `0.12.x`** — on-device LLM, NMT translation, OCR, multimodal vision
- **react-native-bare-kit** — hosts the native Bare worker that runs inference
- **expo-image-picker** — camera + photo library
- **expo-file-system / expo-device** — required by the SDK runtime

---

## 🚀 Getting started

> ⚠️ **Physical device required.** QVAC uses `llama.cpp` / native runtimes that **do not run on emulators or simulators**. Use a real Android phone (or iPhone) via USB.

### Prerequisites

- **Node.js ≥ 22.17** and npm ≥ 10.9 — the QVAC mobile bundler (`bare-pack`, run during `prebuild`) needs this. ⚠️ If `prebuild` fails with a Node error, upgrade Node.
- **Android:** Android Studio + SDK, a device with **USB debugging** enabled (Android 10 / API 29+, arm64). Xcode + a real iPhone for iOS.
- A device with **≥ 4 GB RAM** is recommended (the assistant VLM is ~900 MB).

### Install & run (Android)

```bash
# 1. Install JS dependencies
npm install

# 2. Generate the native projects + bundle the QVAC worker (Expo config plugins)
npx expo prebuild --clean

# 3. Plug in your phone (USB debugging on) and run a dev build on it
npx expo run:android --device
```

For iOS, swap step 3 for `npx expo run:ios --device`.

> The first launch of each feature downloads its model(s) — keep Wi-Fi on for that first run. After that, the app is fully offline. You can test it in airplane mode!

### Model footprint (downloaded once, cached)

| Feature | Model(s) | Approx. size |
|---|---|---|
| Translate | one Bergamot pair per direction | ~35 MB each |
| Voice in (Whisper STT) | Whisper base | ~82 MB |
| Voice out (Supertonic TTS) | Supertonic TTS | ~132 MB |
| Scan | Latin recognizer + CRAFT detector | ~98 MB |
| Phrasebook (RAG) | EmbeddingGemma-300M | ~278 MB |
| Assistant | SmolVLM2-500M + vision projection | ~900 MB |

### Share it with a non-developer (APK)

To hand the app to someone who just wants to *use* it (a judge, a friend), build an installable Android APK:

```bash
# Cloud build (easiest; needs a free Expo account) — produces a downloadable APK
npx eas build -p android --profile preview

# …or build locally without any cloud:
npx expo prebuild --clean
cd android && ./gradlew assembleRelease   # APK at android/app/build/outputs/apk/release/
```

**Prebuilt APK:** download the latest signed release from the repo's [Releases](https://github.com/prometheus-18/Wayfarer/releases) page (added at submission), enable "install unknown apps", tap to install.

Send them the APK; they enable "install unknown apps", tap it, and open **Wayfarer** — no dev tools needed. First run downloads the models over Wi-Fi, then it's offline forever.

---

## 🔒 Privacy & security

Everything runs on-device — no text, photo, or conversation ever leaves the phone. On top of that we add input sanitization and **prompt-injection resistance** (the assistant treats text inside scanned images as data to translate, never as commands). Tap the **"100% offline"** footer in-app to read the privacy summary and export the on-device inference log. Full threat model: [`SECURITY.md`](SECURITY.md). Remote-call disclosure: [`remote-apis.json`](remote-apis.json).

> 🏆 Hackathon judges: see [`SUBMISSION.md`](SUBMISSION.md) for the QVAC API mapping, reproducibility, and artifact checklist.

---

## 📁 Project structure

```
wayfarer/
├── App.tsx                     # Tab shell; keeps all 3 screens mounted
├── app.json                    # Expo config + QVAC/image-picker plugins + permissions
├── src/
│   ├── theme.ts                # Design tokens (colors, spacing, type, shadows)
│   ├── data/languages.ts       # Supported languages + flags
│   ├── hooks/useModelLoader.ts # Drives the model-download progress overlay
│   ├── qvac/                   # ── QVAC integration layer ──
│   │   ├── models.ts           #   feature → QVAC model descriptor mapping
│   │   ├── ModelManager.ts     #   load / cache / unload (RAM-safe)
│   │   ├── translate.ts        #   translateText() with English-pivot routing
│   │   ├── ocr.ts              #   scanImage()
│   │   ├── assistant.ts        #   askAssistant() (text + image, benchmark/simple-chat helper)
│   │   ├── agent.ts            #   runAgent() — tool-calling agent (live Assistant)
│   │   ├── rag.ts              #   phrasebook RAG (ingest / search)
│   │   ├── tts.ts              #   speak() — voice out (Supertonic TTS)
│   │   ├── transcribe.ts       #   transcribeAudio() — voice in (Whisper)
│   │   ├── queue.ts            #   per-engine FIFO request serialization
│   │   ├── security.ts         #   input sanitization + injection limits
│   │   ├── telemetry.ts        #   on-device audit log
│   │   ├── prefetch.ts         #   offline prepare (model prefetch)
│   │   ├── stress.ts           #   20-case on-device benchmark
│   │   └── image.ts            #   file:// → native path helper
│   ├── components/             # Card, Button, LanguagePicker, TabBar, overlays…
│   └── screens/                # TranslateScreen, ScanScreen, AssistantScreen
└── docs/ARCHITECTURE.md
```

---

## 🗺️ Roadmap

- [x] Voice input/output (QVAC `transcribe()` + `textToSpeech()`) — **shipped**
- [x] Phrasebook with offline semantic search (QVAC embeddings + RAG) — **shipped**
- [x] Tool-calling agent orchestrating translate/scan/phrasebook — **shipped**
- [ ] Live camera OCR overlay (translate in real time through the viewfinder)
- [ ] P2P "delegate to my laptop" for the heavy VLM (QVAC delegated inference)
- [ ] MedPsy traveler-health advisor mode
- [ ] More OCR scripts (Devanagari, CJK, Cyrillic, Arabic recognizers)

---

## 👥 Team

- **[@prometheus-18](https://github.com/prometheus-18)** — Rahul
- **[@KartikeyCode](https://github.com/KartikeyCode)** — Kartikey

Contributions follow a branch → PR flow — see [`CONTRIBUTING.md`](CONTRIBUTING.md).

## 📄 License

**Apache-2.0** — see [`LICENSE`](LICENSE). (Open source, as required by the hackathon.)

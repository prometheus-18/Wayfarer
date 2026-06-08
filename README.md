# 🧭 Wayfarer

**Your private, offline travel companion.** Translate text, scan signs & menus with the camera, and chat with a multimodal AI assistant — all running **100% on-device** with zero network calls. Built for the [**QVAC "Unleash Edge AI" hackathon**](https://dorahacks.io/hackathon/qvac-unleach-edge-ai-i/tracks) (**Mobile** track) on [Tether's QVAC SDK](https://docs.qvac.tether.io/).

> Flagship _and_ mid-range phones can deliver production-quality AI without sending a single byte to the cloud. Wayfarer proves it.

---

## ✨ Features

| | Feature | What it does | QVAC under the hood |
|---|---|---|---|
| 🗣️ | **Translate** | Offline neural translation across 16+ languages, streamed token-by-token. Non-English ↔ non-English pivots through English automatically. | `translate()` + Bergamot NMT models (`BERGAMOT_*`) |
| 📷 | **Scan** | Snap or pick a photo → on-device OCR extracts the text → translate it into your language. | `ocr()` + `OCR_LATIN_RECOGNIZER_1` & `OCR_CRAFT_DETECTOR` |
| 🧭 | **Assistant** | A warm, offline travel assistant. Ask anything, or attach a photo and let it reason about the scene + translate any text it sees. | `completion()` + `SMOLVLM2_500M` multimodal VLM |

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
   translateText()      scanImage()        askAssistant()
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

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for a deeper tour.

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
| Scan | Latin recognizer + CRAFT detector | ~98 MB |
| Assistant | SmolVLM2-500M + vision projection | ~900 MB |

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
│   │   ├── assistant.ts        #   askAssistant() (text + image)
│   │   └── image.ts            #   file:// → native path helper
│   ├── components/             # Card, Button, LanguagePicker, TabBar, overlays…
│   └── screens/                # TranslateScreen, ScanScreen, AssistantScreen
└── docs/ARCHITECTURE.md
```

---

## 🗺️ Roadmap

- [ ] Live camera OCR overlay (translate in real time through the viewfinder)
- [ ] Voice input/output (QVAC `transcribe()` + `textToSpeech()`)
- [ ] Phrasebook / offline favorites + history
- [ ] P2P "delegate to my laptop" for the heavy VLM (QVAC delegated inference)
- [ ] More OCR scripts (Devanagari, CJK, Cyrillic, Arabic recognizers)

---

## 👥 Team

- **[@prometheus-18](https://github.com/prometheus-18)** — Rahul
- **[@KartikeyCode](https://github.com/KartikeyCode)** — Kartikey

Contributions follow a branch → PR flow — see [`CONTRIBUTING.md`](CONTRIBUTING.md).

## 📄 License

See [`LICENSE`](LICENSE).

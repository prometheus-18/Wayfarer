# Wayfarer — QVAC Hackathon Submission

> Working submission notes for the **QVAC "Unleash Edge AI"** hackathon (build period June 1–21, 2026). Fill the `TODO` fields before submitting on DoraHacks.

## 0. BUIDL form answers (paste-ready)

> Copy these straight into the DoraHacks BUIDL form. (The form draft had a typo "Wayfare" — the correct name is **Wayfarer**.)

- **BUIDL name:** Wayfarer
- **One-liner:** A private, fully offline travel companion — translate, scan & translate signs/menus with the camera, and chat with a multimodal AI assistant, all on-device with zero cloud.
- **Vision:** Travelers abroad face a language barrier exactly when connectivity is worst and most expensive — no signal, roaming fees, or unwillingness to send photos of passports, menus, and private conversations to a cloud service. Wayfarer removes the trade-off: real-time translation, camera OCR, voice-to-voice, and a multimodal travel assistant that all run 100% on the phone via Tether's QVAC SDK, with zero bytes leaving the device (verifiable in airplane mode). Privacy-first edge AI that works where the cloud cannot.
- **Category:** AI / Robotics
- **Is this BUIDL an AI Agent?:** Yes — the Assistant is a genuine tool-calling agent (grammar-constrained JSON-schema routing across translate / scan_image / phrasebook / answer, deterministic dispatch, a visible tool trace, every call audit-logged). See `src/qvac/agent.ts` and [`docs/APP_GUIDE.md`](docs/APP_GUIDE.md).
- **GitHub:** https://github.com/prometheus-18/Wayfarer
- **Project website:** (optional — leave blank or use the GitHub URL)
- **Demo video:** _TODO — team records ≤5-min airplane-mode take; see [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md) and paste the unlisted YouTube link here and at §5._
- **Social links (≥1 required):** _TODO — team's X/LinkedIn/YouTube. Suggested build-in-public hashtags: #UnleashEdgeAI #QVAC #EdgeAI_
- **Logo:** `assets/logo-480.png` (480×480, generated from `icon.png`)

## 1. Product

**Name:** Wayfarer
**One-liner:** A private, fully offline travel companion — translate text, scan & translate signs/menus with the camera, and chat with a multimodal AI assistant, all running on-device with zero cloud.
**Track:** **Mobile** (retail Android/iOS smartphones only).
**Repo:** https://github.com/prometheus-18/Wayfarer (Apache-2.0)

## 2. Team

| Member | GitHub | Role | Background |
|---|---|---|---|
| Rahul | [@prometheus-18](https://github.com/prometheus-18) | _TODO_ | _TODO_ |
| Kartikey | [@KartikeyCode](https://github.com/KartikeyCode) | _TODO_ | _TODO_ |

- **Location:** _TODO_
- **Build-in-Public hashtag (X/YouTube):** _TODO_
- **Prior work disclosure:** Project bootstrapped from the default Expo `blank-typescript` template. All Wayfarer-specific code was written during the hackathon period. No other pre-existing code.

## 3. How Wayfarer uses the QVAC SDK

**100% of AI inference is QVAC, on-device.** No other AI provider is used. **Seven QVAC modalities** are wired:

| Feature | QVAC API | Model(s) | Notes |
|---|---|---|---|
| **Translate** | `loadModel()` → `translate({ modelType: "nmtcpp-translation" })` (streaming) | `BERGAMOT_<A>_<B>` (Bergamot NMT) | 49 languages; non-English↔non-English pivots through English (two NMT hops). |
| **Voice input (STT)** | `loadModel({ modelType: "whispercpp-transcription" })` → `transcribe()` | `WHISPER_BASE_Q8_0` (multilingual) | Mic → on-device Whisper → text, feeds Translate. |
| **Voice output (TTS)** | `loadModel({ modelType: "tts-ggml" })` → `textToSpeech()` | `TTS_EN_SUPERTONIC_Q4_0` / `TTS_MULTILINGUAL_SUPERTONIC2_Q4_0` | Int16 PCM → WAV → played via expo-audio. **Voice-to-voice translation** (en/es/de/it out). |
| **Scan (OCR)** | `loadModel({ modelType: "onnx-ocr", modelConfig: { detectorModelSrc } })` → `ocr()` | `OCR_LATIN_RECOGNIZER_1` + `OCR_CRAFT_DETECTOR` (ONNX Runtime) | Returns text blocks with bounding boxes + confidence; output feeds Translate/TTS. |
| **Assistant (VLM)** | `loadModel({ modelConfig: { projectionModelSrc } })` → `completion()` (multimodal, streaming) | `SMOLVLM2_500M_MULTIMODAL_Q8_0` + projection | Text + image-in chat; reads/translates text in photos. |
| **Agent (tool calling)** | `completion({ responseFormat: { type: "json_schema" } })` — grammar-constrained routing | same VLM | The assistant **orchestrates tools** (translate / scan / phrasebook) with a visible trace; every tool call is audit-logged. |
| **RAG (embeddings)** | `loadModel({ modelType: "llamacpp-embedding" })` → `ragIngest()` / `ragSearch()` | `EMBEDDINGGEMMA_300M_Q4_0` | 92-document offline travel phrasebook + city guides, semantically searchable; grounds the agent's answers. |

Supporting QVAC usage:
- **Model lifecycle:** `unloadModel()` with a custom `ModelManager` that keeps only one heavy model resident at a time (RAM-safe on phones); per-engine request queue (the worker replaces in-flight same-engine jobs).
- **Streaming:** `translate().tokenStream` and `completion().events` (`contentDelta`) drive token-by-token UI.
- **Performance stats:** `translate().stats`, `ocr().stats`, and `completion` `completionStats` events feed the auditable log **and a live perf HUD (TTFT / tokens-per-sec) on every screen** — the on-camera numbers match the exported log.
- **On-device benchmark:** a 20-case stress suite ships *in the app* (privacy footer → "Run on-device benchmark"): translation routing, 5,000-char inputs, burst + concurrency, sanitization, OCR on a bundled sample sign, assistant chat, **prompt-injection probe**, heavy-model thrash, TTS, RAG. Judges can reproduce our numbers with one tap.

All SDK calls live in [`src/qvac/`](src/qvac/). See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## 4. Reproducibility

**Hardware used in the demo:**
- Phone: **Xiaomi 11i (21091116I)** — MediaTek Dimensity 920 (MT6877V), **8 GB RAM**, 128 GB storage (arm64-v8a), Android **13** (MIUI V816)
- Dev machine: HP Pavilion Gaming 15-ec0xxx — AMD Ryzen 5 3550H, 14 GB RAM, Windows 11 Home (10.0.26200)
- _Attach screenshots: phone About screen + `adb shell getprop ro.product.model` + Windows system info._

**Run on a physical device (no emulators — QVAC requires real hardware):**
```bash
npm install
npx expo prebuild --clean
npx expo run:android --device     # or: npx expo run:ios --device
```
First use of each feature downloads its model over Wi-Fi (Translate ~35 MB · Whisper ~82 MB · TTS ~132 MB · Scan ~98 MB · RAG ~278 MB · Assistant ~900 MB); afterwards the app runs fully offline (demo it in airplane mode).

**Shareable APK (for judges to sideload):** `eas build -p android --profile preview` (see `eas.json`), or a local `cd android && ./gradlew assembleRelease`.

## 5. Required artifacts

- [ ] **Demo video (≤5 min, YouTube unlisted):** _TODO link_
- [x] **Remote API disclosure:** [`remote-apis.json`](remote-apis.json) — zero remote AI calls; only one-time model download.
- [x] **Auditable inference log:** exportable in-app (tap the "100% offline" footer → *Export log (JSON)*). Captures model loads/unloads, prompt preview, tokens, TTFT, tokens/sec. _Attach an exported `wayfarer-demo-log.json` from your demo run._
- [ ] **Hardware proof:** _TODO — screenshots of device + system profiler._
- [x] **Reproducibility instructions:** this file + [`README.md`](README.md).
- [x] **Open-source license:** Apache-2.0 ([`LICENSE`](LICENSE)).

## 6. Why it should win (mapping to judging criteria)

- **Innovation / UX:** beautiful, daily-use travel app; camera→OCR→translate chain; multimodal photo Q&A — all offline.
- **QVAC usage & coverage:** **seven** distinct QVAC modalities — NMT translation (streaming), Whisper STT, Supertonic TTS, ONNX OCR, SmolVLM2 multimodal VLM, grammar-constrained tool-calling Agent, and EmbeddingGemma RAG — plus streaming + lifecycle management.
- **Performance:** lightweight models chosen for phones; one-heavy-model-at-a-time memory policy; TTFT/TPS captured in the audit log.
- **Originality — security:** explicit prompt-injection resistance (read-don't-obey image text), input sanitization, on-device privacy. See [`SECURITY.md`](SECURITY.md).
- **Artifact quality:** structured remote-API manifest + exportable performance log + reproducible build.

## 7. Compliance checklist (mandatory requirements)

- [x] All AI inference uses the QVAC SDK
- [x] Within the Mobile track hardware constraints (retail smartphone)
- [x] Public GitHub repo under Apache-2.0  ← **make the repo public before judging**
- [x] Reproducibility instructions + hardware setup (fill TODOs)
- [x] Structured remote-API disclosure file
- [ ] Demo video + exported audit log attached
- [ ] Joined QVAC Discord & registered the project on DoraHacks with both teammates listed

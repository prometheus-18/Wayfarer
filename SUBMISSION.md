# Wayfarer — QVAC Hackathon Submission

> Working submission notes for the **QVAC "Unleash Edge AI"** hackathon (build period June 1–21, 2026). Fill the `TODO` fields before submitting on DoraHacks.

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

**100% of AI inference is QVAC, on-device.** No other AI provider is used. Three QVAC modalities are wired:

| Feature | QVAC API | Model(s) | Notes |
|---|---|---|---|
| **Translate** | `loadModel()` → `translate({ modelType: "nmtcpp-translation" })` (streaming) | `BERGAMOT_<A>_<B>` (Bergamot NMT) | 16+ languages; non-English↔non-English pivots through English (two NMT hops). |
| **Scan** | `loadModel({ modelConfig: { detectorModelSrc } })` → `ocr()` | `OCR_LATIN_RECOGNIZER_1` + `OCR_CRAFT_DETECTOR` (ONNX Runtime) | Returns text blocks with bounding boxes + confidence; output feeds Translate. |
| **Assistant** | `loadModel({ modelConfig: { projectionModelSrc } })` → `completion()` (multimodal, streaming) | `SMOLVLM2_500M_MULTIMODAL_Q8_0` + `MMPROJ_SMOLVLM2_500M_MULTIMODAL_Q8_0` | Text + image-in chat; reads/translates text in photos. |

Supporting QVAC usage:
- **Model lifecycle:** `unloadModel()` with a custom `ModelManager` that keeps only one heavy model resident at a time (RAM-safe on phones).
- **Streaming:** `translate().tokenStream` and `completion().events` (`contentDelta`) drive token-by-token UI.
- **Performance stats:** `translate().stats`, `ocr().stats`, and `completion` `completionStats` events feed the auditable log.

All SDK calls live in [`src/qvac/`](src/qvac/). See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## 4. Reproducibility

**Hardware used in the demo:** _TODO — fill device + specs:_
- Phone: _model_, _chipset_, _RAM_, _storage_, Android _version_
- Dev machine: _CPU / RAM / OS_ (+ screenshot of system profiler)

**Run on a physical device (no emulators — QVAC requires real hardware):**
```bash
npm install
npx expo prebuild --clean
npx expo run:android --device     # or: npx expo run:ios --device
```
First use of each feature downloads its model over Wi-Fi (Translate ~35 MB · Scan ~98 MB · Assistant ~900 MB); afterwards the app runs fully offline (demo it in airplane mode).

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
- **QVAC usage & coverage:** three distinct QVAC modalities (NMT, OCR/ONNX, multimodal VLM) + streaming + lifecycle management.
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

# Wayfarer — App Guide

What's inside the app, how each feature works, and what happens under the hood. Companion to [`ARCHITECTURE.md`](ARCHITECTURE.md) (code structure) and [`../SUBMISSION.md`](../SUBMISSION.md) (hackathon mapping).

**The one-line story:** everything below — speech recognition, translation, speech synthesis, OCR, a multimodal chat agent, semantic search — runs **entirely on the phone** through Tether's QVAC SDK. After the one-time model downloads, the app works in airplane mode. Nothing you type, say, or photograph ever leaves the device.

---

## The three tabs

### 🗣️ Translate

Type or **speak** ("Speak" button → Whisper transcribes on-device, auto-detecting the language), pick a language pair, hit Translate.

- **16+ languages.** Bergamot neural translation models, one ~35 MB model per direction, downloaded on first use and cached forever.
- **English pivot:** French → Spanish actually runs French → English → Spanish (two model hops) automatically — watch the perf chip report both.
- **Streaming:** tokens appear as they're generated.
- **Listen 🔊:** for English/Spanish/German/Italian targets, the phone speaks the translation aloud (Supertonic TTS, synthesized on-device to a WAV and played). Combined with Speak, that's **voice-to-voice translation with no cloud**.
- The ⚡ perf chip under the output shows the real timing of the last operation — the same numbers recorded in the audit log.

### 📷 Scan

Photograph (or pick) a sign, menu, or document.

1. A CRAFT text-detector finds text regions; a Latin recognizer reads them (both ONNX, ~98 MB together).
2. Recognized text appears in reading order — translate it with one tap, or have it spoken.
3. Latin-script text works best (the loaded recognizer is Latin-only).

Failures surface as an inline notice with a Retry button (and land in the audit log) — no vanishing popups.

### 🧭 Assistant — the Wayfarer Agent

A multimodal travel companion (SmolVLM2-500M vision-language model, ~900 MB) that **orchestrates tools** instead of just chatting:

1. **Route:** your question goes to the model with a grammar-constrained JSON schema — it must pick one of four actions: `translate`, `scan_image` (when a photo is attached), `phrasebook`, or `answer`. The grammar makes malformed output *impossible*.
2. **Dispatch:** the chosen tool runs deterministically in app code — the real translator, the real OCR pipeline, or a semantic search over the built-in phrasebook.
3. **Compose:** the model writes the final answer from the tool results, streamed into the chat.

You see the **tool trace** above each reply (e.g. `📖 phrasebook · 1.2s → 🌐 translate · 0.8s`), and every tool call is audit-logged.

**The phrasebook** is 92 curated documents (80 travel phrases in 5 languages across emergencies/dietary/transport/food/shopping/directions + Barcelona & Paris mini-guides), embedded on-device by EmbeddingGemma-300M and searched semantically (QVAC RAG). Ask *"how do I say I'm allergic to peanuts?"* and the agent retrieves the exact phrase card.

**Security:** text inside scanned images is treated as *data to translate, never commands* — photograph a sign saying "ignore all previous instructions" and the agent calmly translates it. Inputs are stripped of chat-template control tokens and invisible characters; suspected injection attempts are flagged in the audit log. See [`../SECURITY.md`](../SECURITY.md).

---

## The privacy footer (every tab)

Tap **"🔒 100% offline"**:

- **Privacy summary** — what runs where (everything: on-device).
- **Inference audit log** — every model load/unload and inference with prompt preview, token counts, TTFT, tokens/sec. Exportable as JSON; also mirrored continuously to a file so it survives restarts. This is the hackathon's required evidence artifact, generated live.
- **🧪 On-device benchmark** — a 20-case stress suite: translation routing, 5,000-char inputs, burst & concurrency, sanitization, OCR on a bundled sample sign, assistant chat, **prompt-injection probe**, heavy-model thrash, TTS, RAG search, capability probes. Optional heavy groups are opt-in (model download sizes shown). Results are exportable together with the audit log.

---

## What's downloaded when (Wi-Fi for first use, then offline)

| First use of… | Downloads | Size |
|---|---|---|
| Translate (per direction) | Bergamot pair | ~35 MB |
| Speak (voice input) | Whisper base | ~82 MB |
| Listen (voice output) | Supertonic TTS | ~132 MB |
| Scan | OCR detector + recognizer | ~98 MB |
| Assistant / Agent | SmolVLM2 + projection | ~900 MB |
| Phrasebook search | EmbeddingGemma | ~278 MB |

RAM safety: OCR and the assistant VLM are **mutually exclusive** — loading one unloads the other, so a mid-range phone never holds two heavy models. Light models (translation pairs, Whisper, TTS) stay cached for instant reuse. Concurrent requests to the same engine are queued FIFO (the native worker would otherwise cancel the in-flight job).

## Performance on the demo phone (Xiaomi 11i, 8 GB, Dimensity 920)

- Warm translation: **~0.2 s per request** (burst average), 1.1 s for the first request after app start
- 5,000-character translation: **610–680 chars/sec**
- OCR on a sign photo: 100% of text recognized; ~16 s cold including model load
- TTS: ~2.4 s warm model load; synthesis streams to playback

(Reproduce with the in-app benchmark; methodology in [`../ARTIFACTS.md`](../ARTIFACTS.md).)

## For developers

- Architecture and layering rules: [`ARCHITECTURE.md`](ARCHITECTURE.md) — UI → `src/qvac/` service layer → `@qvac/sdk` → native Bare worker.
- Build/run: [`../README.md`](../README.md#-getting-started). Physical device required (no emulators).
- Dev tricks: wireless adb + Metro over `adb reverse`; the stress suite can be triggered from the dev box via `src/dev/autobench.ts` (results stream to Metro logs as `[BENCH]` lines).

# Architecture

A short tour of how Wayfarer is put together and how it uses the QVAC SDK.

## Layers

```
UI (screens)  →  service layer (src/qvac)  →  @qvac/sdk  →  Bare worker (native inference)
```

1. **Screens** (`src/screens/*`) own UI state only. They call the app-level async helpers (`translateText()`, `scanImage()`, `runAgent()`, `transcribeAudio()`, …) and render the results (with streaming). The live **AssistantScreen** calls `runAgent()` — the grammar-constrained tool-calling agent — not `askAssistant()` (which remains only as the benchmark/simple-chat helper).
2. **Service layer** (`src/qvac/*`) is the *only* code that imports `@qvac/sdk`. It owns model selection, loading, RAM management, and turns SDK primitives into app-friendly functions.
3. **`@qvac/sdk`** runs on the React Native JS side as a thin client and forwards work over RPC to…
4. **`react-native-bare-kit`**, which hosts a Bare worker bundling the native C++ engines (llama.cpp, Bergamot NMT, ONNX Runtime). This is where inference actually happens. The `@qvac/sdk/expo-plugin` generates this worker bundle during `expo prebuild`.

## Model management (`ModelManager.ts`)

Mobile RAM is the key constraint, so the manager:

- **Caches** loaded models by a logical key and dedupes concurrent loads via an in-flight promise map.
- Treats **translation** models as lightweight (~35 MB) and keeps every loaded direction around for instant reuse.
- Treats **OCR** (~98 MB) and the **assistant VLM** (~900 MB) as *heavy* and **mutually exclusive** — loading one unloads the other, so we never hold two big models at once.
- Surfaces download progress through an `onProgress` callback that the UI renders as an overlay.

## Feature → SDK mapping

| Helper | SDK call | Model constants |
|---|---|---|
| `translateText()` | `loadModel()` → `translate({ modelType: "nmtcpp-translation" })` | `BERGAMOT_<FROM>_<TO>` |
| `transcribeAudio()` | `loadModel({ modelType: "whispercpp-transcription" })` → `transcribe()` | `WHISPER_BASE_Q8_0` |
| `speak()` | `loadModel({ modelType: "tts-ggml", modelConfig: { ttsEngine: "supertonic", language } })` → `textToSpeech()` → WAV → expo-audio | `TTS_EN_SUPERTONIC_Q4_0`, `TTS_MULTILINGUAL_SUPERTONIC2_Q4_0` |
| `scanImage()` | `loadModel({ modelType: "onnx-ocr", modelConfig: { detectorModelSrc } })` → `ocr()` | `OCR_LATIN_RECOGNIZER_1`, `OCR_CRAFT_DETECTOR` |
| `askAssistant()` | `loadModel({ modelConfig: { projectionModelSrc } })` → `completion()` | `SMOLVLM2_500M_MULTIMODAL_Q8_0`, `MMPROJ_SMOLVLM2_500M_MULTIMODAL_Q8_0` |
| `runAgent()` *(live Assistant)* | `completion({ responseFormat: { type: "json_schema" } })` route → dispatch tools → `completion()` compose | same VLM (router + composer) |

> The live **AssistantScreen** uses `runAgent()` (tool-calling agent). `askAssistant()` is the simpler single-shot chat helper, retained only for the in-app benchmark.
| `searchPhrases()` | `loadModel({ modelType: "llamacpp-embedding" })` → `ragIngest()` / `ragSearch()` | `EMBEDDINGGEMMA_300M_Q4_0` |

### Request serialization

The Bare worker **replaces an in-flight job when a new request arrives for the
same engine** ("Stale job replaced by new run"). `src/qvac/queue.ts#enqueue`
gives each engine a FIFO chain; every service helper routes its inference
through it. Keep using the same queue key per engine (`translate`, `ocr`,
`assistant`, `transcribe`, `tts`, `embed`).

### Stress suite

`src/qvac/stress.ts` is a 20-case on-device benchmark (translation routing,
max-length, burst/concurrency, sanitization, OCR sample sign, assistant,
injection probe, model thrash, TTS, RAG, capability probes). Run it from the
privacy footer → "Run on-device benchmark", or from the dev box by flipping
`src/dev/autobench.ts` (results stream to Metro logs with a `[BENCH]` prefix).

### Translation routing

Bergamot models are English-pivot. `routeFor(from, to)` returns:
- `[]` if `from === to`
- one hop if either side is English
- two hops (`from → en`, `en → to`) otherwise

Each hop streams tokens; only the final hop is surfaced to the UI.

### Images

QVAC's native worker reads images and chat attachments from an **absolute filesystem path**. The pickers give us `file://…` URIs, so `image.ts#toModelPath()` strips the scheme (and URL-decodes) before handing the path to `ocr()` or a `completion` attachment (`{ path }`).

## Conventions

- Keep all SDK usage inside `src/qvac/`.
- Route every model load through `ModelManager`.
- Use `theme.ts` tokens — no hard-coded styles.
- Strict TypeScript; verify with `npx tsc --noEmit`.

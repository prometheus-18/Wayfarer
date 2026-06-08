# Architecture

A short tour of how Wayfarer is put together and how it uses the QVAC SDK.

## Layers

```
UI (screens)  →  service layer (src/qvac)  →  @qvac/sdk  →  Bare worker (native inference)
```

1. **Screens** (`src/screens/*`) own UI state only. They call three async helpers and render the results (with streaming).
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
| `scanImage()` | `loadModel({ modelConfig: { detectorModelSrc } })` → `ocr()` | `OCR_LATIN_RECOGNIZER_1`, `OCR_CRAFT_DETECTOR` |
| `askAssistant()` | `loadModel({ modelConfig: { projectionModelSrc } })` → `completion()` | `SMOLVLM2_500M_MULTIMODAL_Q8_0`, `MMPROJ_SMOLVLM2_500M_MULTIMODAL_Q8_0` |

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

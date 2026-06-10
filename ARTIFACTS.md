# Wayfarer — Evidence & Verification Pack

How to verify that everything in our demo video really ran on-device, and how to reproduce the numbers yourself. (Hackathon validation stages 1–3.)

## The three mutually-consistent artifacts

| Artifact | Where it comes from | What to check |
|---|---|---|
| `wayfarer-demo-log.json` | Exported in-app right after the demo take (privacy footer → *Export log*) | Every inference shown in the video has a row: `ts`, `kind`, `model`, `promptPreview`, `tokens`, `ttftMs`, `tokensPerSec`, `totalMs`. `remoteInferenceCalls: 0`. |
| `wayfarer-benchmark.json` | The in-app 20-case stress suite (privacy footer → *Run on-device benchmark* → *Export*) | `device` block matches the hardware claims below; per-case `ms` figures are the same order of magnitude as the video. |
| Demo video (≤ 5 min, unlisted YouTube) | One uninterrupted take in airplane mode | The on-screen **perf HUD** (TTFT / tok/s chips) shows the *same* numbers that appear in the exported log — they are fed by the same `telemetry.ts` rows. |

The audit log also **persists across crashes/restarts**: every row is mirrored to
`<documentDirectory>/wayfarer-audit-log.json` as it is written.

## Demo-run cross-reference (fill from the final take)

| Video time | What happens on screen | Log evidence (`kind` / `model`) | Benchmark case |
|---|---|---|---|
| _TODO_ | Airplane mode on, app opens | — | — |
| _TODO_ | Voice → text (Whisper) | `transcribe` / `whisper:base` | — |
| _TODO_ | en→es translation streams | `translate` / `nmt:en-es` | `t-basic` |
| _TODO_ | Phone speaks the translation (TTS) | `tts` / `tts:supertonic-es` | `f-tts` |
| _TODO_ | Menu photo scanned (OCR) | `ocr` / `ocr:latin` | `o-sample` |
| _TODO_ | Agent routes: scan → translate → phrasebook | `agent_tool` ×N + `assistant` | `f-agent` |
| _TODO_ | Injection sign scanned, calmly translated | `assistant` (`injectionFlagged: true`) | `a-injection` |
| _TODO_ | Benchmark suite runs on camera | `benchmark` rows | all |

## Hardware claims

- **Phone:** Xiaomi 11i `21091116I` — MediaTek Dimensity 920 (MT6877V), 8 GB RAM, Android 13 (MIUI V816), arm64-v8a.
- **Dev machine (build only, no inference):** HP Pavilion Gaming 15 — Ryzen 5 3550H, 14 GB RAM, Windows 11.

Verify the phone yourself over adb:

```bash
adb shell getprop ro.product.model        # 21091116I
adb shell getprop ro.soc.model            # MT6877V/TZA
adb shell head -1 /proc/meminfo           # MemTotal ≈ 7.6 GB
adb shell getprop ro.build.version.release # 13
```

## Reproduce our numbers (10 minutes, no dev tools on the phone)

1. Build & install per [`SUBMISSION.md`](SUBMISSION.md) §4 (or sideload the release APK).
2. First run of each feature downloads its model over Wi-Fi; then enable **airplane mode**.
3. Tap the **"100% offline"** footer → **Run on-device benchmark**. Enable the OCR + Assistant groups for the full 20-case suite (downloads happen before airplane mode).
4. Compare your exported `wayfarer-benchmark.json` with ours — same device class ⇒ same order of magnitude.

## Independently observed performance (Xiaomi 11i, wireless adb session, 2026-06-11)

From real benchmark runs during development (Metro-logged, reproducible):

| Case | Result |
|---|---|
| Translate en→es (warm) | ~0.6–1.1 s/request; burst avg ~173–196 ms |
| Pivot fr→es (two NMT hops) | ~1.0–1.3 s |
| 5,000-char input | 610–681 chars/sec |
| 3 concurrent requests | serialized correctly, ~0.4–0.7 s total |
| OCR sample sign (5 blocks, cold) | ~16–18 s incl. 98 MB model load; text 100% recognized |
| OCR → translate pipeline | ~16 s end-to-end (cold) |
| TTS addon load (132 MB, cold) | ~17 s download + load; ~2.4 s warm |

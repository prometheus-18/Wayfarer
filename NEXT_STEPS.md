# Wayfarer — Day 1 wrap-up & next steps

_Last updated: 2026-06-09._

## ✅ Where we are

- **App builds, installs, and runs on a real device** (Xiaomi Mi 11i, Android, arm64).
- Full Android toolchain installed on the dev PC (JDK 17, Android SDK 36, build-tools 36, **NDK r27 + r29**, CMake) and env vars persisted (`ANDROID_HOME`, `JAVA_HOME`, `PATH`).
- Debug build → `BUILD SUCCESSFUL`. Standalone **release APK** also builds and was installed on the phone over Wi-Fi.
- All three screens (Translate / Scan / Assistant), the QVAC service layer, security hardening, audit log, and submission docs are committed on `main`.

## 🐞 Known bugs (found in first on-device test) — fix tomorrow

> We don't have the exact error text yet. **First task tomorrow: reproduce each bug and capture the on-screen error Alert (screenshot) + export the in-app audit log** (tap the "100% offline" footer → Export log). That gives us the real failure messages to work from, since the release APK has no Metro red-box.

1. **Translate doesn't work.** Likely suspects, in order:
   - `translateText()` awaits `result.stats` *after* consuming the token stream (`src/qvac/translate.ts`). If `stats` never resolves, the call hangs and no result shows. **Fix:** make telemetry fire-and-forget (don't `await` stats in the request path; `.then().catch()` it).
   - Bergamot model may not be loading/downloading on device — check the loading overlay actually appears and completes.
   - Verify `modelType: "nmtcpp-translation"` returns tokens for `BERGAMOT_EN_*`.
2. **Scan / camera bugged.** Likely suspects:
   - Image path handed to `ocr()` — `toModelPath()` strips `file://`; the native worker may need the raw `file://`, or a copied app-local path, or base64. **Test all three.** (`src/qvac/image.ts`, `src/qvac/ocr.ts`)
   - Same `await stats` hang risk as Translate (`ocr.ts` awaits `stats`).
   - `expo-image-picker` result handling / permissions on MIUI.
   - OCR model load with `detectorModelSrc` companion may be failing.
3. **Assistant** — re-test once Translate/Scan are fixed (shares model-load + image-path code paths).
4. **General** — improve in-app error visibility (show the actual error string prominently) so we can debug without Metro.

## 🔁 How to resume (environment is already set up)

```powershell
# Env vars persist across reboots (ANDROID_HOME, JAVA_HOME, PATH already set).
# Rebuild the debug app:
npx expo run:android            # needs phone on adb (see USB note)

# Or rebuild the standalone release APK (no Metro needed):
cd android ; ./gradlew :app:assembleRelease     # -> android/app/build/outputs/apk/release/app-release.apk
```

- **USB note (big time-saver):** the dev phone is a **Xiaomi Mi 11i with no SIM**, so MIUI's "Install via USB" can't be enabled → `adb install` fails with `INSTALL_FAILED_USER_RESTRICTED`. The USB cable was also flaky (dropped mid-transfer). **Get a reliable USB-C data cable** so we can use `adb`, `adb logcat`, and Metro fast-refresh — that unblocks fast iteration. Until then, deliver via APK.
- **APK delivery to phone (no cable):** serve the APK and tunnel it out (LAN is blocked by the Public-network firewall):
  ```powershell
  python -m http.server 8000 --bind 127.0.0.1 --directory C:\Users\hp\wayfarer\dist-apk
  & "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://localhost:8000
  # -> phone opens https://<random>.trycloudflare.com/Wayfarer.apk
  ```
- **Local-only build tweak:** `android/gradle.properties` has minify/shrink turned **off** (for a guaranteed-working build). `android/` is git-ignored, so this isn't committed. Re-enable both for the final, slimmed submission build.

## 📋 Tomorrow's task list (prioritized)

1. **Diagnose** — reproduce Translate + Scan bugs, capture error Alerts + audit-log export.
2. **Fix telemetry hang** — stop `await`ing `result.stats` / `ocr().stats` in the request path (fire-and-forget).
3. **Fix Translate** end-to-end (model load + streaming + result render).
4. **Fix Scan** — nail the image-path format the OCR worker accepts; verify model load.
5. **Re-test Assistant** (text + image).
6. **Error UX** — surface real error messages in-app for cable-free debugging.
7. **Rebuild + redeliver** APK; smoke-test all 3 features, then verify **airplane-mode offline**.
8. **Slim the APK** for submission — arm64-only ABI filter + re-enable minify with QVAC proguard rules.
9. (If time) get a good USB cable → switch to `expo run:android` + logcat for faster loops.

## 👥 For KartikeyCode
Pull `main`, read `CONTRIBUTING.md` + `docs/ARCHITECTURE.md`. The buggy areas above are all in `src/qvac/` and `src/screens/`. Pick a bug, branch (`fix/...`), PR.

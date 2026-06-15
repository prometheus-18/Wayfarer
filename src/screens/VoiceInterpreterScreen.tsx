/**
 * Wayfarer — live voice interpreter (single-screen app).
 *
 * One-way auto-loop: tap the orb → speak → it auto-stops on silence (VAD) →
 * Whisper transcribes → langdetect picks your source language → Bergamot
 * translates to your chosen target → the translation is shown big (and spoken
 * aloud when on-device TTS is available) → it listens again for your next line.
 *
 * Everything runs on-device. A live frequency spectrum reacts to your voice;
 * fireflies drift behind. Text is always shown as a fallback.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  useAudioStream,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  type AudioStreamBuffer,
} from 'expo-audio';
import { computeBands, rms } from '../audio/spectrum';
import { getLanguage, type Language } from '../data/languages';
import { translateText } from '../qvac/translate';
import { transcribePcm } from '../qvac/transcribe';
import { ensureTranscribeModel } from '../qvac/ModelManager';
import { stopSpeaking } from '../qvac/tts';
import { logEvent } from '../qvac/telemetry';
import { useDownloadProgress } from '../hooks/useModelLoader';
import { colors, radius, spacing, typography } from '../theme';
import { Notice, ProgressBar } from '../components/ui';
import { LanguageChip, LanguagePicker } from '../components/LanguagePicker';
import { FirefliesBackground } from '../components/FirefliesBackground';
import { VoiceSpectrum } from '../components/VoiceSpectrum';

const ACCENT = colors.translate;
const BANDS = 24;
// VAD on mono int16 PCM. Any audio above VOICE_RMS counts as speech; once
// we've heard speech, VOICE_RMS staying below for SILENCE_SEC auto-stops.
// Kept low so quiet speakers still arm it; manual tap + hard-stop are backups.
const VOICE_RMS = 0.045;
const SILENCE_SEC = 1.0; // auto-stop this long after speech ends
const LEVEL_FPS_SEC = 0.035; // throttle spectrum state updates (~28fps)

type Phase = 'idle' | 'listening' | 'thinking' | 'speaking';

const PHASE_LABEL: Record<Phase, string> = {
  idle: 'Tap to speak',
  listening: 'Listening…',
  thinking: 'Translating…',
  speaking: 'Speaking…',
};

export function VoiceInterpreterScreen({ active = true }: { active?: boolean }) {
  const [fromLang, setFromLang] = useState('en'); // language you speak
  const [toLang, setToLang] = useState('es'); // language to translate into
  const [phase, setPhase] = useState<Phase>('idle');
  const [transcript, setTranscript] = useState('');
  const [translation, setTranslation] = useState('');
  const [levels, setLevels] = useState<number[]>([]);
  const [picker, setPicker] = useState<'from' | 'to' | null>(null);
  const [errorNotice, setErrorNotice] = useState<{ title: string; detail?: string } | null>(null);

  const { state: download, onProgress, reset: resetDownload } = useDownloadProgress();

  // Audio-thread state lives in refs: onBuffer is captured once by the native
  // stream and must not close over stale React state.
  const capturingRef = useRef(false); // accumulate PCM only between start/finish
  const pcmChunksRef = useRef<Int16Array[]>([]);
  const pcmCountRef = useRef(0);
  const sampleRateRef = useRef(16000);
  const loopRef = useRef(false);
  const hadVoiceRef = useRef(false);
  const lastVoiceTsRef = useRef(0);
  const lastLevelTsRef = useRef(0);
  const finishingRef = useRef(false);
  const finishTurnRef = useRef<() => void>(() => {});
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toLangRef = useRef(toLang);
  toLangRef.current = toLang;
  const fromLangRef = useRef(fromLang);
  fromLangRef.current = fromLang;

  const MAX_SECONDS = 30; // hard cap per utterance

  const handleBuffer = useCallback((buffer: AudioStreamBuffer) => {
    try {
      // Guard against an odd/misaligned native ArrayBuffer (Int16Array would
      // throw RangeError, which would silently kill the stream callback).
      const buf = buffer.data;
      const usable = buf.byteLength - (buf.byteLength % 2);
      if (usable <= 0) return;
      const samples = new Int16Array(buf, 0, usable / 2);
      // Use a JS clock — native buffer.timestamp can be 0/undefined/non-monotonic,
      // which would break the silence timer and freeze the turn.
      const now = Date.now() / 1000;

      // Spectrum (throttled to keep React state updates sane).
      if (now - lastLevelTsRef.current > LEVEL_FPS_SEC) {
        lastLevelTsRef.current = now;
        setLevels(computeBands(samples, BANDS));
      }

      if (!capturingRef.current) return;
      sampleRateRef.current = buffer.sampleRate || 16000;

      // Accumulate a COPY of the PCM for whole-clip transcription on stop.
      if (pcmCountRef.current < sampleRateRef.current * MAX_SECONDS) {
        pcmChunksRef.current.push(samples.slice());
        pcmCountRef.current += samples.length;
      }

      // Voice-activity detection → auto-stop on trailing silence.
      const energy = rms(samples);
      if (energy > VOICE_RMS) {
        hadVoiceRef.current = true;
        lastVoiceTsRef.current = now;
      }
      if (
        hadVoiceRef.current &&
        !finishingRef.current &&
        now - lastVoiceTsRef.current > SILENCE_SEC
      ) {
        finishingRef.current = true;
        finishTurnRef.current();
      }
    } catch {
      // A bad buffer must never kill the capture stream.
    }
  }, []);

  const { stream } = useAudioStream({
    sampleRate: 16000,
    channels: 1,
    encoding: 'int16',
    onBuffer: handleBuffer,
  });

  const startTurn = useCallback(async () => {
    hadVoiceRef.current = false;
    lastVoiceTsRef.current = Date.now() / 1000;
    lastLevelTsRef.current = 0;
    finishingRef.current = false;
    pcmChunksRef.current = [];
    pcmCountRef.current = 0;
    setTranscript('');
    setTranslation('');
    setErrorNotice(null);
    setPhase('listening');
    // Warm the Whisper model for the selected source language so it's resident
    // by the time the user finishes speaking (deduped by ModelManager).
    void ensureTranscribeModel(fromLangRef.current, onProgress).catch(() => {});
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      capturingRef.current = true;
      await stream.start();
      // Hard-stop safety net: always finalize after MAX_SECONDS even if the
      // silence VAD never fires (noisy room / quiet speaker).
      if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
      maxTimerRef.current = setTimeout(() => {
        if (capturingRef.current && !finishingRef.current) {
          finishingRef.current = true;
          finishTurnRef.current();
        }
      }, MAX_SECONDS * 1000);
    } catch (error) {
      loopRef.current = false;
      capturingRef.current = false;
      setPhase('idle');
      setErrorNotice({ title: 'Could not start listening', detail: String((error as Error)?.message ?? error) });
    }
  }, [onProgress, stream]);

  const finishTurn = useCallback(async () => {
    if (!capturingRef.current) return;
    capturingRef.current = false;
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
    try {
      stream.stop();
    } catch {
      // already stopped
    }
    setLevels([]);
    setPhase('thinking');

    // Assemble the captured PCM into one buffer.
    const chunks = pcmChunksRef.current;
    pcmChunksRef.current = [];
    const total = pcmCountRef.current;
    pcmCountRef.current = 0;

    // Transcribe whenever we captured a usable amount of audio (~0.3s+).
    if (total > sampleRateRef.current * 0.3) {
      const pcm = new Int16Array(total);
      let offset = 0;
      for (const c of chunks) {
        pcm.set(c, offset);
        offset += c.length;
      }
      const from = fromLangRef.current;
      const to = toLangRef.current;
      try {
        const said = await transcribePcm(pcm, sampleRateRef.current, from, onProgress);
        if (said) {
          setTranscript(said);
          const result = await translateText({ text: said, from, to, onToken: setTranslation });
          setTranslation(result);
          logEvent({ kind: 'translate', model: `nmt:${from}-${to}`, prompt: said, extra: { source: 'voice-live' } });
        } else {
          // Whisper returned nothing — tell the user instead of silently idling.
          setErrorNotice({ title: 'No speech detected', detail: 'Tap and speak a little louder.' });
        }
      } catch (error) {
        setErrorNotice({ title: 'Could not process speech', detail: String((error as Error)?.message ?? error) });
      } finally {
        resetDownload();
      }
    } else {
      setErrorNotice({ title: "Didn't catch that", detail: 'Tap the orb and speak a bit longer.' });
    }

    // Simple one-shot: show the translation and stop. The user taps again for
    // the next phrase (no auto-re-listen).
    finishingRef.current = false;
    loopRef.current = false;
    setPhase('idle');
  }, [stream, onProgress, resetDownload]);

  useEffect(() => {
    finishTurnRef.current = () => void finishTurn();
  }, [finishTurn]);

  // Stop capture if the screen unmounts mid-session.
  useEffect(() => {
    return () => {
      loopRef.current = false;
      capturingRef.current = false;
      if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
      try {
        stream.stop();
      } catch {
        // ignore
      }
      stopSpeaking();
    };
  }, [stream]);

  // Tabs never unmount (App keeps every screen mounted), so when this one is
  // navigated away from we must release the mic ourselves: abandon any capture
  // in progress (no background inference for a screen the user has left) and
  // stop playback so the global audio session isn't held in record mode.
  useEffect(() => {
    if (active) return;
    loopRef.current = false;
    capturingRef.current = false;
    finishingRef.current = false;
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
    try {
      stream.stop();
    } catch {
      // already stopped
    }
    pcmChunksRef.current = [];
    pcmCountRef.current = 0;
    setLevels([]);
    setPhase('idle');
    stopSpeaking();
  }, [active, stream]);

  const onToggle = async () => {
    // While listening, a tap ends the loop AND finalizes the current utterance
    // (transcribe + translate) — never discard what was said.
    if (phase === 'listening') {
      loopRef.current = false;
      if (capturingRef.current && !finishingRef.current) {
        finishingRef.current = true;
        finishTurnRef.current();
      }
      return;
    }
    // Mid-translation / speaking → just stop.
    if (phase !== 'idle') {
      loopRef.current = false;
      stopSpeaking();
      setPhase('idle');
      return;
    }
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Microphone needed', 'Enable microphone access to speak.');
      return;
    }
    loopRef.current = true;
    void startTurn();
  };

  const onPickLanguage = (language: Language) => {
    if (picker === 'from') setFromLang(language.code);
    if (picker === 'to') setToLang(language.code);
  };

  const busy = phase !== 'idle';
  const target = getLanguage(toLang);
  const downloading = download.visible;

  return (
    <View style={styles.container}>
      <FirefliesBackground accent={ACCENT} intensity={busy ? 1 : 0.6} />

      <View style={styles.header}>
        <Text style={styles.title}>Wayfarer</Text>
        <Text style={styles.subtitle}>Offline AI Translator</Text>
      </View>

      {/* Language bar: you speak (source) → translate to (target) */}
      <View style={styles.langBar}>
        <LanguageChip code={fromLang} accent={ACCENT} onPress={() => setPicker('from')} />
        <Text style={styles.arrow}>→</Text>
        <LanguageChip code={toLang} accent={ACCENT} onPress={() => setPicker('to')} />
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* The orb: spectrum + tap target */}
        <Pressable onPress={onToggle} style={styles.orbWrap}>
          <View style={[styles.orb, busy && styles.orbActive]}>
            <VoiceSpectrum levels={levels} color={ACCENT} active={phase === 'listening'} height={150} />
          </View>
          <Text style={[styles.phaseLabel, busy && styles.phaseLabelActive]}>
            {PHASE_LABEL[phase]}
          </Text>
          <Text style={styles.hint}>
            {phase === 'idle' ? `Speak in ${getLanguage(fromLang).label}` : 'Tap to stop'}
          </Text>
        </Pressable>

        {downloading ? (
          <View style={styles.downloadCard}>
            <Text style={styles.downloadTitle}>Preparing on-device models</Text>
            <ProgressBar value={download.percentage} color={ACCENT} />
            <Text style={styles.downloadDetail}>
              {Math.round(download.percentage)}%{download.detail ? `  ·  ${download.detail}` : ''}
            </Text>
          </View>
        ) : null}

        {errorNotice ? (
          <Notice
            tone="error"
            title={errorNotice.title}
            detail={errorNotice.detail}
            onDismiss={() => setErrorNotice(null)}
          />
        ) : null}

        {/* Transcript (what you said) */}
        {transcript ? (
          <View style={styles.youCard}>
            <Text style={styles.cardLabel}>You said</Text>
            <Text style={styles.youText}>{transcript}</Text>
          </View>
        ) : null}

        {/* Translation (the headline) */}
        <View style={[styles.outCard, translation ? styles.outCardFilled : null]}>
          <Text style={styles.cardLabel}>{target.label}</Text>
          {translation ? (
            <Text selectable style={styles.outText}>
              {translation}
            </Text>
          ) : (
            <Text style={styles.outPlaceholder}>
              Your translation appears here — spoken and shown, entirely offline.
            </Text>
          )}
        </View>
      </ScrollView>

      <LanguagePicker
        visible={picker !== null}
        title={picker === 'from' ? 'You speak' : 'Translate to'}
        selectedCode={picker === 'from' ? fromLang : toLang}
        accent={ACCENT}
        onSelect={onPickLanguage}
        onClose={() => setPicker(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    alignItems: 'center',
  },
  title: { ...typography.display, color: colors.text, textAlign: 'center' },
  subtitle: { ...typography.body, color: colors.textMuted, marginTop: 2, textAlign: 'center' },
  langBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sourcePill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sourceLabel: { ...typography.label, color: colors.textMuted },
  arrow: { fontSize: 18, color: ACCENT, fontWeight: '800' },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  orbWrap: { alignItems: 'center', paddingVertical: spacing.lg },
  orb: {
    width: '100%',
    borderRadius: radius.xl,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  orbActive: {
    borderColor: ACCENT,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 10,
  },
  phaseLabel: { ...typography.title, color: colors.textMuted, marginTop: spacing.lg, fontWeight: '700' },
  phaseLabelActive: { color: colors.text },
  hint: { ...typography.caption, color: colors.textFaint, marginTop: 4 },
  downloadCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  downloadTitle: { ...typography.label, color: colors.text },
  downloadDetail: { ...typography.caption, color: colors.textMuted },
  youCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardLabel: { ...typography.label, color: colors.textMuted, textTransform: 'uppercase', marginBottom: 6 },
  youText: { ...typography.body, color: colors.textMuted, fontStyle: 'italic' },
  outCard: {
    minHeight: 120,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  outCardFilled: { borderColor: ACCENT },
  outText: { ...typography.display, fontSize: 26, fontWeight: '700', color: colors.text, lineHeight: 34 },
  outPlaceholder: { ...typography.body, color: colors.textFaint },
});

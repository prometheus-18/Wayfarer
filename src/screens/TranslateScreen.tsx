import React, { useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import { getLanguage, type Language } from '../data/languages';
import { translateText } from '../qvac/translate';
import { transcribeAudio } from '../qvac/transcribe';
import { isSpeaking, isTtsLanguage, speak, stopSpeaking } from '../qvac/tts';
import { logEvent } from '../qvac/telemetry';
import { useModelLoader } from '../hooks/useModelLoader';
import { colors, glow, radius, spacing, typography } from '../theme';
import { Button, Card, ModelLoadingOverlay, Notice, SectionLabel } from '../components/ui';
import { PerfChip } from '../components/PerfChip';
import { LanguageChip, LanguagePicker } from '../components/LanguagePicker';
import { PrivacyFooter } from '../components/PrivacyFooter';
import { PrepareOfflineSheet } from '../components/PrepareOfflineSheet';

const ACCENT = colors.translate;

type VoiceStage = 'idle' | 'listening' | 'transcribing';

export function TranslateScreen() {
  const [from, setFrom] = useState('en');
  const [to, setTo] = useState('es');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [translating, setTranslating] = useState(false);
  const [picker, setPicker] = useState<'from' | 'to' | null>(null);
  const [voiceStage, setVoiceStage] = useState<VoiceStage>('idle');
  const [speaking, setSpeaking] = useState(false);
  const [autoPlay, setAutoPlay] = useState(true);
  const [errorNotice, setErrorNotice] = useState<{ title: string; detail?: string } | null>(null);
  const [prepareOpen, setPrepareOpen] = useState(false);

  const { state: loadState, begin, end, onProgress } = useModelLoader();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recordingRef = useRef(false);
  const autoStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const recording = voiceStage === 'listening';
  const transcribing = voiceStage === 'transcribing';
  const busy = translating || transcribing;

  const fail = (title: string, error: unknown) => {
    const detail = String((error as Error)?.message ?? error);
    setErrorNotice({ title, detail });
    logEvent({ kind: 'error', model: 'translate', extra: { title, message: detail } });
  };

  const runTranslate = async (text: string, speakWhenDone: boolean) => {
    const trimmed = text.trim();
    if (!trimmed || translating) return;
    stopSpeaking();
    setSpeaking(false);
    setTranslating(true);
    setOutput('');
    setErrorNotice(null);
    begin();
    try {
      const result = await translateText({
        text: trimmed,
        from,
        to,
        onProgress,
        onToken: setOutput,
      });
      setOutput(result);
      if (speakWhenDone && autoPlay && result && isTtsLanguage(to)) {
        void playOutput(result);
      }
    } catch (error) {
      fail('Translation failed', error);
    } finally {
      end();
      setTranslating(false);
    }
  };

  const startRecording = async () => {
    if (busy || recording) return;
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Microphone needed', 'Enable microphone access to dictate text.');
      return;
    }
    stopSpeaking();
    setSpeaking(false);
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    recordingRef.current = true;
    setVoiceStage('listening');
    // Cap clip length: Whisper runs near real-time, so a long clip = a long wait.
    if (autoStopTimer.current) clearTimeout(autoStopTimer.current);
    autoStopTimer.current = setTimeout(() => void stopRecording(), 30_000);
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;
    recordingRef.current = false;
    if (autoStopTimer.current) {
      clearTimeout(autoStopTimer.current);
      autoStopTimer.current = null;
    }
    setVoiceStage('transcribing');
    begin();
    let transcript = '';
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) throw new Error('Recording produced no audio file.');
      transcript = await transcribeAudio({
        audioUri: uri,
        onProgress,
        onPartial: (partial) => setInput(partial),
      });
      if (transcript) setInput(transcript);
    } catch (error) {
      fail('Transcription failed', error);
    } finally {
      end();
      setVoiceStage('idle');
    }
    // One-gesture voice-to-voice: speak → transcribe → translate → speak.
    if (transcript.trim()) void runTranslate(transcript, true);
  };

  const toggleRecording = () => (recording ? void stopRecording() : void startRecording());

  const playOutput = async (text: string) => {
    if (!isTtsLanguage(to)) return;
    setSpeaking(true);
    try {
      await speak(text, to, onProgress);
    } catch (error) {
      fail('Speech failed', error);
    } finally {
      setSpeaking(false);
    }
  };

  const onListen = () => {
    if (speaking || isSpeaking()) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    if (output) void playOutput(output);
  };

  const swap = () => {
    setFrom(to);
    setTo(from);
    setInput(output || input);
    setOutput(input && output ? input : '');
  };

  const onPickLanguage = (language: Language) => {
    if (picker === 'from') setFrom(language.code);
    if (picker === 'to') setTo(language.code);
  };

  const toLang = getLanguage(to);
  const canSpeakTarget = isTtsLanguage(to);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Translate</Text>
          <Text style={styles.subtitle}>Offline · on-device · 48 languages</Text>
        </View>
        <TouchableOpacity
          style={styles.gear}
          activeOpacity={0.7}
          onPress={() => setPrepareOpen(true)}
          accessibilityLabel="Prepare for offline"
        >
          <Text style={styles.gearIcon}>⬇️</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Card style={styles.langBar}>
            <LanguageChip code={from} accent={ACCENT} onPress={() => setPicker('from')} />
            <TouchableOpacity activeOpacity={0.7} style={styles.swap} onPress={swap}>
              <Text style={styles.swapIcon}>⇄</Text>
            </TouchableOpacity>
            <LanguageChip code={to} accent={ACCENT} onPress={() => setPicker('to')} />
          </Card>

          <SectionLabel>{getLanguage(from).label}</SectionLabel>
          <Card style={[styles.inputCard, recording && glow(colors.danger, 0.5)]}>
            <TextInput
              style={styles.input}
              placeholder="Type, or hold the mic and speak…"
              placeholderTextColor={colors.textFaint}
              value={input}
              onChangeText={setInput}
              multiline
              textAlignVertical="top"
              editable={!recording && !transcribing}
            />
            <View style={styles.inputFooter}>
              <TouchableOpacity
                onPress={toggleRecording}
                disabled={transcribing || translating}
                activeOpacity={0.8}
                style={[
                  styles.mic,
                  recording && styles.micRecording,
                  recording && glow(colors.danger, 0.6),
                ]}
              >
                <Text style={styles.micIcon}>{recording ? '⏹' : '🎙'}</Text>
                <Text style={[styles.micLabel, recording && styles.micLabelActive]}>
                  {recording ? 'Tap to stop' : transcribing ? 'Transcribing…' : 'Speak'}
                </Text>
              </TouchableOpacity>
              {input.length > 0 && !recording ? (
                <TouchableOpacity onPress={() => setInput('')} style={styles.clear}>
                  <Text style={styles.clearText}>Clear</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </Card>

          <Button
            label={translating ? 'Translating…' : 'Translate'}
            icon="🌐"
            accent={ACCENT}
            loading={translating}
            disabled={!input.trim() || recording}
            onPress={() => void runTranslate(input, false)}
            style={[styles.cta, !!input.trim() && !translating && glow(ACCENT, 0.5)]}
          />

          {errorNotice ? (
            <Notice
              tone="error"
              title={errorNotice.title}
              detail={errorNotice.detail}
              onRetry={input.trim() ? () => void runTranslate(input, false) : undefined}
              onDismiss={() => setErrorNotice(null)}
            />
          ) : null}

          <View style={styles.outputHeader}>
            <SectionLabel style={styles.noMargin}>{toLang.label}</SectionLabel>
            <TouchableOpacity
              style={styles.autoToggle}
              activeOpacity={0.7}
              onPress={() => setAutoPlay((v) => !v)}
            >
              <Text style={[styles.autoToggleText, autoPlay && { color: ACCENT }]}>
                {autoPlay ? '🔊 Auto-play on' : '🔇 Auto-play off'}
              </Text>
            </TouchableOpacity>
          </View>

          <Card style={[styles.outputCard, !!output && glow(ACCENT, 0.25)]}>
            {output ? (
              <>
                <Text selectable style={styles.output}>
                  {output}
                </Text>
                <TouchableOpacity
                  onPress={onListen}
                  disabled={!canSpeakTarget}
                  activeOpacity={0.8}
                  style={[
                    styles.listen,
                    speaking && styles.listenActive,
                    !canSpeakTarget && styles.listenDisabled,
                  ]}
                >
                  <Text style={[styles.listenText, speaking && styles.listenTextActive]}>
                    {!canSpeakTarget
                      ? `🔇 Voice not available for ${toLang.label}`
                      : speaking
                        ? '⏹ Stop'
                        : '🔊 Listen'}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={styles.outputPlaceholder}>
                Your translation appears here — generated entirely on this device.
              </Text>
            )}
          </Card>

          <PerfChip kinds={['translate', 'transcribe', 'tts', 'model_load']} accent={ACCENT} />

          <PrivacyFooter accent={ACCENT} />
        </ScrollView>
      </KeyboardAvoidingView>

      <LanguagePicker
        visible={picker !== null}
        title={picker === 'from' ? 'Translate from' : 'Translate to'}
        selectedCode={picker === 'from' ? from : to}
        disabledCode={picker === 'from' ? to : from}
        accent={ACCENT}
        onSelect={onPickLanguage}
        onClose={() => setPicker(null)}
      />

      <PrepareOfflineSheet
        visible={prepareOpen}
        onClose={() => setPrepareOpen(false)}
        accent={ACCENT}
      />

      <ModelLoadingOverlay
        visible={loadState.active && busy}
        title={transcribing ? 'Loading speech model' : 'Loading translation model'}
        subtitle="First time only — it is cached on your device afterwards."
        percentage={loadState.percentage}
        detail={loadState.detail}
        accent={ACCENT}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  headerText: { flex: 1 },
  title: { ...typography.display, color: colors.text },
  subtitle: { ...typography.body, color: colors.textMuted, marginTop: 2 },
  gear: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearIcon: { fontSize: 18 },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  langBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  swap: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.sm,
  },
  swapIcon: { fontSize: 20, color: ACCENT, fontWeight: '800' },
  inputCard: { minHeight: 150 },
  input: {
    ...typography.body,
    color: colors.text,
    minHeight: 96,
    maxHeight: 200,
  },
  inputFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
  },
  mic: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  micRecording: { backgroundColor: colors.danger, borderColor: colors.danger },
  micIcon: { fontSize: 15 },
  micLabel: { ...typography.caption, color: colors.primary, fontWeight: '800' },
  micLabelActive: { color: colors.white },
  clear: { paddingHorizontal: spacing.sm },
  clearText: { ...typography.caption, color: colors.textMuted, fontWeight: '700' },
  cta: { marginVertical: spacing.sm },
  outputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  noMargin: { marginBottom: 0 },
  autoToggle: { paddingVertical: 4 },
  autoToggleText: { ...typography.caption, color: colors.textMuted, fontWeight: '700' },
  outputCard: { minHeight: 120, justifyContent: 'center' },
  output: { ...typography.title, fontWeight: '600', color: colors.text, lineHeight: 30 },
  outputPlaceholder: { ...typography.body, color: colors.textFaint },
  listen: {
    alignSelf: 'flex-start',
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  listenActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  listenDisabled: { backgroundColor: 'transparent', borderColor: 'transparent' },
  listenText: { ...typography.caption, color: colors.primary, fontWeight: '800' },
  listenTextActive: { color: colors.black },
});

import React, { useState } from 'react';
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
import { useModelLoader } from '../hooks/useModelLoader';
import { colors, radius, spacing, typography } from '../theme';
import { Button, Card, ModelLoadingOverlay, SectionLabel } from '../components/ui';
import { LanguageChip, LanguagePicker } from '../components/LanguagePicker';
import { PrivacyFooter } from '../components/PrivacyFooter';

const ACCENT = colors.translate;

export function TranslateScreen() {
  const [from, setFrom] = useState('en');
  const [to, setTo] = useState('es');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [translating, setTranslating] = useState(false);
  const [picker, setPicker] = useState<'from' | 'to' | null>(null);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);

  const { state: loadState, begin, end, onProgress } = useModelLoader();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const startRecording = async () => {
    if (recording || transcribing || translating) return;
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Microphone needed', 'Enable microphone access to dictate text.');
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setRecording(true);
  };

  const stopRecording = async () => {
    if (!recording) return;
    setRecording(false);
    setTranscribing(true);
    begin();
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) throw new Error('Recording produced no audio file.');
      const text = await transcribeAudio({ audioUri: uri, onProgress });
      if (text) setInput((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
    } catch (error) {
      Alert.alert('Transcription failed', String((error as Error)?.message ?? error));
    } finally {
      end();
      setTranscribing(false);
    }
  };

  const toggleRecording = () => (recording ? stopRecording() : startRecording());

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

  const handleTranslate = async () => {
    if (!input.trim() || translating) return;
    setTranslating(true);
    setOutput('');
    begin();
    try {
      const result = await translateText({
        text: input,
        from,
        to,
        onProgress,
        onToken: setOutput,
      });
      setOutput(result);
    } catch (error) {
      Alert.alert('Translation failed', String((error as Error)?.message ?? error));
    } finally {
      end();
      setTranslating(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollViewHeader />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Card style={styles.langBar}>
            <LanguageChip code={from} accent={ACCENT} onPress={() => setPicker('from')} />
            <TouchableOpacity activeOpacity={0.7} style={styles.swap} onPress={swap}>
              <Text style={styles.swapIcon}>⇄</Text>
            </TouchableOpacity>
            <LanguageChip code={to} accent={ACCENT} onPress={() => setPicker('to')} />
          </Card>

          <SectionLabel>{getLanguage(from).label}</SectionLabel>
          <Card>
            <TextInput
              style={styles.input}
              placeholder="Type something to translate…"
              placeholderTextColor={colors.textFaint}
              value={input}
              onChangeText={setInput}
              multiline
              textAlignVertical="top"
            />
            <View style={styles.inputFooter}>
              <TouchableOpacity
                onPress={toggleRecording}
                disabled={transcribing}
                activeOpacity={0.7}
                style={[styles.mic, recording && styles.micActive]}
              >
                <Text style={[styles.micIcon, recording && styles.micIconActive]}>
                  {recording ? '⏹' : '🎙'}
                </Text>
                <Text style={[styles.micLabel, recording && styles.micLabelActive]}>
                  {recording ? 'Tap to stop' : transcribing ? 'Transcribing…' : 'Speak'}
                </Text>
              </TouchableOpacity>
              {input.length > 0 ? (
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
            disabled={!input.trim()}
            onPress={handleTranslate}
            style={styles.cta}
          />

          <SectionLabel>{getLanguage(to).label}</SectionLabel>
          <Card style={styles.outputCard}>
            {output ? (
              <Text selectable style={styles.output}>
                {output}
              </Text>
            ) : (
              <Text style={styles.outputPlaceholder}>
                Your translation appears here — generated entirely on this device.
              </Text>
            )}
          </Card>

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

      <ModelLoadingOverlay
        visible={loadState.active && (translating || transcribing)}
        title={transcribing ? 'Loading speech model' : 'Loading translation model'}
        subtitle="First time only — it is cached on your device afterwards."
        percentage={loadState.percentage}
        detail={loadState.detail}
        accent={ACCENT}
      />
    </View>
  );
}

function ScrollViewHeader() {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>Translate</Text>
      <Text style={styles.subtitle}>Offline neural translation in 16+ languages</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  title: { ...typography.display, color: colors.text },
  subtitle: { ...typography.body, color: colors.textMuted, marginTop: 2 },
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
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.sm,
  },
  swapIcon: { fontSize: 20, color: ACCENT, fontWeight: '800' },
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
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  micActive: { backgroundColor: ACCENT },
  micIcon: { fontSize: 14 },
  micIconActive: { fontSize: 14 },
  micLabel: { ...typography.caption, color: colors.textMuted, fontWeight: '700' },
  micLabelActive: { ...typography.caption, color: '#fff', fontWeight: '800' },
  clear: { paddingTop: 0 },
  clearText: { ...typography.caption, color: colors.textMuted, fontWeight: '700' },
  cta: { marginVertical: spacing.sm },
  outputCard: { minHeight: 110, justifyContent: 'center' },
  output: { ...typography.title, fontWeight: '600', color: colors.text, lineHeight: 28 },
  outputPlaceholder: { ...typography.body, color: colors.textFaint },
  privacyNote: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});

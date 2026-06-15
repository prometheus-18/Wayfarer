import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { getLanguage, type Language } from '../data/languages';
import { scanImage } from '../qvac/ocr';
import { translateText } from '../qvac/translate';
import { isSpeaking, isTtsLanguage, speak, stopSpeaking } from '../qvac/tts';
import { PerfChip } from '../components/PerfChip';
import { logEvent } from '../qvac/telemetry';
import { useModelLoader } from '../hooks/useModelLoader';
import { colors, radius, spacing, typography } from '../theme';
import { Button, Card, EmptyState, ModelLoadingOverlay, Notice, Pill, SectionLabel } from '../components/ui';
import { LanguageChip, LanguagePicker } from '../components/LanguagePicker';
import { PrivacyFooter } from '../components/PrivacyFooter';

const ACCENT = colors.scan;

export function ScanScreen({ active = true }: { active?: boolean }) {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [recognized, setRecognized] = useState('');
  const [output, setOutput] = useState('');
  const [from, setFrom] = useState('es');
  const [to, setTo] = useState('en');
  const [picker, setPicker] = useState<'from' | 'to' | null>(null);
  const [busy, setBusy] = useState<'ocr' | 'translate' | null>(null);
  const [notice, setNotice] = useState<{ tone: 'error' | 'warning'; title: string; detail?: string } | null>(null);
  const [lastUri, setLastUri] = useState<string | null>(null);

  const { state: loadState, begin, end, onProgress } = useModelLoader();

  // All screens stay mounted; when this tab is hidden (or unmounts) stop any
  // Listen playback so it can't hold the shared audio session and garble the
  // Voice tab's next turn.
  useEffect(() => {
    if (!active) stopSpeaking();
  }, [active]);
  useEffect(() => () => stopSpeaking(), []);

  const fail = (title: string, error: unknown) => {
    const detail = String((error as Error)?.message ?? error);
    setNotice({ tone: 'error', title, detail });
    logEvent({ kind: 'error', model: 'scan', extra: { title, message: detail } });
  };

  const runOcr = async (uri: string) => {
    setBusy('ocr');
    setRecognized('');
    setOutput('');
    setNotice(null);
    setLastUri(uri);
    begin();
    try {
      const result = await scanImage(uri, onProgress);
      setRecognized(result.text);
      if (!result.text) {
        // Model loaded and ran but found nothing — a soft outcome, not an error.
        setNotice({
          tone: 'warning',
          title: 'No text found',
          detail: 'Try a sharper, well-lit photo. Latin-script text works best.',
        });
      }
    } catch (error) {
      fail('Scan failed', error);
    } finally {
      end();
      setBusy(null);
    }
  };

  const handleImage = (uri: string) => {
    setImageUri(uri);
    runOcr(uri);
  };

  const pickFromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera needed', 'Enable camera access to scan text.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled && result.assets[0]) handleImage(result.assets[0].uri);
  };

  const pickFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
    if (!result.canceled && result.assets[0]) handleImage(result.assets[0].uri);
  };

  const handleTranslate = async () => {
    if (!recognized.trim() || busy) return;
    setBusy('translate');
    setOutput('');
    begin();
    setNotice(null);
    try {
      const result = await translateText({
        text: recognized,
        from,
        to,
        onProgress,
        onToken: setOutput,
      });
      setOutput(result);
    } catch (error) {
      fail('Translation failed', error);
    } finally {
      end();
      setBusy(null);
    }
  };

  const onPickLanguage = (language: Language) => {
    if (picker === 'from') setFrom(language.code);
    if (picker === 'to') setTo(language.code);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Scan</Text>
        <Text style={styles.subtitle}>Read & translate signs, menus and documents</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {imageUri ? (
          <Card style={styles.imageCard}>
            <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
          </Card>
        ) : (
          <Card>
            <EmptyState
              emoji="📷"
              title="Point, shoot, understand"
              message="Take or choose a photo and Wayfarer reads the text on-device, then translates it."
            />
          </Card>
        )}

        <View style={styles.actionRow}>
          <Button
            label="Take photo"
            icon="📸"
            accent={ACCENT}
            onPress={pickFromCamera}
            style={styles.actionBtn}
          />
          <Button
            label="Choose"
            icon="🖼️"
            variant="tonal"
            accent={ACCENT}
            onPress={pickFromLibrary}
            style={styles.actionBtn}
          />
        </View>

        {notice ? (
          <Notice
            tone={notice.tone}
            title={notice.title}
            detail={notice.detail}
            onRetry={lastUri && notice.tone === 'error' ? () => runOcr(lastUri) : undefined}
            onDismiss={() => setNotice(null)}
          />
        ) : null}

        {recognized ? (
          <>
            <View style={styles.rowBetween}>
              <SectionLabel style={styles.noMargin}>Recognized text</SectionLabel>
              <Pill label="on-device OCR" color={ACCENT} />
            </View>
            <Card>
              <Text selectable style={styles.recognized}>
                {recognized}
              </Text>
            </Card>

            <Card style={styles.langBar}>
              <LanguageChip code={from} accent={ACCENT} onPress={() => setPicker('from')} />
              <Text style={styles.arrow}>→</Text>
              <LanguageChip code={to} accent={ACCENT} onPress={() => setPicker('to')} />
            </Card>

            <Button
              label={busy === 'translate' ? 'Translating…' : `Translate to ${getLanguage(to).label}`}
              icon="🌐"
              accent={ACCENT}
              loading={busy === 'translate'}
              onPress={handleTranslate}
            />

            {output ? (
              <>
                <SectionLabel>{getLanguage(to).label}</SectionLabel>
                <Card style={styles.outputCard}>
                  <Text selectable style={styles.output}>
                    {output}
                  </Text>
                  {isTtsLanguage(to) ? (
                    <TouchableOpacity
                      onPress={async () => {
                        if (!isTtsLanguage(to)) return;
                        if (isSpeaking()) {
                          stopSpeaking();
                          return;
                        }
                        try {
                          // No onProgress here: a cold TTS download must not
                          // flip the full-screen overlay on with no begin/end
                          // to dismiss it (it would stick forever).
                          await speak(output, to);
                        } catch (error) {
                          fail('Speech failed', error);
                        }
                      }}
                      activeOpacity={0.7}
                      style={styles.speak}
                    >
                      <Text style={styles.speakText}>🔊 Listen</Text>
                    </TouchableOpacity>
                  ) : null}
                </Card>
              </>
            ) : null}
          </>
        ) : null}

        <PerfChip kinds={['ocr', 'translate', 'tts', 'model_load']} accent={ACCENT} />

        <PrivacyFooter accent={ACCENT} />
      </ScrollView>

      <LanguagePicker
        visible={picker !== null}
        title={picker === 'from' ? 'Text language' : 'Translate to'}
        selectedCode={picker === 'from' ? from : to}
        disabledCode={picker === 'from' ? to : from}
        accent={ACCENT}
        onSelect={onPickLanguage}
        onClose={() => setPicker(null)}
      />

      <ModelLoadingOverlay
        visible={loadState.active}
        title={busy === 'ocr' ? 'Loading OCR model' : 'Loading translation model'}
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
  imageCard: { padding: spacing.xs, overflow: 'hidden' },
  image: { width: '100%', height: 200, borderRadius: radius.md },
  actionRow: { flexDirection: 'row', gap: spacing.md, marginVertical: spacing.sm },
  actionBtn: { flex: 1 },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  noMargin: { marginBottom: 0 },
  recognized: { ...typography.body, color: colors.text, lineHeight: 24 },
  langBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  arrow: { fontSize: 20, color: ACCENT, fontWeight: '800', marginHorizontal: spacing.sm },
  outputCard: { minHeight: 80, justifyContent: 'center' },
  output: { ...typography.title, fontWeight: '600', color: colors.text, lineHeight: 28 },
  speak: { alignSelf: 'flex-start', marginTop: spacing.sm },
  speakText: { ...typography.caption, color: ACCENT, fontWeight: '800' },
  privacyNote: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});

import React, { useRef, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { askAssistant, type ChatRole } from '../qvac/assistant';
import { useModelLoader } from '../hooks/useModelLoader';
import { colors, radius, spacing, typography } from '../theme';
import { ModelLoadingOverlay } from '../components/ui';
import { hexWithAlpha } from '../components/ui';

const ACCENT = colors.assistant;

interface Message {
  id: string;
  role: ChatRole;
  content: string;
  imageUri?: string;
}

const SUGGESTIONS = [
  'How do I politely ask for the bill?',
  'What are common scams to avoid here?',
  'Suggest a 1-day itinerary near me',
];

let messageSeq = 0;
const nextId = () => `m${(messageSeq += 1)}`;

export function AssistantScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [attached, setAttached] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const { state: loadState, begin, end, onProgress } = useModelLoader();

  const updateMessage = (id: string, content: string) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content } : m)));
  };

  const scrollToEnd = () => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  };

  const attachFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
    if (!result.canceled && result.assets[0]) setAttached(result.assets[0].uri);
  };

  const attachFromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled && result.assets[0]) setAttached(result.assets[0].uri);
  };

  const send = async (presetText?: string) => {
    const text = (presetText ?? input).trim();
    if ((!text && !attached) || sending) return;

    const userMessage: Message = {
      id: nextId(),
      role: 'user',
      content: text,
      imageUri: attached ?? undefined,
    };
    const priorTurns = messages.map((m) => ({
      role: m.role,
      content: m.content,
      imageUri: m.imageUri,
    }));
    const assistantId = nextId();

    setMessages((prev) => [...prev, userMessage, { id: assistantId, role: 'assistant', content: '' }]);
    setInput('');
    setAttached(null);
    setSending(true);
    begin();
    scrollToEnd();

    try {
      await askAssistant({
        history: priorTurns,
        prompt: text || 'Describe this image for a traveler and translate any text in it.',
        imageUri: userMessage.imageUri,
        onProgress,
        onToken: (partial) => {
          updateMessage(assistantId, partial);
          scrollToEnd();
        },
      });
    } catch (error) {
      updateMessage(assistantId, `⚠️ ${String((error as Error)?.message ?? error)}`);
    } finally {
      end();
      setSending(false);
    }
  };

  const showEmptyState = messages.length === 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Assistant</Text>
        <Text style={styles.subtitle}>Your private, offline travel companion</Text>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.messages}
          onContentSizeChange={scrollToEnd}
          showsVerticalScrollIndicator={false}
        >
          {showEmptyState ? (
            <View style={styles.welcome}>
              <Text style={styles.welcomeEmoji}>🧭</Text>
              <Text style={styles.welcomeTitle}>Ask me anything, anywhere</Text>
              <Text style={styles.welcomeText}>
                Directions, customs, food, safety — even from a photo. Runs fully on your phone, no
                signal needed.
              </Text>
              <View style={styles.suggestions}>
                {SUGGESTIONS.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={styles.suggestion}
                    activeOpacity={0.8}
                    onPress={() => send(s)}
                  >
                    <Text style={styles.suggestionText}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            messages.map((message) => <Bubble key={message.id} message={message} />)
          )}
        </ScrollView>

        {attached ? (
          <View style={styles.attachmentPreview}>
            <Image source={{ uri: attached }} style={styles.attachmentThumb} />
            <Text style={styles.attachmentLabel}>Photo attached</Text>
            <TouchableOpacity onPress={() => setAttached(null)}>
              <Text style={styles.attachmentRemove}>Remove</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.composer}>
          <TouchableOpacity style={styles.iconButton} onPress={attachFromCamera}>
            <Text style={styles.iconText}>📷</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={attachFromLibrary}>
            <Text style={styles.iconText}>🖼️</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.composerInput}
            placeholder="Message Wayfarer…"
            placeholderTextColor={colors.textFaint}
            value={input}
            onChangeText={setInput}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendButton, { backgroundColor: ACCENT }, sending && styles.sendDisabled]}
            onPress={() => send()}
            disabled={sending}
          >
            <Text style={styles.sendText}>{sending ? '…' : '➤'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <ModelLoadingOverlay
        visible={loadState.active}
        title="Loading on-device assistant"
        subtitle="The vision model is large — downloaded once, then fully offline."
        percentage={loadState.percentage}
        detail={loadState.detail}
        accent={ACCENT}
      />
    </View>
  );
}

function Bubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  return (
    <View style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowAssistant]}>
      <View
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleAssistant,
        ]}
      >
        {message.imageUri ? (
          <Image source={{ uri: message.imageUri }} style={styles.bubbleImage} />
        ) : null}
        {message.content ? (
          <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>{message.content}</Text>
        ) : (
          <Text style={[styles.bubbleText, styles.bubbleTyping]}>Thinking…</Text>
        )}
      </View>
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
  messages: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
    flexGrow: 1,
  },
  welcome: { alignItems: 'center', paddingTop: spacing.xl, paddingHorizontal: spacing.sm },
  welcomeEmoji: { fontSize: 48 },
  welcomeTitle: { ...typography.title, color: colors.text, marginTop: spacing.md },
  welcomeText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  suggestions: { width: '100%', marginTop: spacing.xl, gap: spacing.sm },
  suggestion: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  suggestionText: { ...typography.body, color: colors.text },
  bubbleRow: { flexDirection: 'row' },
  bubbleRowUser: { justifyContent: 'flex-end' },
  bubbleRowAssistant: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '84%',
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  bubbleUser: { backgroundColor: ACCENT, borderBottomRightRadius: 4 },
  bubbleAssistant: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bubbleText: { ...typography.body, color: colors.text, lineHeight: 23 },
  bubbleTextUser: { color: colors.white },
  bubbleTyping: { color: colors.textFaint, fontStyle: 'italic' },
  bubbleImage: {
    width: '100%',
    height: 160,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  attachmentPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: hexWithAlpha(ACCENT, 0.08),
  },
  attachmentThumb: { width: 40, height: 40, borderRadius: radius.sm },
  attachmentLabel: { ...typography.caption, color: colors.text, flex: 1 },
  attachmentRemove: { ...typography.caption, color: colors.danger, fontWeight: '700' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  iconButton: {
    width: 40,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { fontSize: 20 },
  composerInput: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    maxHeight: 120,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.5 },
  sendText: { color: colors.white, fontSize: 18, fontWeight: '800' },
});

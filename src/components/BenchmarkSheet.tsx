import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { colors, radius, shadow, spacing, typography } from '../theme';
import {
  listCases,
  runStressSuite,
  type CaseResult,
  type StressGroup,
  type StressReport,
} from '../qvac/stress';
import { getEntries } from '../qvac/telemetry';
import { formatBytes, SIZES } from '../qvac/models';
import { useModelLoader } from '../hooks/useModelLoader';
import { Button, Pill, ProgressBar } from './ui';

/**
 * On-device benchmark & stress-test sheet. Runs the scripted suite from
 * src/qvac/stress.ts through the real service layer and offers a one-tap
 * export of the results bundled with the inference audit log — the exact
 * evidence artifact the hackathon validation asks for.
 */
export function BenchmarkSheet({
  visible,
  onClose,
  accent = colors.primary,
}: {
  visible: boolean;
  onClose: () => void;
  accent?: string;
}) {
  const [withOcr, setWithOcr] = useState(false);
  const [withAssistant, setWithAssistant] = useState(false);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<CaseResult[]>([]);
  const [report, setReport] = useState<StressReport | null>(null);

  const { state: loadState, begin, end, onProgress } = useModelLoader();

  const groups: StressGroup[] = [
    'translate',
    ...(withOcr ? (['ocr'] as const) : []),
    ...(withAssistant ? (['assistant'] as const) : []),
  ];

  const run = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setReport(null);
    setResults(listCases(groups));
    begin();
    try {
      const finished = await runStressSuite({ groups, onUpdate: setResults, onProgress });
      setReport(finished);
    } catch (error) {
      Alert.alert('Benchmark crashed', String((error as Error)?.message ?? error));
    } finally {
      end();
      setRunning(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, withOcr, withAssistant]);

  const exportReport = async () => {
    if (!report) return;
    try {
      await Share.share({
        title: 'Wayfarer benchmark report',
        message: JSON.stringify({ report, auditLog: getEntries() }, null, 2),
      });
    } catch {
      // user dismissed the share sheet
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>On-device benchmark</Text>
            <Pill label="100% local" color={accent} />
          </View>
          <Text style={styles.body}>
            A scripted stress suite that exercises translation routing, heavy inputs, concurrency,
            OCR, the assistant and prompt-injection defenses — all on this phone.
          </Text>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>OCR cases (~{formatBytes(SIZES.ocr)})</Text>
            <Switch value={withOcr} onValueChange={setWithOcr} disabled={running} />
          </View>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Assistant cases (~{formatBytes(SIZES.assistant)})</Text>
            <Switch value={withAssistant} onValueChange={setWithAssistant} disabled={running} />
          </View>

          {loadState.active ? (
            <View style={styles.loading}>
              <Text style={styles.loadingText}>
                Downloading model… {Math.round(loadState.percentage)}%
                {loadState.detail ? `  ·  ${loadState.detail}` : ''}
              </Text>
              <ProgressBar value={loadState.percentage} color={accent} />
            </View>
          ) : null}

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {results.length === 0 ? (
              <Text style={styles.placeholder}>
                {listCases(groups).length} cases ready. Tap Run to start.
              </Text>
            ) : (
              results.map((result) => <CaseRow key={result.id} result={result} accent={accent} />)
            )}
          </ScrollView>

          {report ? (
            <Text style={styles.summary}>
              ✅ {report.summary.pass} passed · ❌ {report.summary.fail} failed · ⏭{' '}
              {report.summary.skip} skipped · {(report.summary.totalMs / 1000).toFixed(1)}s ·{' '}
              {report.device.model}
            </Text>
          ) : null}

          <View style={styles.row}>
            <Button
              label={running ? 'Running…' : 'Run suite'}
              icon="🧪"
              accent={accent}
              loading={running}
              onPress={run}
              style={styles.flex}
            />
            <Button
              label="Export"
              icon="📤"
              variant="tonal"
              accent={accent}
              disabled={!report}
              onPress={exportReport}
              style={styles.flex}
            />
          </View>
          <Button label="Close" variant="ghost" accent={colors.textMuted} onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

function CaseRow({ result, accent }: { result: CaseResult; accent: string }) {
  return (
    <View style={styles.caseRow}>
      <View style={styles.caseIcon}>
        {result.status === 'running' ? (
          <ActivityIndicator size="small" color={accent} />
        ) : (
          <Text style={styles.caseIconText}>{STATUS_ICON[result.status]}</Text>
        )}
      </View>
      <View style={styles.caseBody}>
        <Text style={styles.caseTitle}>{result.title}</Text>
        {result.note ? (
          <Text style={[styles.caseNote, result.status === 'fail' && styles.caseNoteFail]}>
            {result.note}
          </Text>
        ) : null}
      </View>
      {result.ms !== undefined ? <Text style={styles.caseMs}>{formatMs(result.ms)}</Text> : null}
    </View>
  );
}

const STATUS_ICON: Record<CaseResult['status'], string> = {
  pending: '○',
  running: '…',
  pass: '✅',
  fail: '❌',
  skip: '⏭',
};

function formatMs(ms: number): string {
  return ms >= 10_000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '88%',
    backgroundColor: colors.sheet,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    ...shadow.floating,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { ...typography.title, color: colors.text },
  body: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs, lineHeight: 18 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  toggleLabel: { ...typography.body, color: colors.text },
  loading: { marginTop: spacing.sm },
  loadingText: { ...typography.caption, color: colors.textMuted },
  list: { marginTop: spacing.md, flexGrow: 0 },
  listContent: { gap: spacing.sm, paddingBottom: spacing.xs },
  placeholder: { ...typography.body, color: colors.textFaint, textAlign: 'center', padding: spacing.lg },
  caseRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  caseIcon: { width: 24, alignItems: 'center', paddingTop: 1 },
  caseIconText: { fontSize: 14 },
  caseBody: { flex: 1 },
  caseTitle: { ...typography.caption, color: colors.text, fontWeight: '600' },
  caseNote: { ...typography.caption, color: colors.textMuted, marginTop: 1 },
  caseNoteFail: { color: colors.danger },
  caseMs: { ...typography.caption, color: colors.textFaint, fontVariant: ['tabular-nums'] },
  summary: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' },
  row: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  flex: { flex: 1 },
});

import React, { useState } from 'react';
import { SafeAreaView, StatusBar as RNStatusBar, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { colors } from './src/theme';
import { TabBar, type TabKey } from './src/components/TabBar';
import { TranslateScreen } from './src/screens/TranslateScreen';
import { ScanScreen } from './src/screens/ScanScreen';
import { AssistantScreen } from './src/screens/AssistantScreen';

export default function App() {
  const [active, setActive] = useState<TabKey>('translate');

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.body}>
        {/* All screens stay mounted so their state (chat, translations) persists. */}
        <Pane visible={active === 'translate'}>
          <TranslateScreen />
        </Pane>
        <Pane visible={active === 'scan'}>
          <ScanScreen />
        </Pane>
        <Pane visible={active === 'assistant'}>
          <AssistantScreen />
        </Pane>
      </View>
      <TabBar active={active} onChange={setActive} />
    </SafeAreaView>
  );
}

function Pane({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  return (
    <View
      style={[StyleSheet.absoluteFill, !visible && styles.hidden]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingTop: RNStatusBar.currentHeight ?? 0,
  },
  body: { flex: 1 },
  hidden: { opacity: 0 },
});

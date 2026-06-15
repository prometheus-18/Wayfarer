import React from 'react';
import { SafeAreaView, StatusBar as RNStatusBar, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { colors } from './src/theme';
import { VoiceInterpreterScreen } from './src/screens/VoiceInterpreterScreen';

export default function App() {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <VoiceInterpreterScreen />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingTop: RNStatusBar.currentHeight ?? 0,
  },
});

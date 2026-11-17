import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { useDumpStore } from '@/lib/dump-store';
import { extractUrl } from '@/lib/classify';
import { borders, colors, fonts } from '@/lib/theme';

export default function AddDumpScreen() {
  const { addManualText } = useDumpStore();
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [focused, setFocused] = useState(false);

  const trimmed = text.trim();
  const detectedUrl = extractUrl(trimmed);

  const save = async () => {
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      await addManualText(trimmed);
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <View style={styles.content}>
          <Text style={styles.label}>INSCRIBE YOUR DUMP</Text>
          <TextInput
            value={text}
            onChangeText={setText}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="A THOUGHT, A LINK, A RANT…"
            placeholderTextColor={colors.faint}
            style={[styles.input, focused && styles.inputFocused]}
            multiline
            autoFocus
            textAlignVertical="top"
          />

          {detectedUrl && (
            <Text style={styles.detectText} numberOfLines={1}>
              LINK DETECTED — SAVES AS {detectedUrl}
            </Text>
          )}

          <View style={styles.actions}>
            <Pressable style={styles.cancelBtn} onPress={() => router.back()}>
              <Text style={styles.cancelText}>ABANDON</Text>
            </Pressable>
            <Pressable
              style={[styles.saveBtn, !trimmed && styles.saveBtnDisabled]}
              onPress={save}
              disabled={!trimmed || saving}
            >
              <Text style={[styles.saveText, !trimmed && styles.saveTextDisabled]}>
                {saving ? 'BINDING…' : 'DUMP IT'}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
    gap: 14,
  },
  label: {
    fontFamily: fonts.label,
    fontSize: 13,
    letterSpacing: 2,
    color: colors.text,
  },
  input: {
    flex: 1,
    minHeight: 140,
    fontFamily: fonts.mono,
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
    backgroundColor: colors.sunken,
    borderWidth: borders.thick,
    borderColor: colors.border,
    padding: 14,
  },
  inputFocused: {
    borderWidth: borders.heavy,
    padding: 12,
  },
  detectText: {
    fontFamily: fonts.mono,
    color: colors.blue,
    fontSize: 11,
    letterSpacing: 0.5,
    borderWidth: borders.base,
    borderColor: colors.blue,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    height: 52,
    borderWidth: borders.thick,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontFamily: fonts.label,
    color: colors.text,
    fontSize: 12,
    letterSpacing: 2,
  },
  saveBtn: {
    flex: 2,
    height: 52,
    borderWidth: borders.thick,
    borderColor: colors.border,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: {
    backgroundColor: colors.disabledFill,
    borderColor: colors.disabledBorder,
  },
  saveTextDisabled: {
    color: colors.faint,
  },
  saveText: {
    fontFamily: fonts.label,
    color: colors.ink,
    fontSize: 12,
    letterSpacing: 2,
  },
});

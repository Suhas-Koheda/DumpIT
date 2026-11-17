import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

import { mergeVaults, parseVaultJson, shareExportJson, shareExportPdf } from '@/lib/vault';
import { isLockEnabled, setPin, clearPin } from '@/lib/pin';
import { useDumpStore } from '@/lib/dump-store';
import { borders, colors, fonts } from '@/lib/theme';

export default function SettingsScreen() {
  const { items, folders, replaceAll } = useDumpStore();
  const [pinInput, setPinInput] = useState('');
  const [lockEnabled, setLockEnabled] = useState<boolean | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    isLockEnabled().then(setLockEnabled);
  }, []);

  const pinnedCount = items.filter((i) => i.pinned).length;
  const todoCount = items.filter(
    (i) => i.ai?.status === 'done' && i.ai.category === 'todo'
  ).length;
  const privateCount = items.filter((i) => i.isPrivate).length;

  const doExportJson = async () => {
    setWorking(true);
    try {
      await shareExportJson(items, folders);
    } finally {
      setWorking(false);
    }
  };

  const doExportPdf = async () => {
    setWorking(true);
    try {
      await shareExportPdf(items, folders);
    } catch (error) {
      Alert.alert('Export failed', error instanceof Error ? error.message : String(error));
    } finally {
      setWorking(false);
    }
  };

  const doImportJson = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/json',
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    try {
      const raw = await new File(asset.uri).text();
      const imported = parseVaultJson(raw);
      const merged = mergeVaults(items, folders, imported);
      Alert.alert(
        'Import vault?',
        `Merge ${imported.items.length} dumps + ${imported.folders.length} blocks into your vault? Current items are kept.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Import',
            onPress: () => {
              replaceAll(merged.items, merged.folders);
              Alert.alert('Done', 'Vault merged.');
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert('Import failed', error instanceof Error ? error.message : String(error));
    }
  };

  const handleSetPin = async () => {
    if (pinInput.length < 4) {
      Alert.alert('PIN too short', 'Use at least 4 digits.');
      return;
    }
    const ok = await setPin(pinInput);
    setPinInput('');
    setLockEnabled(ok);
    Alert.alert(ok ? 'Lock on' : 'Failed', ok ? 'DumpIT now locks on every cold start.' : 'Could not store the PIN.');
  };

  const handleClearPin = async () => {
    if (pinInput.length < 4) {
      Alert.alert('Enter current PIN', 'Type your current PIN above to unlock.');
      return;
    }
    const ok = await clearPin(pinInput);
    setPinInput('');
    setLockEnabled(ok ? false : lockEnabled);
    Alert.alert(ok ? 'Lock off' : 'Wrong PIN', ok ? 'PIN lock removed.' : 'That PIN does not match.');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.pageTitle}>CONFIG</Text>

        {/* Vault stats */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>THE VAULT</Text>
          <Text style={styles.statLine}>DUMPS — {items.length}</Text>
          <Text style={styles.statLine}>PINNED — {pinnedCount}</Text>
          <Text style={styles.statLine}>TO-DOS — {todoCount}</Text>
          <Text style={styles.statLine}>PRIVATE — {privateCount}</Text>
          <Text style={styles.statLine}>BLOCKS — {folders.length}</Text>
        </View>

        {/* Data */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>BACKUP & MIGRATE</Text>
          <Text style={styles.cardHint}>
            JSON carries everything (notes, tags, pins, AI analysis, blocks).
            PDF is a read-only printout for reading later.
          </Text>
          <Pressable style={styles.btn} onPress={doExportJson} disabled={working}>
            <Text style={styles.btnText}>EXPORT VAULT — JSON</Text>
          </Pressable>
          <Pressable style={styles.btn} onPress={doExportPdf} disabled={working}>
            <Text style={styles.btnText}>EXPORT VAULT — PDF</Text>
          </Pressable>
          <Pressable style={styles.btnSecondary} onPress={doImportJson} disabled={working}>
            <Text style={styles.btnSecondaryText}>IMPORT VAULT — JSON</Text>
          </Pressable>
        </View>

        {/* Security */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>LOCK</Text>
          <Text style={styles.cardHint}>
            {lockEnabled === null
              ? '…'
              : lockEnabled
                ? 'DumpIT locks on cold start. Enter the PIN to remove the lock.'
                : 'Set a PIN (4+ digits) and DumpIT locks on cold start. Items marked PRIVATE stay hidden until unlocked.'}
          </Text>
          <TextInput
            value={pinInput}
            onChangeText={setPinInput}
            placeholder={lockEnabled ? 'CURRENT PIN' : 'NEW PIN'}
            placeholderTextColor={colors.faint}
            style={styles.pinInput}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={12}
          />
          {lockEnabled ? (
            <Pressable style={styles.btnSecondary} onPress={handleClearPin}>
              <Text style={styles.btnSecondaryText}>REMOVE LOCK</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.btn} onPress={handleSetPin}>
              <Text style={styles.btnText}>ENABLE LOCK</Text>
            </Pressable>
          )}
        </View>

        <Text style={styles.footNote}>
          PRIVATE SPACE: mark any dump private from its detail page. Private dumps are hidden
          from the inbox and search until the PIN is entered. The PIN gates the whole app.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: 20,
    gap: 16,
    paddingBottom: 40,
  },
  pageTitle: {
    fontFamily: fonts.display,
    fontSize: 28,
    letterSpacing: 4,
    color: colors.text,
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: borders.thick,
    borderColor: colors.border,
    padding: 14,
    gap: 8,
  },
  cardTitle: {
    fontFamily: fonts.display,
    fontSize: 13,
    letterSpacing: 2,
    color: colors.text,
    borderBottomWidth: borders.base,
    borderBottomColor: colors.border,
    paddingBottom: 8,
  },
  cardHint: {
    fontFamily: fonts.body,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  statLine: {
    fontFamily: fonts.mono,
    color: colors.text,
    fontSize: 12,
    letterSpacing: 1,
  },
  btn: {
    backgroundColor: colors.accent,
    borderWidth: borders.thick,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  btnText: {
    fontFamily: fonts.label,
    color: colors.ink,
    fontSize: 12,
    letterSpacing: 2,
  },
  btnSecondary: {
    backgroundColor: colors.bg,
    borderWidth: borders.thick,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  btnSecondaryText: {
    fontFamily: fonts.label,
    color: colors.text,
    fontSize: 12,
    letterSpacing: 2,
  },
  pinInput: {
    fontFamily: fonts.mono,
    backgroundColor: colors.sunken,
    borderWidth: borders.thick,
    borderColor: colors.border,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 16,
    letterSpacing: 8,
    color: colors.text,
  },
  footNote: {
    fontFamily: fonts.body,
    color: colors.faint,
    fontSize: 12,
    lineHeight: 18,
    borderWidth: borders.base,
    borderColor: colors.faint,
    borderStyle: 'dashed',
    padding: 12,
  },
});

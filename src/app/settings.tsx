import { useEffect, useState } from 'react';
import { ScrollView, View, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import {
  Appbar,
  Button,
  Card,
  SegmentedButtons,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { mergeVaults, parseVaultJson, shareExportJson, shareExportPdf } from '@/lib/vault';
import { isLockEnabled, setPin, clearPin } from '@/lib/pin';
import { useDumpStore } from '@/lib/dump-store';
import type { ThemeMode } from '@/lib/themes';

export default function SettingsScreen() {
  const theme = useTheme();
  const { items, folders, replaceAll, themeMode, setThemeMode } = useDumpStore();
  const [pinInput, setPinInput] = useState('');
  const [lockEnabled, setLockEnabled] = useState<boolean | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    isLockEnabled().then(setLockEnabled);
  }, []);

  const pinnedCount = items.filter((i) => i.pinned).length;
  const todoCount = items.filter((i) => i.ai?.status === 'done' && i.ai.category === 'todo').length;
  const privateCount = items.filter((i) => i.isPrivate).length;

  const doExportJson = async () => {
    setWorking(true);
    try { await shareExportJson(items, folders); } finally { setWorking(false); }
  };

  const doExportPdf = async () => {
    setWorking(true);
    try { await shareExportPdf(items, folders); } catch (e) {
      Alert.alert('Export failed', e instanceof Error ? e.message : String(e));
    } finally { setWorking(false); }
  };

  const doImportJson = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.[0]) return;
    try {
      const raw = await new File(result.assets[0].uri).text();
      const imported = parseVaultJson(raw);
      const merged = mergeVaults(items, folders, imported);
      Alert.alert(
        'Import vault?',
        `Merge ${imported.items.length} dumps + ${imported.folders.length} blocks? Current items are kept.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Import', onPress: () => { replaceAll(merged.items, merged.folders); Alert.alert('Done', 'Vault merged.'); } },
        ]
      );
    } catch (e) {
      Alert.alert('Import failed', e instanceof Error ? e.message : String(e));
    }
  };

  const handleSetPin = async () => {
    if (pinInput.length < 4) return Alert.alert('PIN too short', 'Use at least 4 digits.');
    const ok = await setPin(pinInput);
    setPinInput('');
    setLockEnabled(ok);
    Alert.alert(ok ? 'Lock on' : 'Failed', ok ? 'DumpIT locks on cold start.' : 'Could not store the PIN.');
  };

  const handleClearPin = async () => {
    if (pinInput.length < 4) return Alert.alert('Enter PIN', 'Type your current PIN above to remove it.');
    const ok = await clearPin(pinInput);
    setPinInput('');
    setLockEnabled(ok ? false : lockEnabled);
    Alert.alert(ok ? 'Lock off' : 'Wrong PIN', ok ? 'PIN lock removed.' : 'That PIN does not match.');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['bottom']}>
      <Appbar.Header elevated={false} style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Settings" titleStyle={{ fontSize: 17, fontWeight: '600' }} />
      </Appbar.Header>
      <ScrollView contentContainerStyle={{ padding: 12, gap: 12, paddingBottom: 40 }}>

        {/* Theme */}
        <Card mode="contained" style={{ backgroundColor: theme.colors.surfaceVariant }}>
          <Card.Title title="Appearance" titleStyle={{ fontWeight: '700' }} left={() => <Ionicons name="color-palette-outline" size={22} color={theme.colors.primary} style={{ marginLeft: 16, marginTop: 4 }} />} />
          <Card.Content>
            <SegmentedButtons
              value={themeMode}
              onValueChange={(value) => setThemeMode(value as ThemeMode)}
              buttons={[
                { value: 'system', label: 'System' },
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
            />
          </Card.Content>
        </Card>

        {/* Vault stats */}
        <Card mode="contained" style={{ backgroundColor: theme.colors.surfaceVariant }}>
          <Card.Title title="The Vault" titleStyle={{ fontWeight: '700' }} left={() => <Ionicons name="archive-outline" size={22} color={theme.colors.primary} style={{ marginLeft: 16, marginTop: 4 }} />} />
          <Card.Content style={{ gap: 2 }}>
            {['Dumps', 'Pinned', 'To-dos', 'Private', 'Blocks'].map((label) => (
              <View key={label} style={stylesRow}>
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>{label}</Text>
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurface, fontWeight: '800' }}>
                  {label === 'Dumps' ? items.length : label === 'Pinned' ? pinnedCount : label === 'To-dos' ? todoCount : label === 'Private' ? privateCount : folders.length}
                </Text>
              </View>
            ))}
          </Card.Content>
        </Card>

        {/* Backup */}
        <Card mode="contained" style={{ backgroundColor: theme.colors.surfaceVariant }}>
          <Card.Title title="Backup & migrate" titleStyle={{ fontWeight: '700' }} left={() => <Ionicons name="swap-horizontal-outline" size={22} color={theme.colors.primary} style={{ marginLeft: 16, marginTop: 4 }} />} />
          <Card.Content style={{ gap: 8 }}>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              JSON keeps everything — notes, tags, pins, analysis, blocks. PDF is a read-only printout.
            </Text>
            <Button mode="contained" icon="download" onPress={doExportJson} disabled={working}>Export vault — JSON</Button>
            <Button mode="contained-tonal" icon="file-pdf-box" onPress={doExportPdf} disabled={working}>Export vault — PDF</Button>
            <Button mode="outlined" icon="upload" onPress={doImportJson} disabled={working}>Import vault — JSON</Button>
          </Card.Content>
        </Card>

        {/* Lock */}
        <Card mode="contained" style={{ backgroundColor: theme.colors.surfaceVariant }}>
          <Card.Title title="Vault lock" titleStyle={{ fontWeight: '700' }} left={() => <Ionicons name="lock-closed-outline" size={22} color={theme.colors.primary} style={{ marginLeft: 16, marginTop: 4 }} />} />
          <Card.Content style={{ gap: 10 }}>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {lockEnabled === null
                ? '…'
                : lockEnabled
                  ? 'DumpIT locks on cold start. Enter the PIN to remove it.'
                  : 'Set a PIN (4+ digits) — DumpIT locks on cold start. Private items stay hidden until unlocked.'}
            </Text>
            <TextInput
              value={pinInput}
              onChangeText={setPinInput}
              placeholder={lockEnabled ? 'Current PIN' : 'New PIN'}
              keyboardType="number-pad"
              secureTextEntry
              mode="outlined"
              dense
              maxLength={12}
            />
            {lockEnabled ? (
              <Button mode="outlined" icon="lock-open-outline" onPress={handleClearPin}>Remove lock</Button>
            ) : (
              <Button mode="contained" icon="lock" onPress={handleSetPin}>Enable lock</Button>
            )}
          </Card.Content>
        </Card>

        {/* Private space explainer */}
        <Card mode="contained" style={{ backgroundColor: theme.colors.tertiaryContainer }}>
          <Card.Content style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <Ionicons name="eye-off-outline" size={22} color={theme.colors.onTertiaryContainer} />
            <Text variant="bodySmall" style={{ flex: 1, color: theme.colors.onTertiaryContainer, lineHeight: 18 }}>
              Private items stay hidden from the inbox and search until you unlock. Mark or unmark any dump as private from its detail page.
            </Text>
          </Card.Content>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
const stylesRow = { flexDirection: 'row' as const, justifyContent: 'space-between' as const, paddingVertical: 2 };

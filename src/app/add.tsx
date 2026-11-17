import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  Appbar,
  Button,
  Card,
  TextInput,
  Text,
  useTheme,
} from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';

import { useDumpStore } from '@/lib/dump-store';
import { extractUrl } from '@/lib/classify';

export default function AddDumpScreen() {
  const theme = useTheme();
  const { addManualText } = useDumpStore();
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

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
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <Appbar.Header elevated={false} style={{ backgroundColor: theme.colors.surface }}>
          <Appbar.BackAction onPress={() => router.back()} />
          <Appbar.Content title="New dump" titleStyle={{ fontSize: 17, fontWeight: '600' }} />
        </Appbar.Header>

        <Card style={{ marginHorizontal: 12, marginTop: 12, backgroundColor: theme.colors.surface, flex: 1 }}>
          <Card.Content style={{ flex: 1, gap: 12 }}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="A thought, a link, a rant…"
              multiline
              autoFocus
              mode="flat"
              underlineColor="transparent"
              activeUnderlineColor="transparent"
              style={{ backgroundColor: 'transparent', fontSize: 17, flex: 1, maxHeight: 320 }}
            />
            {detectedUrl && (
              <Text variant="bodySmall" style={{ color: theme.colors.primary, fontWeight: '600' }}>
                <Ionicons name="link" size={12} /> Saved as a link — {detectedUrl}
              </Text>
            )}
          </Card.Content>
        </Card>

        <Button
          mode="contained"
          onPress={save}
          disabled={!trimmed || saving}
          loading={saving}
          style={{ margin: 12, borderRadius: 24 }}
          contentStyle={{ paddingVertical: 12, minHeight: 52 }}
            labelStyle={{ fontSize: 15 }}
        >
          {saving ? 'Saving…' : 'Dump it'}
        </Button>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

import { useState } from 'react';
import { View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Button, Card, Text as PaperText, useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';

import { useDumpStore } from '@/lib/dump-store';

const DOC_URL =
  'https://docs.google.com/document/d/1ZhE5GJk_tVCGnUxXg7ROyrtUOEF7_TzTu84x67JvfKI/edit';
const TILAK_TWEET =
  'Tilak | AI Engineer (@tilakchow_): Edhi na personal research cheskoni prepare cheskuna AI Engineer Roadmap, Miku m aina use aithe use cheskondi mava. nen m aina miss chesi unte chepandi kastha cmt/dm chesi';
const ARTICLE_URL = 'https://blog.pragmaticengineer.com/context-engineering/';
const LINKEDIN_URL = 'https://www.linkedin.com/company/openai';
const PLAIN_TEXTS = [
  'Idea for a side project: a CLI that turns PR descriptions into changelogs.',
  'Renew domain dumpit.app before the end of March.',
  'Books to read: “Thinking in Systems”, “The Design of Everyday Things”.',
];

/** Dev tool: pushes a fake share through the real pipeline. */
export default function SimulatePanel() {
  const theme = useTheme();
  const { addFromShare } = useDumpStore();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setNote(null);
    try {
      await fn();
      setNote(`${label} saved`);
    } catch {
      setNote(`${label} failed`);
    } finally {
      setBusy(false);
    }
  };

  const simulateTweet = () =>
    run('Tweet', () =>
      addFromShare({ source: 'sample', text: `${TILAK_TWEET} ${DOC_URL}`, webUrl: DOC_URL })
    );

  const simulateLinkedIn = () =>
    run('LinkedIn', () =>
      addFromShare({ source: 'sample', text: LINKEDIN_URL, webUrl: LINKEDIN_URL })
    );

  const simulateArticle = () =>
    run('Article', () =>
      addFromShare({ source: 'sample', text: ARTICLE_URL, webUrl: ARTICLE_URL })
    );

  const simulateText = () =>
    run('Plain text', () =>
      addFromShare({
        source: 'sample',
        text: PLAIN_TEXTS[Math.floor(Math.random() * PLAIN_TEXTS.length)],
      })
    );

  const simulateScreenshot = () =>
    run('Screenshot', async () => {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.9,
        allowsEditing: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      await addFromShare({
        source: 'sample',
        files: [{ path: asset.uri, mimeType: asset.mimeType ?? 'image/jpeg', fileName: asset.fileName ?? 'screenshot.jpg' }],
      });
    });

  return (
    <Card
      mode="contained"
      style={{ backgroundColor: theme.colors.surfaceVariant, marginHorizontal: 0, marginBottom: 96 }}
    >
      <Card.Content style={{ gap: 10, paddingVertical: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="flask-outline" size={16} color={theme.colors.onSurfaceVariant} />
          <PaperText variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
            SIMULATE INCOMING SHARE
          </PaperText>
        </View>
        <PaperText variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          A fake share, pushed through the real pipeline. The share sheet itself needs a dev build.
        </PaperText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Button mode="outlined" compact onPress={simulateTweet} disabled={busy}>X / Twitter</Button>
          <Button mode="outlined" compact onPress={simulateLinkedIn} disabled={busy}>LinkedIn</Button>
          <Button mode="outlined" compact onPress={simulateArticle} disabled={busy}>Article</Button>
          <Button mode="outlined" compact onPress={simulateText} disabled={busy}>Plain text</Button>
          <Button mode="outlined" compact onPress={simulateScreenshot} disabled={busy}>Screenshot…</Button>
        </View>
        {note && (
          <PaperText variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {note}
          </PaperText>
        )}
      </Card.Content>
    </Card>
  );
}

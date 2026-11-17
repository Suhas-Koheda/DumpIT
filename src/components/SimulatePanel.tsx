import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { useDumpStore } from '@/lib/dump-store';
import { borders, colors, fonts } from '@/lib/theme';

const DOC_URL =
  'https://docs.google.com/document/d/1ZhE5GJk_tVCGnUxXg7ROyrtUOEF7_TzTu84x67JvfKI/edit';
const TILAK_TWEET =
  'Tilak | AI Engineer (@tilakchow_): Edhi na personal research cheskoni prepare cheskuna AI Engineer Roadmap, Miku m aina use aithe use cheskondi mava. nen m aina miss chesi unte chepandi kastha cmt/dm chesi';
const LINKEDIN_URL = 'https://www.linkedin.com/company/openai';
const ARTICLE_URL = 'https://blog.pragmaticengineer.com/context-engineering/';

const SAMPLE_TEXTS = [
  'Idea for side project: a CLI that turns PR descriptions into changelogs. Check npm trends this weekend.',
  'Milk, eggs, coffee. Also: renew domain dumpit.app before March.',
  'Books to read: “Thinking in Systems”, “The Design of Everyday Things”.',
];

/** Dev tool: pushes a fake share through the real pipeline. */
export default function SimulatePanel() {
  const { addFromShare } = useDumpStore();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setNote(null);
    setError(false);
    try {
      await fn();
      setNote(`${label.toUpperCase()} — SAVED`);
    } catch {
      setError(true);
      setNote(`${label.toUpperCase()} — FAILED`);
    } finally {
      setBusy(false);
    }
  };

  const simulateTweet = () =>
    run('Tweet', () =>
      addFromShare({
        source: 'sample',
        text: TILAK_TWEET + ' ' + DOC_URL,
        webUrl: DOC_URL,
      })
    );

  const simulateLinkedIn = () =>
    run('LinkedIn', () =>
      addFromShare({
        source: 'sample',
        text: LINKEDIN_URL,
        webUrl: LINKEDIN_URL,
      })
    );

  const simulateArticle = () =>
    run('Article', () =>
      addFromShare({
        source: 'sample',
        text: `The Pragmatic Engineer: context engineering, explained ${ARTICLE_URL}`,
        webUrl: ARTICLE_URL,
        metaTitle: 'Context engineering, explained',
      })
    );

  const simulateText = () =>
    run('Plain text', () =>
      addFromShare({
        source: 'sample',
        text: SAMPLE_TEXTS[Math.floor(Math.random() * SAMPLE_TEXTS.length)],
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
        files: [
          {
            path: asset.uri,
            mimeType: asset.mimeType ?? 'image/jpeg',
            fileName: asset.fileName ?? 'screenshot.jpg',
          },
        ],
      });
    });

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>SIMULATE SHARE (DEV)</Text>
      <Text style={styles.hint}>
        Pushes a fake share through the real pipeline. True share-sheet delivery needs a dev build.
      </Text>
      <View style={styles.row}>
        <SimButton label="X / TWITTER" onPress={simulateTweet} disabled={busy} />
        <SimButton label="LINKEDIN" onPress={simulateLinkedIn} disabled={busy} />
        <SimButton label="WEB LINK" onPress={simulateArticle} disabled={busy} />
      </View>
      <View style={styles.row}>
        <SimButton label="PLAIN TEXT" onPress={simulateText} disabled={busy} />
        <SimButton label="SCREENSHOT" onPress={simulateScreenshot} disabled={busy} />
      </View>
      {note && <Text style={[styles.note, error && styles.noteError]}>{note}</Text>}
    </View>
  );
}

function SimButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.simBtn, pressed && styles.simBtnPressed]}
    >
      {({ pressed }) => (
        <Text style={[styles.simBtnText, pressed && styles.simBtnTextPressed]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginTop: 8,
    marginHorizontal: 16,
    marginBottom: 100,
    padding: 14,
    backgroundColor: colors.sunken,
    borderWidth: borders.base,
    borderColor: colors.border,
    borderRadius: 0,
    gap: 10,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 13,
    letterSpacing: 2,
    color: colors.text,
  },
  hint: {
    fontFamily: fonts.body,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  simBtn: {
    backgroundColor: colors.bg,
    borderWidth: borders.base,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 0,
  },
  simBtnPressed: {
    backgroundColor: colors.accent,
  },
  simBtnText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.text,
  },
  simBtnTextPressed: {
    color: colors.ink,
  },
  note: {
    fontFamily: fonts.mono,
    color: colors.success,
    fontSize: 11,
    letterSpacing: 1,
  },
  noteError: {
    color: colors.error,
  },
});

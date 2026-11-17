import { View } from 'react-native';
import { ActivityIndicator, Button, Card, ProgressBar, Text as PaperText, useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';

import { useDumpStore } from '@/lib/dump-store';
import { TOTAL_MODEL_BYTES } from '@/lib/ai-models';

/** Purple-free, server-free: on-device Oracle onboarding. */
export default function AiOnboardCard() {
  const theme = useTheme();
  const { aiState, aiProgress, enableAiDownload, items } = useDumpStore();

  if (aiState === 'ready') return null;

  const analyzing = items.filter((item) => item.ai?.status === 'analyzing').length;
  const totalMb = Math.round(TOTAL_MODEL_BYTES / 1024 / 1024);

  return (
    <Card mode="elevated" style={{ backgroundColor: theme.colors.secondaryContainer, marginHorizontal: 0, marginBottom: 8 }}>
      <Card.Content style={{ gap: 8, paddingVertical: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="sparkles" size={18} color={theme.colors.onSecondaryContainer} />
          <PaperText variant="titleSmall" style={{ color: theme.colors.onSecondaryContainer, fontWeight: '700' }}>
            The Oracle — on-device AI
          </PaperText>
        </View>

        {aiState === 'unavailable' ? (
          <PaperText variant="bodySmall" style={{ color: theme.colors.onSecondaryContainer }}>
            On-device AI cannot run inside Expo Go. Build once with{' '}
            <PaperText variant="bodySmall" style={{ fontFamily: 'monospace', color: theme.colors.onSecondaryContainer }}>
              npx expo run:android
            </PaperText>{' '}
            and everything works offline.
          </PaperText>
        ) : aiState === 'downloading' ? (
          <>
            <PaperText variant="bodySmall" style={{ color: theme.colors.onSecondaryContainer }}>
              {aiProgress
                ? `${aiProgress.stage === 'llm' ? 'Qwen2.5-0.5B' : 'nomic-embed'} — ${Math.round(
                    (aiProgress.receivedBytes / aiProgress.totalBytes) * 100
                  )}% of ~${totalMb} MB`
                : 'Preparing download…'}
            </PaperText>
            <ProgressBar
              progress={aiProgress ? aiProgress.receivedBytes / aiProgress.totalBytes : 0}
              color={theme.colors.onSecondaryContainer}
            />
            {analyzing > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ActivityIndicator size="small" color={theme.colors.onSecondaryContainer} />
                <PaperText variant="bodySmall" style={{ color: theme.colors.onSecondaryContainer }}>
                  {analyzing} item{analyzing === 1 ? '' : 's'} analyze themselves once the models land
                </PaperText>
              </View>
            )}
          </>
        ) : (
          <>
            <PaperText variant="bodySmall" style={{ color: theme.colors.onSecondaryContainer }}>
              One-time ~{totalMb} MB download (Wi-Fi, then fully offline). Qwen2.5-0.5B summarizes
              and extracts; nomic-embed powers meaning search.
            </PaperText>
            <Button mode="contained" onPress={enableAiDownload} icon="download-outline">
              Download both models
            </Button>
          </>
        )}
      </Card.Content>
    </Card>
  );
}

import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';

import { useDumpStore } from '@/lib/dump-store';
import { TOTAL_MODEL_BYTES } from '@/lib/ai-models';
import { borders, colors, fonts } from '@/lib/theme';

/** RawBlock onboarding for the on-device Oracle. Hidden once models are ready. */
export default function AiOnboardCard() {
  const { aiState, aiProgress, enableAiDownload, items } = useDumpStore();

  if (aiState === 'ready') return null;

  const analyzing = items.filter((item) => item.ai?.status === 'analyzing').length;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>THE ORACLE</Text>
      {aiState === 'unavailable' ? (
        <>
          <Text style={styles.body}>
            On-device AI needs a development build. Run npx expo run:android once — after that
            everything works offline.
          </Text>
        </>
      ) : aiState === 'downloading' ? (
        <>
          <Text style={styles.body}>
            {aiProgress
              ? `${aiProgress.stage === 'llm' ? 'Qwen2.5-0.5B' : 'nomic-embed'} — ${Math.round(
                  (aiProgress.receivedBytes / aiProgress.totalBytes) * 100
                )}% of ~${Math.round(TOTAL_MODEL_BYTES / 1024 / 1024)} MB`
              : 'PREPARING DOWNLOAD'}
          </Text>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                {
                  width: `${Math.round(
                    ((aiProgress?.receivedBytes ?? 0) / TOTAL_MODEL_BYTES) * 100
                  )}%`,
                },
              ]}
            />
          </View>
          {analyzing > 0 && (
            <View style={styles.footRow}>
              <ActivityIndicator size="small" color={colors.text} />
              <Text style={styles.footText}>QUEUE RUNS ONCE MODELS LAND</Text>
            </View>
          )}
        </>
      ) : (
        <>
          <Text style={styles.body}>
            One-time ~{Math.round(TOTAL_MODEL_BYTES / 1024 / 1024)} MB download (Wi-Fi, then fully
            offline). Qwen2.5-0.5B summarizes and extracts; nomic-embed powers meaning search.
          </Text>
          <Pressable style={styles.cta} onPress={enableAiDownload}>
            <Text style={styles.ctaText}>DOWNLOAD BOTH MODELS →</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: colors.card,
    borderWidth: borders.heavy,
    borderColor: colors.border,
    borderRadius: 0,
    padding: 16,
    gap: 10,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 22,
    letterSpacing: 2,
    color: colors.text,
  },
  body: {
    fontFamily: fonts.body,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  barTrack: {
    height: 22,
    backgroundColor: colors.sunken,
    borderWidth: borders.thick,
    borderColor: colors.border,
  },
  barFill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  cta: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accent,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderWidth: borders.thick,
    borderColor: colors.border,
  },
  ctaText: {
    fontFamily: fonts.label,
    color: colors.ink,
    fontSize: 12,
    letterSpacing: 2,
  },
  footRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  footText: {
    fontFamily: fonts.mono,
    color: colors.muted,
    fontSize: 11,
    letterSpacing: 1,
  },
});

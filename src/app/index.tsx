import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Image } from 'expo-image';

import Badge from '@/components/Badge';
import AiOnboardCard from '@/components/AiOnboardCard';
import Loader from '@/components/Loader';
import SimulatePanel from '@/components/SimulatePanel';
import { useDumpStore, type AiState } from '@/lib/dump-store';
import { borders, colors, fonts } from '@/lib/theme';
import { timeAgo } from '@/lib/time';
import type { DumpItem } from '@/lib/types';

type Filter = 'all' | 'link' | 'x' | 'linkedin' | 'text' | 'image';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'link', label: 'Links' },
  { key: 'x', label: 'X/Twitter' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'text', label: 'Text' },
  { key: 'image', label: 'Shots' },
];

export default function InboxScreen() {
  const {
    items,
    hydrated,
    lastImportCount,
    dismissImportBanner,
    removeItem,
    addFromShare,
    aiState,
    semanticRank,
  } = useDumpStore();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [searchFocused, setSearchFocused] = useState(false);
  const [semantic, setSemantic] = useState(false);
  const [semOrder, setSemOrder] = useState<Map<string, number> | null>(null);

  const semanticWanted = semantic && query.trim().length >= 2 && aiState === 'ready';
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!semanticWanted) {
        setSemOrder(null);
        return;
      }
      semanticRank(query.trim(), items.map((item) => item.id)).then((ranked) => {
        setSemOrder(ranked ? new Map(ranked.map((entry, index) => [entry.id, index])) : null);
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [semanticWanted, query, items, semanticRank]);

  const semanticActive = semanticWanted && semOrder !== null;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = items.filter((item) => {
      if (filter === 'x' && !(item.kind === 'link' && item.platform === 'x')) return false;
      if (filter === 'linkedin' && !(item.kind === 'link' && item.platform === 'linkedin'))
        return false;
      if (filter === 'link' && item.kind !== 'link') return false;
      if (filter === 'text' && item.kind !== 'text') return false;
      if (filter === 'image' && item.kind !== 'image') return false;
      if (semanticActive) return true;
      if (!q) return true;
      const haystack = [
        item.title,
        item.text,
        item.url ?? '',
        item.urlHost ?? '',
        item.note,
        item.tags.join(' '),
        item.ai?.summary ?? '',
      ]
        .join('\n')
        .toLowerCase();
      return haystack.includes(q);
    });
    if (semanticActive && semOrder) {
      return [...filtered].sort((a, b) => {
        const ia = semOrder.get(a.id);
        const ib = semOrder.get(b.id);
        if (ia === undefined && ib === undefined) return b.createdAt - a.createdAt;
        if (ia === undefined) return 1;
        if (ib === undefined) return -1;
        return ia - ib;
      });
    }
    return filtered;
  }, [items, query, filter, semanticActive, semOrder]);

  const totalCount = items.length;

  const confirmDelete = (item: DumpItem) => {
    Alert.alert('Burn this dump?', 'This removes it from your phone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removeItem(item.id) },
    ]);
  };

  const loadSamples = () => {
    addFromShare({
      source: 'sample',
      text: 'Tilak | AI Engineer (@tilakchow_): Edhi na personal research cheskoni prepare cheskuna AI Engineer Roadmap, Miku m aina use aithe use cheskondi mava. nen m aina miss chesi unte chepandi kastha cmt/dm chesi https://docs.google.com/document/d/1ZhE5GJk_tVCGnUxXg7ROyrtUOEF7_TzTu84x67JvfKI/edit',
      webUrl: 'https://docs.google.com/document/d/1ZhE5GJk_tVCGnUxXg7ROyrtUOEF7_TzTu84x67JvfKI/edit',
      metaTitle: '',
    });
    addFromShare({
      source: 'sample',
      text: 'https://www.linkedin.com/company/openai',
      webUrl: 'https://www.linkedin.com/company/openai',
      metaTitle: '',
    });
    addFromShare({
      source: 'sample',
      text: 'Idea: inbox zero, but for links — dump everything here, sort later.',
    });
  };

  if (!hydrated) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Loader message="LOADING YOUR DUMPS" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.logo}>DUMPIT</Text>
          <Text style={styles.tagline}>Share it. Dump it. Deal with it later.</Text>
        </View>
        <View style={styles.countPill}>
          <Text style={styles.countPillText}>{totalCount}</Text>
        </View>
      </View>

      {/* Import banner — status chip style */}
      {lastImportCount > 0 && (
        <Pressable style={styles.banner} onPress={dismissImportBanner}>
          <Text style={styles.bannerText}>
            +{lastImportCount} {lastImportCount === 1 ? 'DUMP' : 'DUMPS'} RECEIVED — TAP TO DISMISS
          </Text>
        </Pressable>
      )}

      {/* Search */}
      <View style={[styles.searchRow, searchFocused && styles.searchRowFocused]}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          placeholder="SEARCH DUMPS, TAGS, NOTES"
          placeholderTextColor={colors.faint}
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={10} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>×</Text>
          </Pressable>
        )}
        {aiState === 'ready' && (
          <Pressable
            onPress={() => setSemantic((value) => !value)}
            hitSlop={10}
            style={[styles.aiChip, semantic && styles.aiChipActive]}
            accessibilityLabel="Toggle semantic search"
          >
            <Text style={[styles.aiChipText, semantic && styles.aiChipTextActive]}>AI</Text>
          </Pressable>
        )}
      </View>
      {semanticActive && <Text style={styles.semanticHint}>AI-RANKED BY MEANING</Text>}

      {/* Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
      >
        {FILTERS.map(({ key, label }) => {
          const active = filter === key;
          return (
            <Pressable
              key={key}
              onPress={() => setFilter(key)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {label.toUpperCase()}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* List */}
      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <DumpCard
            item={item}
            onPress={() => router.push(`/item/${item.id}`)}
            onDelete={() => confirmDelete(item)}
            aiState={aiState}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>
              {query || filter !== 'all' ? 'NOTHING FOUND' : 'NOTHING IN THE VAULT'}
            </Text>
            <Text style={styles.emptyHint}>
              {query || filter !== 'all'
                ? 'Try a different search or filter.'
                : 'Share any text, tweet, LinkedIn post or screenshot to DumpIT and it shows up here.'}
            </Text>
            {!query && filter === 'all' && (
              <Pressable style={styles.sampleBtn} onPress={loadSamples}>
                <Text style={styles.sampleBtnText}>CLAIM SAMPLE DUMPS</Text>
              </Pressable>
            )}
          </View>
        }
        ListHeaderComponent={<AiOnboardCard />}
        ListFooterComponent={<SimulatePanel />}
      />

      {/* FAB — hard square */}
      <Pressable
        style={styles.fab}
        onPress={() => router.push('/add')}
        accessibilityLabel="Add dump"
      >
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </SafeAreaView>
  );
}

function DumpCard({
  item,
  onPress,
  onDelete,
  aiState,
}: {
  item: DumpItem;
  onPress: () => void;
  onDelete: () => void;
  aiState: AiState;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.cardTopRow}>
        <Badge item={item} />
        <View style={styles.cardTopRight}>
          <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
          <Pressable onPress={onDelete} hitSlop={10} style={styles.delBtn}>
            <Text style={styles.delBtnText}>DEL</Text>
          </Pressable>
        </View>
      </View>

      {item.kind === 'image' && item.imageUri ? (
        <Image source={{ uri: item.imageUri }} style={styles.thumb} contentFit="cover" transition={0} />
      ) : null}

      <Text style={styles.cardTitle} numberOfLines={2}>
        {item.title}
      </Text>
      {item.text && item.kind !== 'image' ? (
        <Text style={styles.cardSnippet} numberOfLines={2}>
          {item.text}
        </Text>
      ) : null}

      {item.ai?.status === 'done' && item.ai.summary ? (
        <View style={styles.aiRow}>
          <Text style={styles.aiPrefix}>AI:</Text>
          <Text style={styles.aiSummary} numberOfLines={2}>
            {item.ai.summary}
          </Text>
        </View>
      ) : item.ai && (item.ai.status === 'pending' || item.ai.status === 'analyzing') ? (
        <View style={styles.aiRow}>
          <Text style={styles.aiPrefix}>AI:</Text>
          <Text style={styles.aiReading}>
            {aiState === 'ready' ? 'THE ORACLE IS READING…' : 'WAITING FOR THE ORACLE (SEE BANNER)'}
          </Text>
        </View>
      ) : null}

      <View style={styles.cardBottomRow}>
        {item.urlHost ? <Text style={styles.host}>{item.urlHost}</Text> : null}
        {item.note ? (
          <View style={styles.noteFlag}>
            <Text style={styles.noteFlagText}>NOTE</Text>
          </View>
        ) : null}
        {item.tags.slice(0, 3).map((tag) => (
          <View key={tag} style={styles.tag}>
            <Text style={styles.tagText}>#{tag}</Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: borders.thick,
    borderBottomColor: colors.border,
  },
  logo: {
    fontFamily: fonts.display,
    fontSize: 42,
    letterSpacing: 3,
    color: colors.text,
    lineHeight: 46,
  },
  tagline: {
    fontFamily: fonts.body,
    color: colors.muted,
    fontSize: 13,
    marginTop: 4,
  },
  countPill: {
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  countPillText: {
    fontFamily: fonts.mono,
    color: colors.ink,
    fontSize: 16,
  },
  banner: {
    marginHorizontal: 20,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: borders.base,
    borderColor: colors.success,
  },
  bannerText: {
    fontFamily: fonts.mono,
    color: colors.success,
    fontSize: 11,
    letterSpacing: 1,
    textAlign: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 12,
    paddingHorizontal: 12,
    height: 46,
    backgroundColor: colors.sunken,
    borderWidth: borders.thick,
    borderColor: colors.border,
  },
  searchRowFocused: {
    borderWidth: borders.heavy,
    paddingHorizontal: 10,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.mono,
    color: colors.text,
    fontSize: 14,
    paddingVertical: 0,
  },
  clearBtn: {
    paddingHorizontal: 6,
  },
  clearBtnText: {
    fontFamily: fonts.bodySemi,
    fontSize: 20,
    color: colors.text,
  },
  aiChip: {
    borderWidth: borders.base,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 6,
  },
  aiChipActive: {
    backgroundColor: colors.accent,
  },
  aiChipText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.text,
  },
  aiChipTextActive: {
    color: colors.ink,
  },
  semanticHint: {
    fontFamily: fonts.mono,
    color: colors.muted,
    fontSize: 10,
    letterSpacing: 1,
    marginHorizontal: 22,
    marginTop: 4,
  },
  filters: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: borders.base,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  chipActive: {
    backgroundColor: colors.accent,
  },
  chipText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.5,
    color: colors.text,
  },
  chipTextActive: {
    color: colors.ink,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 12,
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: borders.thick,
    borderColor: colors.border,
    padding: 14,
    gap: 8,
    borderRadius: 0,
  },
  cardPressed: {
    backgroundColor: colors.sunken,
    borderWidth: borders.heavy,
    padding: 13,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  time: {
    fontFamily: fonts.mono,
    color: colors.faint,
    fontSize: 11,
  },
  delBtn: {
    borderWidth: borders.base,
    borderColor: colors.border,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  delBtnText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.text,
  },
  thumb: {
    width: '100%',
    height: 150,
    borderWidth: borders.base,
    borderColor: colors.border,
    backgroundColor: colors.sunken,
  },
  cardTitle: {
    fontFamily: fonts.bodySemi,
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
  },
  cardSnippet: {
    fontFamily: fonts.body,
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
  },
  aiRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: borders.base,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  aiPrefix: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.text,
    letterSpacing: 1,
  },
  aiSummary: {
    flex: 1,
    fontFamily: fonts.body,
    color: colors.text,
    fontSize: 11,
    lineHeight: 15,
  },
  aiReading: {
    flex: 1,
    fontFamily: fonts.mono,
    color: colors.muted,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  host: {
    fontFamily: fonts.mono,
    color: colors.blue,
    fontSize: 11,
    textDecorationLine: 'underline',
  },
  noteFlag: {
    borderWidth: borders.base,
    borderColor: colors.border,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  noteFlagText: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1.5,
    color: colors.text,
  },
  tag: {
    backgroundColor: colors.sunken,
    borderWidth: borders.thin,
    borderColor: colors.border,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagText: {
    fontFamily: fonts.mono,
    color: colors.muted,
    fontSize: 10,
  },
  empty: {
    alignItems: 'center',
    gap: 12,
    paddingTop: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontFamily: fonts.display,
    fontSize: 20,
    letterSpacing: 2,
    color: colors.text,
  },
  emptyHint: {
    fontFamily: fonts.body,
    color: colors.muted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  sampleBtn: {
    marginTop: 8,
    backgroundColor: colors.accent,
    borderWidth: borders.thick,
    borderColor: colors.border,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  sampleBtnText: {
    fontFamily: fonts.label,
    color: colors.ink,
    fontSize: 12,
    letterSpacing: 2,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 28,
    width: 60,
    height: 60,
    backgroundColor: colors.accent,
    borderWidth: borders.thick,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabText: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 30,
    lineHeight: 32,
  },
});

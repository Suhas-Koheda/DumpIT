import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import {
  Appbar,
  Card,
  Chip,
  FAB,
  IconButton,
  Searchbar,
  Surface,
  Text as PaperText,
  useTheme,
} from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';

import Badge from '@/components/Badge';
import AiOnboardCard from '@/components/AiOnboardCard';
import Loader from '@/components/Loader';
import SimulatePanel from '@/components/SimulatePanel';
import { useDumpStore, type AiState } from '@/lib/dump-store';
import { timeAgo } from '@/lib/time';
import type { DumpItem } from '@/lib/types';

type Filter = 'all' | 'link' | 'x' | 'linkedin' | 'text' | 'image' | 'private';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'link', label: 'Links' },
  { key: 'x', label: 'X/Twitter' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'text', label: 'Text' },
  { key: 'image', label: 'Shots' },
  { key: 'private', label: 'Private' },
];

export default function InboxScreen() {
  const theme = useTheme();
  const {
    items,
    hydrated,
    lastImportCount,
    dismissImportBanner,
    removeItem,
    addFromShare,
    aiState,
    semanticRank,
    folders,
    addFolder,
  } = useDumpStore();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [semantic, setSemantic] = useState(false);
  const [semOrder, setSemOrder] = useState<Map<string, number> | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [folderInputOpen, setFolderInputOpen] = useState(false);
  const [folderName, setFolderName] = useState('');

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
      if (filter === 'private') return item.isPrivate;
      if (item.isPrivate) return false;
      if (folderId && item.folderId !== folderId) return false;
      if (filter === 'x' && !(item.kind === 'link' && item.platform === 'x')) return false;
      if (filter === 'linkedin' && !(item.kind === 'link' && item.platform === 'linkedin'))
        return false;
      if (filter === 'link' && item.kind !== 'link') return false;
      if (filter === 'text' && item.kind !== 'text') return false;
      if (filter === 'image' && item.kind !== 'image') return false;
      if (category && (item.ai?.status !== 'done' || item.ai.category !== category)) return false;
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
    const withPinnedFirst = [...filtered].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return 0;
    });
    if (semanticActive && semOrder) {
      return withPinnedFirst.sort((a, b) => {
        const ia = semOrder.get(a.id);
        const ib = semOrder.get(b.id);
        if (ia === undefined && ib === undefined) return b.createdAt - a.createdAt;
        if (ia === undefined) return 1;
        if (ib === undefined) return -1;
        return ia - ib;
      });
    }
    if (!semanticActive) {
      return [...withPinnedFirst].sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return b.createdAt - a.createdAt;
      });
    }
    return withPinnedFirst;
  }, [items, query, filter, semanticActive, semOrder, category, folderId]);

  const totalCount = items.length;
  const presentCategories = useMemo(
    () =>
      Array.from(
        items
          .reduce((map, item) => {
            if (item.ai?.status === 'done') {
              map.set(item.ai.category, (map.get(item.ai.category) ?? 0) + 1);
            }
            return map;
          }, new Map<string, number>())
          .entries()
      ).sort((a, b) => b[1] - a[1]),
    [items]
  );

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
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
        <Loader message="Loading your dumps" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
      {/* Top app bar */}
      <Appbar.Header elevated={false} style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.Content
          title="DumpIT"
          titleStyle={{ fontWeight: '800', fontSize: 22, color: theme.colors.primary }}
          subtitle="Share it. Dump it. Deal with it later."
          subtitleStyle={{ fontSize: 11, color: theme.colors.onSurfaceVariant }}
        />
        <IconButton
          icon="view-column-outline"
          onPress={() => router.push('/board')}
          iconColor={theme.colors.onSurfaceVariant}
        />
        <IconButton
          icon="calendar-month-outline"
          onPress={() => router.push('/calendar')}
          iconColor={theme.colors.onSurfaceVariant}
        />
        <IconButton
          icon="cog-outline"
          onPress={() => router.push('/settings')}
          iconColor={theme.colors.onSurfaceVariant}
        />
        <Surface
          elevation={0}
          style={{
            borderRadius: 14,
            backgroundColor: theme.colors.primaryContainer,
            paddingHorizontal: 12,
            paddingVertical: 6,
            marginRight: 8,
          }}
        >
          <PaperText style={{ fontWeight: '800', color: theme.colors.onPrimaryContainer }}>
            {totalCount}
          </PaperText>
        </Surface>
      </Appbar.Header>

      {/* Import banner */}
      {lastImportCount > 0 && (
        <Pressable
          onPress={dismissImportBanner}
          style={{
            marginHorizontal: 12,
            marginTop: 8,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 12,
            backgroundColor: theme.colors.tertiaryContainer,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Ionicons name="checkmark-circle" size={18} color={theme.colors.onTertiaryContainer} />
          <PaperText style={{ flex: 1, color: theme.colors.onTertiaryContainer, fontSize: 13 }}>
            +{lastImportCount} {lastImportCount === 1 ? 'dump' : 'dumps'} saved
          </PaperText>
          <Ionicons name="close" size={16} color={theme.colors.onTertiaryContainer} />
        </Pressable>
      )}

      {/* Search */}
      <View style={{ paddingHorizontal: 12, paddingTop: 8, gap: 6 }}>
        <Searchbar
          value={query}
          onChangeText={setQuery}
          placeholder="Search dumps, tags, notes…"
          style={{ backgroundColor: theme.colors.surfaceVariant, elevation: 0 }}
          inputStyle={{ minHeight: 0 }}
          iconColor={theme.colors.onSurfaceVariant}
          clearIcon="close"
          onClearIconPress={() => setQuery('')}
          traileringIcon={aiState === 'ready' ? (semantic ? 'sparkles' : 'sparkles-outline') : undefined}
          onTraileringIconPress={() => setSemantic((v) => !v)}
        />
        {semanticActive && (
          <PaperText style={{ fontSize: 11, color: theme.colors.onSurfaceVariant, paddingLeft: 8 }}>
            ✨ Ranked by on-device embeddings
          </PaperText>
        )}
      </View>

      {/* Type filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 10, gap: 8 }}
      >
        {FILTERS.map(({ key, label }) => (
          <Chip
            key={key}
            compact
            selected={filter === key}
            onPress={() => setFilter(key)}
            showSelectedOverlay={false}
            selectedColor={theme.colors.onPrimaryContainer}
            style={{
              backgroundColor:
                filter === key ? theme.colors.primaryContainer : theme.colors.surfaceVariant,
            }}
            textStyle={{ fontSize: 13, fontWeight: filter === key ? '700' : '400' }}
          >
            {label}
          </Chip>
        ))}
      </ScrollView>

      {/* Category filters (derived from what the Oracle classified) */}
      {presentCategories.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 6, gap: 8 }}
        >
          <Chip
            compact
            selected={category === null}
            onPress={() => setCategory(null)}
            showSelectedOverlay={false}
            style={{
              backgroundColor:
                category === null ? theme.colors.secondaryContainer : theme.colors.surfaceVariant,
            }}
            textStyle={{ fontSize: 12 }}
          >
            All categories
          </Chip>
          {presentCategories.map(([name, count]) => (
            <Chip
              key={name}
              compact
              selected={category === name}
              onPress={() => setCategory(category === name ? null : name)}
              showSelectedOverlay={false}
              style={{
                backgroundColor:
                  category === name
                    ? theme.colors.secondaryContainer
                    : theme.colors.surfaceVariant,
              }}
              textStyle={{ fontSize: 12 }}
            >
              {name} · {count}
            </Chip>
          ))}
        </ScrollView>
      )}

      {/* Blocks / folders */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 6, gap: 8, alignItems: 'center' }}
      >
        <Chip
          compact
          selected={folderId === null}
          onPress={() => setFolderId(null)}
          showSelectedOverlay={false}
          style={{
            backgroundColor:
              folderId === null ? theme.colors.tertiaryContainer : theme.colors.surfaceVariant,
          }}
          textStyle={{ fontSize: 12 }}
        >
          All blocks
        </Chip>
        {folders.map((folder) => (
          <Chip
            key={folder.id}
            compact
            selected={folderId === folder.id}
            onPress={() => setFolderId(folderId === folder.id ? null : folder.id)}
            showSelectedOverlay={false}
            avatar={
              <View
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 8,
                  backgroundColor: folder.color,
                }}
              />
            }
            style={{
              backgroundColor:
                folderId === folder.id
                  ? theme.colors.tertiaryContainer
                  : theme.colors.surfaceVariant,
            }}
            textStyle={{ fontSize: 12 }}
          >
            {folder.name}
          </Chip>
        ))}
        {folderInputOpen ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <TextInput
              autoFocus
              value={folderName}
              onChangeText={setFolderName}
              placeholder="Block name"
              placeholderTextColor={theme.colors.onSurfaceVariant}
              onBlur={() => {
                const name = folderName.trim();
                if (name) {
                  const palette = ['#3E5C4C', '#415E63', '#BA1A1A', '#B45309', '#4E6356'];
                  addFolder(name, palette[Math.floor(Math.random() * palette.length)]);
                }
                setFolderName('');
                setFolderInputOpen(false);
              }}
              onSubmitEditing={() => {
                const name = folderName.trim();
                if (name) {
                  const palette = ['#3E5C4C', '#415E63', '#BA1A1A', '#B45309', '#4E6356'];
                  addFolder(name, palette[Math.floor(Math.random() * palette.length)]);
                }
                setFolderName('');
                setFolderInputOpen(false);
              }}
              style={{
                borderBottomWidth: 1,
                borderBottomColor: theme.colors.primary,
                paddingHorizontal: 6,
                paddingVertical: 4,
                minWidth: 120,
                color: theme.colors.onSurface,
              }}
            />
          </View>
        ) : (
          <Chip
            compact
            mode="outlined"
            onPress={() => setFolderInputOpen(true)}
            icon="plus"
            textStyle={{ fontSize: 12 }}
          >
            Block
          </Chip>
        )}
      </ScrollView>

      {/* List */}
      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 12, paddingBottom: 100, gap: 12 }}
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
          <View style={{ alignItems: 'center', paddingTop: 48, gap: 12, paddingHorizontal: 32 }}>
            <Ionicons name="file-tray-outline" size={56} color={theme.colors.outline} />
            <PaperText variant="titleMedium"
              style={{ color: theme.colors.onSurface, fontWeight: '700' }}
            >
              {query || filter !== 'all' || category || folderId ? 'Nothing here' : 'Dump it all here'}
            </PaperText>
            <PaperText variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>
              Share tweets, LinkedIn posts, articles and screenshots straight to DumpIT.
            </PaperText>
            {!query && filter === 'all' && !category && !folderId && (
              <Pressable
                onPress={loadSamples}
                style={{
                  marginTop: 4,
                  paddingHorizontal: 20,
                  paddingVertical: 12,
                  borderRadius: 22,
                  backgroundColor: theme.colors.primary,
                }}
              >
                <PaperText
                  style={{ color: theme.colors.onPrimary, fontWeight: '800', letterSpacing: 0.5 }}
                >
                  LOAD SAMPLE DUMPS
                </PaperText>
              </Pressable>
            )}
          </View>
        }
        ListHeaderComponent={<AiOnboardCard />}
        ListFooterComponent={<SimulatePanel />}
      />

      {/* FAB */}
      <FAB
        icon="plus"
        label="New dump"
        onPress={() => router.push('/add')}
                style={{
          position: 'absolute',
          right: 16,
          bottom: 28,
          backgroundColor: theme.colors.primaryContainer,
        }}
        color={theme.colors.onPrimaryContainer}
      />
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
  const theme = useTheme();
  return (
    <Card
      mode="elevated"
      onPress={onPress}
      style={{ backgroundColor: theme.colors.surface }}
    >
      <Card.Content style={{ gap: 8, paddingVertical: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Badge item={item} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <PaperText style={{ fontSize: 11, color: theme.colors.onSurfaceVariant }}>
              {timeAgo(item.createdAt)}
            </PaperText>
            <IconButton
              icon="trash-can-outline"
              size={18}
              iconColor={theme.colors.onSurfaceVariant}
              onPress={onDelete}
              style={{ margin: 0 }}
            />
          </View>
        </View>

        {item.kind === 'image' && item.imageUri ? (
          <Image
            source={{ uri: item.imageUri }}
            style={{ width: '100%', height: 150, borderRadius: 12, backgroundColor: theme.colors.surfaceVariant }}
            contentFit="cover"
            transition={120}
          />
        ) : null}

        <PaperText variant="titleMedium"
          numberOfLines={2}
          style={{ color: theme.colors.onSurface, fontWeight: '700' }}
        >
          {item.title}
        </PaperText>

        {item.text && item.kind !== 'image' ? (
          <PaperText variant="bodySmall"
            numberOfLines={2}
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {item.text}
          </PaperText>
        ) : null}

        {item.ai?.status === 'done' && item.ai.summary ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 8,
              backgroundColor: theme.colors.secondaryContainer,
              paddingHorizontal: 10,
              paddingVertical: 8,
              borderRadius: 12,
            }}
          >
            <Ionicons
              name="sparkles"
              size={13}
              color={theme.colors.onSecondaryContainer}
              style={{ marginTop: 2 }}
            />
            <PaperText
              numberOfLines={2}
              style={{ flex: 1, fontSize: 12, color: theme.colors.onSecondaryContainer }}
            >
              {item.ai.summary}
            </PaperText>
          </View>
        ) : item.ai && (item.ai.status === 'pending' || item.ai.status === 'analyzing') ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: theme.colors.surfaceVariant,
              paddingHorizontal: 10,
              paddingVertical: 8,
              borderRadius: 12,
            }}
          >
            <Ionicons name="hourglass-outline" size={13} color={theme.colors.onSurfaceVariant} />
            <PaperText style={{ fontSize: 11, color: theme.colors.onSurfaceVariant }}>
              {aiState === 'ready' ? 'Oracle is reading…' : 'Waiting for on-device AI (see card above)'}
            </PaperText>
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {item.urlHost ? (
            <PaperText style={{ fontSize: 11, color: theme.colors.primary, fontWeight: '600' }}>
              {item.urlHost} ↗
            </PaperText>
          ) : null}
          {item.pinned ? (
            <View
              style={{
                borderRadius: 6,
                backgroundColor: theme.colors.tertiaryContainer,
                paddingHorizontal: 6,
                paddingVertical: 2,
              }}
            >
              <PaperText style={{ fontSize: 9, letterSpacing: 1, color: theme.colors.onTertiaryContainer }}>
                PINNED
              </PaperText>
            </View>
          ) : null}
          {item.ai?.status === 'done' &&
          item.ai.category === 'todo' &&
          item.ai.todos.length > 0 ? (
            <PaperText style={{ fontSize: 11, color: theme.colors.onSurfaceVariant }}>
              ✓ {item.ai.todosDone.length}/{item.ai.todos.length}
            </PaperText>
          ) : null}
          {item.note ? (
            <View
              style={{
                borderRadius: 6,
                borderWidth: 1,
                borderColor: theme.colors.outlineVariant,
                paddingHorizontal: 6,
                paddingVertical: 2,
              }}
            >
              <PaperText style={{ fontSize: 9, color: theme.colors.onSurfaceVariant }}>NOTE</PaperText>
            </View>
          ) : null}
          {item.tags.slice(0, 3).map((tag) => (
            <View
              key={tag}
              style={{
                borderRadius: 6,
                backgroundColor: theme.colors.surfaceVariant,
                paddingHorizontal: 6,
                paddingVertical: 2,
              }}
            >
              <PaperText style={{ fontSize: 10, color: theme.colors.onSurfaceVariant }}>#{tag}</PaperText>
            </View>
          ))}
        </View>
      </Card.Content>
    </Card>
  );
}

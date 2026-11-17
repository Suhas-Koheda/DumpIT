# DumpIT

**Share → dump → deal with it later.**
An Expo (React Native) app that catches everything you share from other apps —
plain text, tweets, LinkedIn posts, articles, screenshots — stores them **on the
phone**, and explains them **on the phone** with an on-device tiny LLM (no
cloud, no API keys).

Design system: see [`DESIGN.md`](./DESIGN.md) — *QuestUI*, a fantasy RPG-themed
dark UI (Cinzel + Spectral + Fira Code, gold on dark browns).

## Features

- **Share intake** — anything `ACTION_SEND` (Android) / the share extension
  (iOS): text, web URLs, images/screenshots. Files are copied into app storage
  (`Paths.document`), so they survive cache evictions.
- **Automatic platform detection** — Twitter/X (incl. `t.co`), LinkedIn
  (incl. `lnkd.in`), everything else as `LINK`; plain text as `TEXT`; images as
  `SCREENSHOT`.
- **On-device AI — the Oracle** (automatic, on import, fully offline)
  - `Qwen2.5-0.5B-Instruct` (Q4_K_M GGUF, ~469 MB) summarizes every dump and
    extracts entities / to-dos / links via JSON-schema-constrained generation
    (`llama.rn`).
  - `nomic-embed-text-v1.5` (Q4_K_M GGUF, ~80 MB) embeds every dump for
    semantic search — tap the **✨ wand** in the search bar to rank by meaning.
  - Screenshots: `@react-native-ml-kit/text-recognition` OCR → text → same
    summarizer/extractor. (Best effort — if ML Kit fails to link on a platform,
    analysis still runs on the other inputs.)
  - Models download **once** from HuggingFace on first enable (Wi-Fi
    recommended; ~550 MB total). No network needed afterwards.
- **Inbox** — search (string + semantic), filter chips (All / Links / X /
  LinkedIn / Text / Shots), delete, notes, tags, relative timestamps.
- **Detail view** — full content, open-link, editable note, comma-separated
  tags (normalized), AI analysis panel (summary / entities / to-dos / links /
  OCR text), retry on failure.
- **Persistence** — items in AsyncStorage (`dumpit.items.v1`), embeddings in
  `Paths.document/dumpit-embeddings.json`, images in
  `Paths.document/dumpit-images/`, models in `Paths.document/dumpit-models/`.

## Test on your phone

### A. Expo Go (UI + simulated shares)

What you already have. In Expo Go:

- All screens work, storage works, simulated shares work: scroll to the bottom
  of the inbox and tap **SIMULATE INCOMING SHARE** — X/Twitter, LinkedIn,
  web link, plain text, or pick a screenshot from the gallery. It pushes a real
  payload through the exact same import pipeline a share would.
- **Share sheet does NOT work in Expo Go** — the intent filters live in
  DumpIT's own APK manifest, not Expo Go's.
- **On-device AI does NOT work in Expo Go** — `llama.rn` and ML Kit are native
  modules. The Oracle card explains this in-app.

### B. Development build (real share sheet + real Oracle)

```sh
# 1. Plug the phone in, enable USB debugging (Settings → Developer options → USB debugging)
adb devices   # your phone should be listed

# 2. Build & install the dev client on the phone
npx expo run:android

# iOS instead of Android (on a Mac):
# npx expo run:ios
```

This compiles a native APK with the share-intent config plugin and the AI
engines, installs it on the phone, and Metro serves it. Then:

1. Open X/Twitter or LinkedIn or Chrome or your gallery → **Share** → **DumpIT**
   appears in the sheet. Share a tweet, a post, a link, or a screenshot
   (screenshots: the share button in the notification shade, or Photos).
2. DumpIT opens, the item lands in the inbox, the Oracle analyzes it
   automatically (watch the card — first run after enabling AI downloads the
   models).
3. Tap the **✨ wand** in the search bar and search by meaning.
4. The dev-client app stays installed; iterating on JS code hot-reloads like
   Expo Go (`npx expo start --dev-client`).

### Enabling the Oracle

In the inbox there is a purple **SUMMON THE ORACLE** card (visible until
models are present). Tap **DOWNLOAD BOTH MODELS** and keep the app open on
Wi-Fi. When it finishes, every existing and future dump is analyzed
automatically — summaries appear on cards and in the detail view, embeddings
power semantic search.

> The two models are ~550 MB. They live in app-private storage and never leave
> the device. Delete them any time via app storage settings (or by uninstalling).

## Scripts

| Command | Purpose |
| --- | --- |
| `npm start` | Metro for Expo Go (UI iteration) |
| `npx expo start --dev-client` | Metro for the development build |
| `npx expo run:android` | Build + install the dev client on a phone |
| `npx tsc --noEmit` | Typecheck |
| `npx eslint .` | Lint |
| `npx expo-doctor` | Dependency/config diagnostics (20/20 ✓) |
| `npx expo export --platform android` | Production JS bundle smoke test |

## Architecture

```
src/
  app/
    _layout.tsx        Root layout: fonts (Cinzel/Spectral/Fira Code),
                       ShareIntentProvider (disabled in Expo Go), Stack
    index.tsx          Inbox: search (+✨ semantic), filters, list, AI banner
    item/[id].tsx      Detail: content, note, tags, THE ORACLE SAYS panel
    add.tsx            Manual "Dump it" modal (URL detection inline)
  components/
    Badge.tsx          DUMP kind/platform badge (QuestUI chips)
    AiOnboardCard.tsx  Model download onboarding + progress (inbox)
    SimulatePanel.tsx  Dev-only "simulate share" panel
    ShareIntentWatcher.tsx  Imports native share intents → store
  lib/
    dump-store.tsx     Context: items, persistence, AI queue, semantic search
    ai-engine.ts       llama.rn lazy wrappers: analyze (JSON-schema), embed
    ai-models.ts       Model registry + downloader (expo-file-system)
    ocr.ts             ML Kit text recognition, guarded for Expo Go
    embeddings.ts      768-dim vectors in one JSON map + cosine similarity
    classify.ts        URL extraction, platform detection (X/LinkedIn/web)
    images.ts          Copy shared images into app storage
    theme.ts           QuestUI tokens (colors, fonts, glow shadows)
```

**Data flow (share):** share sheet → `expo-share-intent` → `ShareIntentWatcher`
→ `addFromShare` (classify, persist item, copy image) → `ai.status = pending`
→ provider queue: OCR (if image) → LLM analysis → embedding → item updated to
`done` → visible on card + detail screen.

## Verified in this environment

- `npx tsc --noEmit` ✓  `npx eslint .` ✓  `npx expo-doctor` 20/20 ✓
- `npx expo export --platform android` ✓ (bundle builds; native modules never
  evaluated at bundle time)
- Not verified here (needs your phone): real share-sheet delivery, model
  download, on-device inference quality, ML Kit linkage on New Architecture.
  OCR is deliberately optional — analysis proceeds without it.

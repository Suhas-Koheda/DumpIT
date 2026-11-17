/**
 * Reads the content of a shared link so the Oracle can analyze the page,
 * not the URL. Handles: tweets (fxtwitter), public Google Docs (plain-text
 * export), and generic HTML pages (OpenGraph). Redirects are followed and
 * re-dispatched — a t.co link that lands on a doc/tweet is read as one.
 */

export interface LinkRead {
  pageTitle: string | null;
  pageText: string;
  source: 'tweet' | 'googledoc' | 'opengraph' | 'none';
}

const TIMEOUT_MS = 4500;
const MAX_PAGE_CHARS = 4000;
const MAX_TOTAL_CHARS = 4000;

const X_HOSTS = /^(www\.|mobile\.)?(twitter|x)\.com$/i;
const URL_RE = /https?:\/\/[^\s)>\]"']+/gi;

/** All URLs in a blob of text, deduplicated, trailing punctuation stripped. */
export function extractAllUrls(text: string): string[] {
  const matches = text.match(URL_RE) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of matches) {
    const url = raw.replace(/[.,!?;:]+$/, '');
    if (!seen.has(url)) {
      seen.add(url);
      out.push(url);
    }
  }
  return out;
}

/** A URL is a Google Docs document — returns its document id. */
export function matchGoogleDoc(url: URL): string | null {
  if (url.hostname.toLowerCase() !== 'docs.google.com') return null;
  const match = url.pathname.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  return match?.[1] ?? null;
}

function parseUrl(raw: string): URL | null {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

interface Fetched {
  text: string;
  finalUrl: string;
}

async function safeFetchText(url: string, ms: number): Promise<Fetched> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { Accept: 'text/html,application/xhtml+xml,application/json,text/plain' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return { text: await response.text(), finalUrl: response.url || url };
  } finally {
    clearTimeout(timer);
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|blockquote|h[1-6]|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function firstMatch(html: string, re: RegExp): string | null {
  const match = html.match(re);
  return match?.[1]?.trim() || null;
}

async function readGoogleDoc(docId: string): Promise<LinkRead> {
  try {
    const { text } = await safeFetchText(
      `https://docs.google.com/document/d/${docId}/export?format=txt`,
      9000
    );
    const cleaned = text.replace(/\r/g, '').trim();
    const looksLikeLogin = /sign in to continue|accounts\.google\.com/i.test(cleaned.slice(0, 500));
    if (cleaned.length > 60 && !looksLikeLogin) {
      const firstLine =
        cleaned.split('\n').map((l) => l.trim()).find((l) => l.length > 3) ?? 'Google Doc';
      return {
        pageTitle: `Google Doc: ${firstLine.slice(0, 80)}`,
        pageText: cleaned.slice(0, MAX_PAGE_CHARS),
        source: 'googledoc',
      };
    }
  } catch {
    // fall through
  }
  return { pageTitle: null, pageText: '', source: 'none' };
}

async function readTweet(url: URL): Promise<LinkRead | null> {
  const match = url.pathname.match(/^\/(@?[A-Za-z0-9_]{1,15})\/status\/(\d+)/);
  if (!match) return null;
  try {
    const { text } = await safeFetchText(
      `https://api.fxtwitter.com/${match[1].replace('@', '')}/status/${match[2]}`,
      TIMEOUT_MS
    );
    const data = JSON.parse(text) as {
      tweet?: { text?: string; author?: { name?: string; screen_name?: string } };
    };
    const tweetText = data.tweet?.text?.trim();
    if (tweetText && tweetText.length > 5) {
      const authorName = data.tweet?.author?.name ?? 'Unknown';
      const handle = data.tweet?.author?.screen_name;
      return {
        pageTitle: `${authorName} on X`,
        pageText: `${authorName}${handle ? ` (@${handle})` : ''}:\n\n${tweetText}`.slice(
          0,
          MAX_PAGE_CHARS
        ),
        source: 'tweet',
      };
    }
  } catch {
    // fall through
  }
  return null;
}

function parseOpenGraph(html: string): LinkRead {
  const title =
    firstMatch(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
    firstMatch(html, /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i) ||
    firstMatch(html, /<title>([^<]+)<\/title>/i);
  const description =
    firstMatch(html, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
    firstMatch(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
    firstMatch(html, /<meta[^>]+name=["']twitter:description["'][^>]+content=["']([^"']+)["']/i);

  const titleLower = (title ?? '').toLowerCase();
  const looksLikeLoginWall =
    /sign\s?in|log\s?in|login/i.test(titleLower) && !/post|tweet|article|docs/i.test(titleLower);

  const parts: string[] = [];
  if (title && !looksLikeLoginWall) parts.push(`Title: ${title}`);
  if (description && !looksLikeLoginWall) parts.push(`Description: ${description}`);

  if (parts.length === 0) {
    const p = firstMatch(html, /<p[^>]*>([\s\S]{80,1200}?)<\/p>/i);
    const stripped = p ? stripHtml(p) : '';
    if (stripped.length > 60 && !/sign in|log in/i.test(stripped.slice(0, 120))) {
      parts.push(stripped);
    }
  }

  const pageText = parts.join('\n\n').slice(0, MAX_PAGE_CHARS);
  if (pageText.length > 20) {
    return { pageTitle: title && !looksLikeLoginWall ? title : null, pageText, source: 'opengraph' };
  }
  return { pageTitle: null, pageText: '', source: 'none' };
}

export async function readLinkContent(rawUrl: string): Promise<LinkRead> {
  const url = parseUrl(rawUrl);
  if (!url) return { pageTitle: null, pageText: '', source: 'none' };

  const host = url.hostname.toLowerCase();

  // Direct detects (no network needed to decide the route).
  const directDoc = matchGoogleDoc(url);
  if (directDoc) return readGoogleDoc(directDoc);
  if (X_HOSTS.test(host)) {
    const tweet = await readTweet(url);
    if (tweet) return tweet;
  }

  // Generic fetch; re-dispatch when a redirect lands on a doc/tweet.
  try {
    const { text, finalUrl } = await safeFetchText(rawUrl, TIMEOUT_MS);
    const resolved = parseUrl(finalUrl);
    if (resolved) {
      const docId = matchGoogleDoc(resolved);
      if (docId) return readGoogleDoc(docId);
      if (X_HOSTS.test(resolved.hostname.toLowerCase())) {
        const tweet = await readTweet(resolved);
        if (tweet) return tweet;
      }
    }
    return parseOpenGraph(text);
  } catch {
    return { pageTitle: null, pageText: '', source: 'none' };
  }
}

export const MAX_LINK_CONTENT_CHARS = MAX_TOTAL_CHARS;

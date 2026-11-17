import type { Platform } from './types';

const URL_RE = /https?:\/\/[^\s)>\]]+/i;
const X_HOSTS = /^(www\.|mobile\.)?(twitter|x)\.com$/i;
const TCO_HOST = /^t\.co$/i;
const LINKEDIN_HOST = /^(www\.|m\.)?linkedin\.com$/i;
const LINKEDIN_SHORT = /^lnkd\.in$/i;

/** First http(s) URL found in a string, if any. */
export function extractUrl(text: string | null | undefined): string | null {
  if (!text) return null;
  const match = text.match(URL_RE);
  if (!match) return null;
  // Strip trailing punctuation that often rides along in shared blurbs.
  return match[0].replace(/[.,!?;:]+$/, '');
}

export function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    const match = url.match(/^https?:\/\/([^/\s?#]+)/i);
    return match ? match[1].toLowerCase() : null;
  }
}

export function detectPlatform(url: string): Platform {
  const host = hostOf(url);
  if (!host) return 'web';
  if (X_HOSTS.test(host) || TCO_HOST.test(host)) return 'x';
  if (LINKEDIN_HOST.test(host) || LINKEDIN_SHORT.test(host)) return 'linkedin';
  return 'web';
}

/** Strip the URL out of shared text to keep the readable blurb. */
export function readableBlurb(text: string | null | undefined, url: string | null): string {
  if (!text) return '';
  const cleaned = url ? text.replace(url, '') : text;
  return cleaned.replace(/\s{2,}/g, ' ').replace(/^[\s\-–—:|,]+|[\s\-–—:|,]+$/g, '').trim();
}

export function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

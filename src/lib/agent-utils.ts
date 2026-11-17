/** Small display/text helpers shared by the agent. */

export function shorten(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.length > 34 ? u.pathname.slice(0, 34) + '…' : u.pathname;
    return `${u.hostname.replace(/^www\./, '')}${path}`;
  } catch {
    return url.length > 44 ? url.slice(0, 44) + '…' : url;
  }
}

export function heuristicSummary(text: string): string {
  const cleaned = text
    .replace(/^\[\d+\] [^\n]+\n/, '')
    .trim();
  const sentences = cleaned.match(/[^.!?\n]+[.!?]+/g) ?? [cleaned];
  const picked = sentences
    .map((s) => s.trim())
    .filter((s) => s.length > 30)
    .slice(0, 2)
    .join(' ');
  const out = picked || cleaned.slice(0, 280);
  return out.length > 400 ? out.slice(0, 400) + '…' : out;
}

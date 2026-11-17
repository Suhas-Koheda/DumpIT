export type DumpKind = 'text' | 'link' | 'image';

/** Platform detected for link-type dumps. */
export type Platform = 'x' | 'linkedin' | 'web';

export type DumpSource = 'share' | 'manual' | 'sample';

export type AiStatus = 'pending' | 'analyzing' | 'done' | 'error' | 'disabled';

export interface ExtractedEntity {
  type: string;
  value: string;
}

export interface DumpAi {
  status: AiStatus;
  /** One or two terse sentences — what this dump is about. */
  summary: string;
  entities: ExtractedEntity[];
  todos: string[];
  links: string[];
  /** OCR text for image dumps (empty when no text detected). */
  ocrText: string;
  /** Text of the linked page/post, fetched by the Oracle (empty when unreadable). */
  pageText: string;
  /** Titles of the sources the agent visited (tweets, docs, pages). */
  sources: string[];
  /** Why the analysis failed/was disabled, when applicable. */
  error: string | null;
  analyzedAt: number | null;
}

export interface DumpItem {
  id: string;
  kind: DumpKind;
  /** Set for kind === 'link'. */
  platform: Platform | null;
  /** Short headline — share title, page title, or derived from the text. */
  title: string;
  /** Raw shared text (when the share carried both text and a URL). */
  text: string;
  /** Extracted / shared URL. */
  url: string | null;
  /** Host of `url` for quick display, e.g. "x.com". */
  urlHost: string | null;
  /** Absolute file:// URI of the copied image, when kind === 'image'. */
  imageUri: string | null;
  imageName: string | null;
  note: string;
  tags: string[];
  source: DumpSource;
  createdAt: number;
  /** On-device AI analysis. `null` = not requested yet / legacy item. */
  ai: DumpAi | null;
}

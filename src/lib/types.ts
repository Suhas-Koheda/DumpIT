export type DumpKind = 'text' | 'link' | 'image';
export type Platform = 'x' | 'linkedin' | 'web' | null;

export interface DumpItem {
  id: string;
  kind: DumpKind;
  platform: Platform;
  title: string;
  text: string;
  url: string | null;
  urlHost: string | null;
  imageUri: string | null;
  imageName: string | null;
  createdAt: number;
}

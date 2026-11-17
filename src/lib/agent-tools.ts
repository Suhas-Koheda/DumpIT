import { tool } from '@langchain/core/tools';
import { z } from 'zod';

import { extractAllUrls, readLinkContent } from './link-reader';

/** LangChain tools available to the on-device agent. */

export const readLinkTool = tool(
  async ({ url }: { url: string }) => {
    const read = await readLinkContent(url);
    if (!read.pageText) return JSON.stringify({ ok: false, source: 'none' });
    return JSON.stringify({ ok: true, title: read.pageTitle, text: read.pageText, source: read.source });
  },
  {
    name: 'read_link',
    description:
      'Fetch a URL and return its readable text. Works for X/Twitter posts, Google Docs, and regular web pages. Pass the full URL to read.',
    schema: z.object({ url: z.string().describe('The full URL to fetch and read') }),
  }
);

export const findLinksTool = tool(
  async ({ text }: { text: string }) => {
    return JSON.stringify(extractAllUrls(text));
  },
  {
    name: 'find_links',
    description: 'Extract every URL found in a block of text. Returns a JSON array of URLs.',
    schema: z.object({ text: z.string().describe('The text to scan for links') }),
  }
);

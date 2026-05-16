// Phase 2: Extract durable-memory candidate excerpts from conversations-*.json
// shards inside the ChatGPT export ZIP. Streams each shard one at a time and
// writes per-shard JSONL chunks into exports/chatgpt-memory-import/chunks/.
//
// Privacy: nothing is printed to stdout except counts/filenames. Raw message
// text only ever goes into local files under exports/chatgpt-memory-import/.

import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import {
  ZIP_PATH, CHUNKS_DIR, KEYWORDS, CATEGORY_PATTERNS, MAX_MESSAGE_CHARS,
} from "./config.ts";
import type {
  Excerpt, RawConversation, RawMessage, Category,
} from "./types.ts";

// Lowercased keyword set for fast membership checking.
const KEYWORDS_LC = KEYWORDS.map(k => k.toLowerCase());

function extractText(m: RawMessage): string {
  if (!m?.content) return "";
  const c = m.content;
  if (typeof c.text === "string") return c.text;
  if (Array.isArray(c.parts)) {
    return c.parts
      .map(p => (typeof p === "string" ? p : (p && typeof p === "object" && "text" in p ? String((p as { text?: unknown }).text ?? "") : "")))
      .filter(Boolean)
      .join("\n")
      .trim();
  }
  return "";
}

function isoOrNull(ts: number | null | undefined): string | null {
  if (!ts || !Number.isFinite(ts)) return null;
  try { return new Date(ts * 1000).toISOString(); } catch { return null; }
}

function classify(text: string): { matched: string[]; categories: Category[] } {
  const lc = text.toLowerCase();
  const matched: string[] = [];
  for (const kw of KEYWORDS_LC) {
    if (lc.includes(kw)) matched.push(kw);
    if (matched.length > 12) break;
  }
  const categories = new Set<Category>();
  for (const { category, patterns } of CATEGORY_PATTERNS) {
    if (patterns.some(p => p.test(text))) categories.add(category);
  }
  return { matched, categories: [...categories] };
}

function shouldKeep(text: string, matched: string[]): boolean {
  if (text.length < 40) return false;          // skip trivial pings
  if (matched.length === 0) return false;      // no keyword hits → drop
  return true;
}

function truncate(text: string): string {
  if (text.length <= MAX_MESSAGE_CHARS) return text;
  return text.slice(0, MAX_MESSAGE_CHARS) + `\n…[truncated ${text.length - MAX_MESSAGE_CHARS} chars]`;
}

async function main(): Promise<void> {
  fs.mkdirSync(CHUNKS_DIR, { recursive: true });

  const buf = await fs.promises.readFile(ZIP_PATH);
  const zip = await JSZip.loadAsync(buf, { checkCRC32: false });

  const shardEntries = Object.values(zip.files)
    .filter(f => !f.dir && /^conversations(?:-\d+)?\.json$/i.test(f.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  console.log(`[extract] ${shardEntries.length} conversation shards to process`);

  let totalConversations = 0;
  let totalMessages = 0;
  let totalKept = 0;

  const summary: { shard: string; conversations: number; messages: number; kept: number }[] = [];

  for (const shard of shardEntries) {
    const raw = await shard.async("string");
    let parsed: RawConversation[];
    try {
      const json = JSON.parse(raw);
      parsed = Array.isArray(json) ? json : [json];
    } catch (err) {
      console.warn(`[extract] ${shard.name}: parse failed — skipping`, (err as Error).message);
      continue;
    }

    const outPath = path.join(CHUNKS_DIR, shard.name.replace(/\.json$/i, ".jsonl"));
    const outStream = fs.createWriteStream(outPath, { encoding: "utf8" });

    let shardConvs = 0, shardMsgs = 0, shardKept = 0;
    for (const conv of parsed) {
      shardConvs++;
      const cid = conv.conversation_id ?? conv.id ?? "(unknown)";
      const title = (conv.title ?? "Untitled").toString().slice(0, 240);
      const createdISO = isoOrNull(conv.create_time);
      const nodes = conv.mapping ? Object.values(conv.mapping) : [];
      for (const node of nodes) {
        const m = node.message;
        if (!m) continue;
        shardMsgs++;
        const role = (m.author?.role ?? "user") as Excerpt["role"];
        if (role === "tool" || role === "system") continue;
        const text = extractText(m).trim();
        if (!text) continue;
        const { matched, categories } = classify(text);
        if (!shouldKeep(text, matched)) continue;
        const excerpt: Excerpt = {
          conversationId: cid,
          conversationTitle: title,
          conversationCreatedISO: createdISO,
          messageId: m.id ?? `${cid}:${shardMsgs}`,
          role,
          createdISO: isoOrNull(m.create_time),
          text: truncate(text),
          matchedKeywords: matched,
          categories: categories.length > 0 ? categories : ["raw_misc"],
          shard: shard.name,
        };
        outStream.write(JSON.stringify(excerpt) + "\n");
        shardKept++;
      }
    }
    await new Promise<void>(res => outStream.end(res));

    summary.push({ shard: shard.name, conversations: shardConvs, messages: shardMsgs, kept: shardKept });
    totalConversations += shardConvs;
    totalMessages += shardMsgs;
    totalKept += shardKept;
    console.log(`[extract] ${shard.name}: convs=${shardConvs} msgs=${shardMsgs} kept=${shardKept}`);
  }

  const summaryPath = path.join(CHUNKS_DIR, "_extract_summary.json");
  fs.writeFileSync(summaryPath, JSON.stringify({
    totalConversations, totalMessages, totalKept, shards: summary, generatedAt: new Date().toISOString(),
  }, null, 2));
  console.log(`[extract] Done. convs=${totalConversations} msgs=${totalMessages} kept=${totalKept}`);
  console.log(`[extract] Summary → ${summaryPath}`);
}

main().catch((err) => {
  console.error("[extract] FAILED", err);
  process.exit(1);
});

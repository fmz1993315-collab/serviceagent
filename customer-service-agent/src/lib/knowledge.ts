import fs from "node:fs/promises";
import path from "node:path";

export type KnowledgeItem = { question: string; answer: string };

function normalizeText(input: string) {
  return input.trim().toLowerCase();
}

/**
 * 简单知识库检索：关键词/包含匹配。
 * - 不做向量化，仅满足演示需求
 */
export async function searchKnowledgeBase(userMessage: string) {
  const kbPath = path.join(process.cwd(), "knowledge", "base.json");
  const raw = await fs.readFile(kbPath, "utf-8");
  const items: KnowledgeItem[] = JSON.parse(raw);

  const q = normalizeText(userMessage);
  if (!q) return null;

  // 1) 直接包含：用户消息包含问题关键词
  const direct = items.find((it) => q.includes(normalizeText(it.question)));
  if (direct) return direct;

  // 2) 关键词命中：将“问题”按空白/标点简单拆分，命中>=2个算匹配
  const tokens = q.split(/[\s，。,.!?？、/\\'"]+/).filter(Boolean);
  let best: { item: KnowledgeItem; score: number } | null = null;
  for (const it of items) {
    const itQ = normalizeText(it.question);
    let score = 0;
    for (const t of tokens) {
      if (t.length < 2) continue;
      if (itQ.includes(t)) score += 1;
    }
    if (score > 0 && (!best || score > best.score)) best = { item: it, score };
  }
  return best && best.score >= 2 ? best.item : null;
}


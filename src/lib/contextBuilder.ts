import type { ChatMessage, Chapter, SceneRecord } from "@/types";
import type { ProviderId } from "@/lib/providers";

// ============================================================
// 配置常量
// ============================================================

/** 当前章节保留的最近对话轮数（超过此数则触发压缩） */
const MAX_RECENT_SCENES = 8;

/** 触发压缩的阈值：当前章节场景数超过此值时压缩前面部分 */
const COMPRESS_THRESHOLD = 6;

/** 每次压缩保留的最近场景数（不参与压缩） */
const KEEP_RECENT_BEFORE_COMPRESS = 4;

// ============================================================
// 上下文构建器
// ============================================================

/**
 * 构建优化的 AI 上下文消息
 *
 * 策略：
 * 1. system prompt 始终保留
 * 2. 初始 user message（故事设定）始终保留
 * 3. 已完成章节用摘要代替（如果有 summary）
 * 4. 当前章节保留最近 MAX_RECENT_SCENES 轮对话
 * 5. 如果当前章节对话过多，触发压缩建议
 */
export function buildContext(opts: {
  systemPrompt: string;
  initialUserMessage: string;
  chapters: Chapter[];
  scenes: SceneRecord[];
}): ChatMessage[] {
  const { systemPrompt, initialUserMessage, chapters, scenes } = opts;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: initialUserMessage },
  ];

  if (scenes.length === 0) return messages;

  // 找出已完成且有摘要的章节
  const completedChapters = chapters.filter(
    (c) => c.status === "completed" && c.summary
  );

  // 注入已完成章节的摘要
  if (completedChapters.length > 0) {
    const summaryText = completedChapters
      .map((c) => `【第${c.chapter_number}章${c.title ? `：${c.title}` : ""}摘要】\n${c.summary}`)
      .join("\n\n");

    messages.push({
      role: "user",
      content: `[前情提要]\n${summaryText}\n\n请基于以上前情继续故事。`,
    });
  }

  // 当前章节的场景：取最近 MAX_RECENT_SCENES 轮
  // 找到当前章节的起点（最后一个已完成章节之后的场景）
  let currentChapterStart = 0;
  if (completedChapters.length > 0) {
    const lastCompleted = completedChapters[completedChapters.length - 1];
    const idx = scenes.findIndex((s) => s.chapter_id && !completedChapters.some((c) => c.id === s.chapter_id));
    if (idx >= 0) currentChapterStart = idx;
  }

  const currentScenes = scenes.slice(currentChapterStart);

  // 取最近的场景（含 assistant 回复）
  const recentScenes = currentScenes.slice(-MAX_RECENT_SCENES);

  for (const scene of recentScenes) {
    if (scene.ai_raw_response) {
      messages.push({ role: "assistant", content: scene.ai_raw_response });
    }
  }

  return messages;
}

// ============================================================
// 压缩触发检测
// ============================================================

/**
 * 检测是否需要触发记忆压缩
 *
 * 触发条件：
 * - 当前章节场景数超过 COMPRESS_THRESHOLD
 * - 且还没有为该章节生成摘要
 */
export function shouldCompress(
  scenes: SceneRecord[],
  currentChapter: Chapter | null
): boolean {
  if (!currentChapter) return false;
  if (currentChapter.summary) return false; // 已有摘要

  // 统计当前章节的场景数
  const chapterScenes = scenes.filter(
    (s) => s.chapter_id === currentChapter.id
  );

  return chapterScenes.length >= COMPRESS_THRESHOLD;
}

/**
 * 获取需要压缩的场景（当前章节中较早的场景，保留最近几轮）
 */
export function getScenesToCompress(
  scenes: SceneRecord[],
  currentChapter: Chapter | null
): SceneRecord[] {
  if (!currentChapter) return [];

  const chapterScenes = scenes.filter(
    (s) => s.chapter_id === currentChapter.id
  );

  // 保留最近 KEEP_RECENT_BEFORE_COMPRESS 个，压缩前面的
  if (chapterScenes.length <= KEEP_RECENT_BEFORE_COMPRESS) return [];

  return chapterScenes.slice(0, -KEEP_RECENT_BEFORE_COMPRESS);
}

// ============================================================
// 压缩执行
// ============================================================

/**
 * 调用压缩 API
 */
export async function compressScenes(
  scenes: SceneRecord[],
  chapterTitle: string | null,
  apiKey: string,
  providerId?: ProviderId,
  modelId?: string
): Promise<{ summary: string | null; error: string | null }> {
  try {
    // 构建要压缩的消息
    const messagesToCompress = scenes
      .filter((s) => s.ai_raw_response)
      .map((s) => ({
        role: "assistant" as const,
        content: s.ai_raw_response!,
      }));

    if (messagesToCompress.length === 0) {
      return { summary: null, error: "无可压缩的场景" };
    }

    const res = await fetch("/api/compress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: messagesToCompress,
        chapterTitle,
        apiKey: apiKey || "",
        providerId: providerId ?? "deepseek",
        modelId: modelId ?? "",
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { summary: null, error: data?.error ?? "压缩失败" };
    }

    const data = await res.json();
    return { summary: data.summary ?? null, error: null };
  } catch {
    return { summary: null, error: "压缩请求异常" };
  }
}

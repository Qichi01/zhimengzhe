import type {
  GameType,
  ParsedAIResponse,
  SceneIllustration,
  SceneRecord,
} from "@/types";

export type IllustrationReason =
  | "story_opening"
  | "chapter_opening"
  | "ending"
  | "important_location"
  | "relationship_turn"
  | "important_character"
  | "ai_suggested";

export interface IllustrationDecision {
  shouldGenerate: boolean;
  reason?: IllustrationReason;
}

interface DecideIllustrationInput {
  enabled: boolean;
  orderIndex: number;
  isNewChapter: boolean;
  parsed: ParsedAIResponse;
  existingScenes: SceneRecord[];
  lastRequestedIndex?: number;
}

interface GenerateIllustrationInput {
  gameType: GameType;
  storySetting: string;
  sceneContent: string;
  reason: IllustrationReason;
  deviceId: string;
}

// 非章节/结局场景之间至少间隔 4 个场景，防止模型连续标记导致密集生图。
export const MIN_ILLUSTRATION_SCENE_GAP = 4;

export function decideIllustration({
  enabled,
  orderIndex,
  isNewChapter,
  parsed,
  existingScenes,
  lastRequestedIndex,
}: DecideIllustrationInput): IllustrationDecision {
  if (!enabled) return { shouldGenerate: false };

  // 开篇、真正的新章节和结局属于强制关键场景，不受冷却限制。
  if (orderIndex === 0) {
    return { shouldGenerate: true, reason: "story_opening" };
  }
  if (isNewChapter) {
    return { shouldGenerate: true, reason: "chapter_opening" };
  }
  if (parsed.isEnding) {
    return { shouldGenerate: true, reason: "ending" };
  }

  const lastIllustratedIndex = existingScenes.reduce(
    (latest, scene) => scene.illustration ? Math.max(latest, scene.order_index) : latest,
    lastRequestedIndex ?? Number.NEGATIVE_INFINITY
  );
  if (orderIndex - lastIllustratedIndex < MIN_ILLUSTRATION_SCENE_GAP) {
    return { shouldGenerate: false };
  }

  if (parsed.sceneLayout?.rooms.length) {
    return { shouldGenerate: true, reason: "important_location" };
  }
  if (parsed.relationshipUpdates?.some((update) => update.action === "change")) {
    return { shouldGenerate: true, reason: "relationship_turn" };
  }
  if (parsed.relationshipUpdates?.some((update) => update.action === "new")) {
    return { shouldGenerate: true, reason: "important_character" };
  }
  if (parsed.illustrationSuggested) {
    return { shouldGenerate: true, reason: "ai_suggested" };
  }

  return { shouldGenerate: false };
}

export async function generateSceneIllustration({
  gameType,
  storySetting,
  sceneContent,
  reason,
  deviceId,
}: GenerateIllustrationInput): Promise<SceneIllustration> {
  const response = await fetch("/api/illustration", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      gameType,
      storySetting,
      sceneContent,
      reason,
      deviceId,
    }),
  });

  if (!response.ok) {
    let message = "配图生成失败";
    try {
      const data = await response.json();
      if (typeof data?.error === "string") message = data.error;
    } catch {
      // 图片接口错误不应影响正文流程。
    }
    throw new Error(message);
  }

  const imageBlob = await response.blob();
  if (!imageBlob.type.startsWith("image/")) {
    throw new Error("图片服务返回了无效内容");
  }

  const dataUrl = await blobToOptimizedDataUrl(imageBlob);
  const model = response.headers.get("X-Image-Model") ?? "cogview-3-flash";

  return {
    dataUrl,
    alt: `AI 生成的关键场景插图：${sceneContent.slice(0, 42)}`,
    model,
    generatedAt: new Date().toISOString(),
  };
}

async function blobToOptimizedDataUrl(blob: Blob): Promise<string> {
  try {
    const bitmap = await createImageBitmap(blob);
    const maxWidth = 1280;
    const scale = Math.min(1, maxWidth / bitmap.width);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas unavailable");
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const optimized = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/webp", 0.82);
    });
    return readBlobAsDataUrl(optimized ?? blob);
  } catch {
    return readBlobAsDataUrl(blob);
  }
}

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("图片读取失败"));
    reader.readAsDataURL(blob);
  });
}

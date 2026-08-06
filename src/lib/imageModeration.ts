const VISION_ENDPOINT = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
const DEFAULT_VISION_MODEL = "glm-4v-flash";

interface GenerationContentFilter {
  role?: string;
  level?: number;
}

interface VisionApiResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
}

export type GeneratedImageInspectionResult =
  | { valid: true }
  | { valid: false; reason: "unsafe" | "off_spec" | "unavailable" };

/** 图片生成接口只在识别到风险时返回 content_filter 条目。 */
export function hasUnsafeGenerationFilter(
  contentFilter: GenerationContentFilter[] | undefined
): boolean {
  return Boolean(contentFilter?.length);
}

/** 使用免费视觉模型检查图片是否符合头像/场景图产品规范。 */
export async function inspectGeneratedImage(
  apiKey: string,
  imageUrl: string,
  input:
    | { kind: "avatar"; characterReference: string }
    | { kind: "scene"; sceneReference: string }
): Promise<GeneratedImageInspectionResult> {
  const isAvatar = input.kind === "avatar";
  const reference = isAvatar ? input.characterReference : input.sceneReference;
  const criteria = isAvatar
    ? `这是人物档案头像验收。请检查：
1. 画面主体是一个具体的人物或动物角色；
2. 主体数量严格为 1；
3. 使用头肩或半身肖像构图，而不是全身远景或纯风景；
4. 与角色介绍基本一致：${reference}；
5. 画面健康、舒适、人物完整、服装得体，适合全年龄公开展示。
只输出 JSON：{"safeForAllAges":true,"concreteRole":true,"subjectCount":1,"portraitFraming":true,"matchesReference":true}`
    : `这是互动小说场景插图验收。请检查：
1. 画面与场景介绍基本相关：${reference}；
2. 画面健康、舒适、人物完整、服装得体，适合全年龄公开展示。
只输出 JSON：{"safeForAllAges":true,"matchesReference":true}`;

  try {
    let response: Response | null = null;
    const requestBody = JSON.stringify({
      model: cleanEnv(process.env.IMAGE_VISION_MODEL) || DEFAULT_VISION_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: imageUrl } },
            { type: "text", text: criteria },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 220,
    });

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        response = await fetch(VISION_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: requestBody,
          signal: AbortSignal.timeout(15_000),
          cache: "no-store",
        });
        if (response.ok || (response.status !== 429 && response.status < 500)) break;
      } catch {
        if (attempt === 1) throw new Error("vision request failed");
      }
    }

    if (!response) return { valid: false, reason: "unavailable" };

    const data = (await response.json()) as VisionApiResponse;
    if (!response.ok) {
      console.error(
        "Image inspection unavailable:",
        response.status,
        data.error?.message ?? "unknown error"
      );
      return { valid: false, reason: "unavailable" };
    }

    const content = data.choices?.[0]?.message?.content ?? "";
    const jsonText = content.match(/\{[\s\S]*\}/)?.[0];
    if (!jsonText) return { valid: false, reason: "unavailable" };
    const result = JSON.parse(jsonText) as Record<string, unknown>;
    const reject = (reason: "unsafe" | "off_spec") => {
      console.warn("Image inspection rejected:", input.kind, reason, result);
      return { valid: false, reason } as const;
    };
    if (result.safeForAllAges !== true) {
      return reject("unsafe");
    }
    if (result.matchesReference !== true) {
      return reject("off_spec");
    }
    if (
      isAvatar &&
      (result.concreteRole !== true ||
        result.subjectCount !== 1 ||
        result.portraitFraming !== true)
    ) {
      return reject("off_spec");
    }
    return { valid: true };
  } catch (error) {
    console.error(
      "Image inspection error:",
      error instanceof Error ? error.message : String(error)
    );
    return { valid: false, reason: "unavailable" };
  }
}

/** 智谱图片临时地址偶尔连接失败，允许一次短重试。 */
export async function fetchGeneratedImage(imageUrl: string): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(imageUrl, {
        signal: AbortSignal.timeout(12_000),
        cache: "no-store",
      });
      if (response.ok || attempt === 1) return response;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("image download failed");
}

function cleanEnv(value: string | undefined): string {
  return (value ?? "").trim().split("\n")[0].trim();
}

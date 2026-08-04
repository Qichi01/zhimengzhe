import { NextRequest, NextResponse } from "next/server";
import type { GameType } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

// 与聊天和场景配图代理保持一致，仅本地开发兼容代理软件的自签名证书。
if (process.env.NODE_ENV === "development") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const IMAGE_ENDPOINT = "https://open.bigmodel.cn/api/paas/v4/images/generations";
const DEFAULT_IMAGE_MODEL = "cogview-3-flash";
const AVATAR_IMAGE_SIZE = "1024x1024";
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 12;
const requestLog = new Map<string, number[]>();

interface AvatarRequest {
  characterName?: string;
  description?: string | null;
  gameType?: GameType;
  storySetting?: string;
  deviceId?: string;
}

interface ImageApiResponse {
  data?: Array<{ url?: string }>;
  error?: { message?: string };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AvatarRequest;
    const characterName = cleanText(body.characterName, 80);
    const description = cleanText(body.description, 600);
    const storySetting = cleanText(body.storySetting, 800);
    const deviceId = cleanIdentifier(body.deviceId);
    const gameType: GameType =
      body.gameType === "otome" || body.gameType === "mystery"
        ? body.gameType
        : "other";

    if (!characterName || !deviceId) {
      return NextResponse.json({ error: "缺少有效的人物信息" }, { status: 400 });
    }
    if (isRateLimited(deviceId)) {
      return NextResponse.json(
        { error: "头像生成过于频繁，请稍后再试" },
        { status: 429 }
      );
    }

    const apiKey = cleanEnv(process.env.IMAGE_API_KEY) || cleanEnv(process.env.GLM_API_KEY);
    if (!apiKey) {
      return NextResponse.json({ error: "头像生成服务暂未配置" }, { status: 503 });
    }

    const model = cleanEnv(process.env.IMAGE_MODEL) || DEFAULT_IMAGE_MODEL;
    const generationResponse = await fetch(IMAGE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        prompt: buildAvatarPrompt(gameType, characterName, description, storySetting),
        size: AVATAR_IMAGE_SIZE,
        quality: model === "glm-image" ? "hd" : "standard",
        user_id: deviceId,
      }),
      signal: AbortSignal.timeout(45_000),
      cache: "no-store",
    });

    const generationData = (await generationResponse.json()) as ImageApiResponse;
    if (!generationResponse.ok) {
      console.error(
        "Avatar API error:",
        generationResponse.status,
        generationData.error?.message ?? "unknown error"
      );
      return NextResponse.json({ error: "头像生成服务暂时不可用" }, { status: 502 });
    }

    const imageUrl = generationData.data?.[0]?.url;
    if (!imageUrl || !isSafeImageUrl(imageUrl)) {
      return NextResponse.json({ error: "头像服务未返回有效图片" }, { status: 502 });
    }

    const imageResponse = await fetch(imageUrl, {
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });
    if (!imageResponse.ok) {
      return NextResponse.json({ error: "头像图片下载失败" }, { status: 502 });
    }

    const imageBytes = await imageResponse.arrayBuffer();
    if (imageBytes.byteLength > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "头像图片文件过大" }, { status: 502 });
    }
    const contentType = detectImageContentType(imageBytes);
    if (!contentType) {
      return NextResponse.json({ error: "无法识别头像图片格式" }, { status: 502 });
    }

    return new Response(imageBytes, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
        "X-Image-Model": model,
      },
    });
  } catch (error) {
    console.error(
      "Avatar route error:",
      error instanceof Error ? error.message : String(error)
    );
    return NextResponse.json(
      { error: "默认头像生成失败，可上传图片或使用首字头像" },
      { status: 500 }
    );
  }
}

function buildAvatarPrompt(
  gameType: GameType,
  characterName: string,
  description: string,
  storySetting: string
): string {
  const styleByType: Record<GameType, string> = {
    otome: "精致日系乙女游戏人物立绘头像，柔和电影光影，青春校园氛围，人物情绪细腻",
    mystery: "电影级悬疑游戏人物档案头像，低饱和色彩，克制的戏剧光影，神秘但不血腥",
    other: "高品质互动小说人物概念头像，电影感光影，角色特征鲜明，画面精致",
  };

  return [
    styleByType[gameType],
    "1:1 正方形单人头像，头肩构图，正面或轻微侧脸，面部完整清晰，背景简洁，与故事时代和服饰一致",
    "画面中只能出现一个人物，不要边框，不要 UI，不要字幕、姓名、水印或任何文字",
    `人物姓名：${characterName}`,
    description ? `人物设定：${description}` : "",
    storySetting ? `世界观约束：${storySetting}` : "",
  ]
    .filter(Boolean)
    .join("。\n");
}

function cleanEnv(value: string | undefined): string {
  return (value ?? "").trim().split("\n")[0].trim();
}

function cleanText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ")
    .trim()
    .slice(0, maxLength);
}

function cleanIdentifier(value: unknown): string {
  if (typeof value !== "string") return "";
  const cleaned = value.trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 128);
  return cleaned.length >= 6 ? cleaned : "";
}

function isSafeImageUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function isRateLimited(deviceId: string): boolean {
  const now = Date.now();
  const recent = (requestLog.get(deviceId) ?? []).filter(
    (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS
  );
  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    requestLog.set(deviceId, recent);
    return true;
  }
  recent.push(now);
  requestLog.set(deviceId, recent);
  return false;
}

function detectImageContentType(buffer: ArrayBuffer): string | null {
  const bytes = new Uint8Array(buffer);
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

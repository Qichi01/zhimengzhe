import { NextRequest, NextResponse } from "next/server";
import { buildAvatarPrompt, sanitizeVisualReference } from "@/lib/imagePrompts";
import {
  fetchGeneratedImage,
  hasUnsafeGenerationFilter,
  inspectGeneratedImage,
} from "@/lib/imageModeration";
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
  deviceId?: string;
}

interface ImageApiResponse {
  data?: Array<{ url?: string }>;
  content_filter?: Array<{ role?: string; level?: number }>;
  contentFilter?: Array<{ role?: string; level?: number }>;
  error?: { code?: string | number; message?: string };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AvatarRequest;
    const characterName = cleanText(body.characterName, 80);
    const description = cleanText(body.description, 600);
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
        prompt: buildAvatarPrompt(gameType, characterName, description),
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
        generationData.error?.message ?? "unknown error",
        generationData.contentFilter ?? []
      );
      const safetyRejected = String(generationData.error?.code ?? "") === "1301";
      return NextResponse.json(
        {
          error: safetyRejected
            ? "人物介绍中包含暂不支持的图像内容，请调整后重试"
            : "头像生成服务暂时不可用",
        },
        { status: safetyRejected ? 422 : 502 }
      );
    }
    if (hasUnsafeGenerationFilter(generationData.content_filter)) {
      return NextResponse.json(
        {
          error: "生成结果未通过头像安全检查，请重新生成或上传图片",
          retryable: true,
        },
        { status: 422 }
      );
    }

    const imageUrl = generationData.data?.[0]?.url;
    if (!imageUrl || !isSafeImageUrl(imageUrl)) {
      return NextResponse.json({ error: "头像服务未返回有效图片" }, { status: 502 });
    }

    const [imageResponse, inspection] = await Promise.all([
      fetchGeneratedImage(imageUrl),
      inspectGeneratedImage(apiKey, imageUrl, {
        kind: "avatar",
        characterReference: sanitizeVisualReference(
          description || "自然亲和的具体角色",
          500
        ),
      }),
    ]);
    if (!inspection.valid) {
      return NextResponse.json(
        {
          error:
            inspection.reason === "unsafe"
              ? "生成结果未通过头像安全检查，请重新生成或上传图片"
              : inspection.reason === "off_spec"
                ? "生成结果不符合单角色半身头像规范，请重新生成"
                : "头像质量检查暂时不可用，请稍后重试",
          retryable: true,
        },
        { status: inspection.reason === "unavailable" ? 502 : 422 }
      );
    }
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
        "X-Image-Safety": "provider-filtered+vision",
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

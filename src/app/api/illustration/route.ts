import { NextRequest, NextResponse } from "next/server";
import {
  buildSceneImagePrompt,
  sanitizeVisualReference,
} from "@/lib/imagePrompts";
import {
  fetchGeneratedImage,
  hasUnsafeGenerationFilter,
  inspectGeneratedImage,
} from "@/lib/imageModeration";
import type { GameType } from "@/types";
import type { IllustrationReason } from "@/lib/illustrations";

export const runtime = "nodejs";
export const maxDuration = 60;

// 与聊天代理保持一致：仅本地开发时兼容代理软件注入的自签名证书。
if (process.env.NODE_ENV === "development") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const IMAGE_ENDPOINT = "https://open.bigmodel.cn/api/paas/v4/images/generations";
const DEFAULT_IMAGE_MODEL = "cogview-3-flash";
const DEFAULT_IMAGE_SIZE = "1440x720";
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 8;

const VALID_REASONS = new Set<IllustrationReason>([
  "story_opening",
  "chapter_opening",
  "ending",
  "important_location",
  "relationship_turn",
  "important_character",
  "ai_suggested",
]);

const requestLog = new Map<string, number[]>();

interface IllustrationRequest {
  gameType?: GameType;
  storySetting?: string;
  sceneContent?: string;
  reason?: IllustrationReason;
  deviceId?: string;
}

interface ImageApiResponse {
  data?: Array<{ url?: string }>;
  content_filter?: Array<{ role?: string; level?: number }>;
  error?: { code?: string | number; message?: string };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as IllustrationRequest;
    const sceneContent = cleanText(body.sceneContent, 1600);
    const storySetting = cleanText(body.storySetting, 800);
    const reason = body.reason;
    const deviceId = cleanIdentifier(body.deviceId);

    if (!sceneContent || !reason || !VALID_REASONS.has(reason)) {
      return NextResponse.json({ error: "缺少有效的关键场景信息" }, { status: 400 });
    }
    if (!deviceId) {
      return NextResponse.json({ error: "缺少设备标识" }, { status: 400 });
    }
    if (isRateLimited(deviceId)) {
      return NextResponse.json(
        { error: "配图生成过于频繁，请稍后再试" },
        { status: 429 }
      );
    }

    const apiKey = cleanEnv(process.env.IMAGE_API_KEY) || cleanEnv(process.env.GLM_API_KEY);
    if (!apiKey) {
      return NextResponse.json(
        { error: "配图服务暂未配置" },
        { status: 503 }
      );
    }

    const model = cleanEnv(process.env.IMAGE_MODEL) || DEFAULT_IMAGE_MODEL;
    const prompt = buildSceneImagePrompt(
      body.gameType === "otome" || body.gameType === "mystery" ? body.gameType : "other",
      storySetting,
      sceneContent
    );

    const generationResponse = await fetch(IMAGE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        prompt,
        size: DEFAULT_IMAGE_SIZE,
        quality: model === "glm-image" ? "hd" : "standard",
        user_id: deviceId,
      }),
      signal: AbortSignal.timeout(45_000),
      cache: "no-store",
    });

    const generationData = (await generationResponse.json()) as ImageApiResponse;
    if (!generationResponse.ok) {
      console.error(
        "Illustration API error:",
        generationResponse.status,
        generationData.error?.message ?? "unknown error"
      );
      const safetyRejected = String(generationData.error?.code ?? "") === "1301";
      return NextResponse.json(
        {
          error: safetyRejected
            ? "场景内容超出当前图片规范，已跳过配图"
            : "配图服务暂时不可用",
        },
        { status: safetyRejected ? 422 : 502 }
      );
    }
    if (hasUnsafeGenerationFilter(generationData.content_filter)) {
      return NextResponse.json(
        { error: "生成结果未通过图片安全检查，已停止展示" },
        { status: 422 }
      );
    }

    const imageUrl = generationData.data?.[0]?.url;
    if (!imageUrl || !isSafeImageUrl(imageUrl)) {
      return NextResponse.json(
        { error: "配图服务未返回有效图片" },
        { status: 502 }
      );
    }

    // 智谱返回的是临时 URL；服务端立即下载并交给客户端存入 IndexedDB。
    const [imageResponse, inspection] = await Promise.all([
      fetchGeneratedImage(imageUrl),
      inspectGeneratedImage(apiKey, imageUrl, {
        kind: "scene",
        sceneReference: sanitizeVisualReference(sceneContent, 600),
      }),
    ]);
    if (!inspection.valid) {
      return NextResponse.json(
        {
          error:
            inspection.reason === "unsafe"
              ? "生成结果未通过图片安全检查，已停止展示"
              : inspection.reason === "off_spec"
                ? "生成图片与当前场景不符，已停止展示"
                : "图片质量检查暂时不可用，正文不受影响",
        },
        { status: inspection.reason === "unavailable" ? 502 : 422 }
      );
    }
    if (!imageResponse.ok) {
      return NextResponse.json({ error: "配图下载失败" }, { status: 502 });
    }

    const declaredContentType = imageResponse.headers.get("content-type") ?? "";
    if (!declaredContentType.startsWith("image/")) {
      return NextResponse.json({ error: "配图格式无效" }, { status: 502 });
    }

    const imageBytes = await imageResponse.arrayBuffer();
    if (imageBytes.byteLength > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "配图文件过大" }, { status: 502 });
    }
    // 部分智谱 CDN 链接会把 JPEG 误报为 image/png，以文件签名为准。
    const contentType = detectImageContentType(imageBytes);
    if (!contentType) {
      return NextResponse.json({ error: "无法识别配图格式" }, { status: 502 });
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
    const message = error instanceof Error ? error.message : String(error);
    console.error("Illustration route error:", message);
    return NextResponse.json(
      { error: "配图生成失败，故事正文不受影响" },
      { status: 500 }
    );
  }
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

function cleanEnv(value: string | undefined): string {
  return (value ?? "").trim().split("\n")[0].trim();
}

function cleanText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ").trim().slice(0, maxLength);
}

function cleanIdentifier(value: unknown): string {
  if (typeof value !== "string") return "";
  const cleaned = value.trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 128);
  return cleaned.length >= 6 ? cleaned : "";
}

function isSafeImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
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

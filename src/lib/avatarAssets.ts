import type { CharacterAvatar, GameType } from "@/types";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const AVATAR_SIZE = 512;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const inFlightAvatarRequests = new Map<string, Promise<CharacterAvatar>>();

interface GenerateCharacterAvatarInput {
  characterName: string;
  description: string | null;
  gameType: GameType;
  storySetting: string;
  deviceId: string;
}

export class AvatarGenerationError extends Error {
  readonly retryable: boolean;

  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = "AvatarGenerationError";
    this.retryable = retryable;
  }
}

export async function createUploadedAvatar(file: File): Promise<CharacterAvatar> {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error("请选择 JPG、PNG 或 WebP 图片");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("头像原图不能超过 5 MB");
  }

  return {
    dataUrl: await optimizeAvatar(file),
    source: "uploaded",
    updatedAt: new Date().toISOString(),
  };
}

export async function generateCharacterAvatar({
  characterName,
  description,
  gameType,
  deviceId,
}: GenerateCharacterAvatarInput): Promise<CharacterAvatar> {
  const requestKey = [
    deviceId,
    gameType,
    characterName.trim(),
    description?.trim() ?? "",
  ].join("::");
  const existingRequest = inFlightAvatarRequests.get(requestKey);
  if (existingRequest) return existingRequest;

  const request = requestCharacterAvatar({
    characterName,
    description,
    gameType,
    deviceId,
  }).finally(() => {
    inFlightAvatarRequests.delete(requestKey);
  });
  inFlightAvatarRequests.set(requestKey, request);
  return request;
}

async function requestCharacterAvatar({
  characterName,
  description,
  gameType,
  deviceId,
}: Omit<GenerateCharacterAvatarInput, "storySetting">): Promise<CharacterAvatar> {
  const response = await fetch("/api/avatar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      characterName,
      description,
      gameType,
      deviceId,
    }),
  });

  if (!response.ok) {
    let message = "默认头像生成失败，请稍后重试";
    let retryable: boolean | undefined;
    try {
      const data = await response.json();
      if (typeof data?.error === "string") message = data.error;
      if (typeof data?.retryable === "boolean") retryable = data.retryable;
    } catch {
      // 图片接口失败时保留首字兜底头像。
    }
    throw new AvatarGenerationError(
      message,
      retryable ?? (response.status === 429 || response.status >= 500)
    );
  }

  const imageBlob = await response.blob();
  if (!imageBlob.type.startsWith("image/")) {
    throw new Error("头像服务返回了无效内容");
  }

  return {
    dataUrl: await optimizeAvatar(imageBlob),
    source: "generated",
    generatedModel: response.headers.get("X-Image-Model") ?? "cogview-3-flash",
    updatedAt: new Date().toISOString(),
  };
}

async function optimizeAvatar(blob: Blob): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("当前浏览器无法处理头像图片");

  let source: CanvasImageSource;
  let width: number;
  let height: number;
  let cleanup = () => {};

  try {
    const bitmap = await createImageBitmap(blob);
    source = bitmap;
    width = bitmap.width;
    height = bitmap.height;
    cleanup = () => bitmap.close();
  } catch {
    const objectUrl = URL.createObjectURL(blob);
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("无法读取头像图片"));
      element.src = objectUrl;
    });
    source = image;
    width = image.naturalWidth;
    height = image.naturalHeight;
    cleanup = () => URL.revokeObjectURL(objectUrl);
  }

  try {
    const cropSize = Math.min(width, height);
    const sourceX = (width - cropSize) / 2;
    const sourceY = (height - cropSize) / 2;
    context.drawImage(
      source,
      sourceX,
      sourceY,
      cropSize,
      cropSize,
      0,
      0,
      AVATAR_SIZE,
      AVATAR_SIZE
    );

    const optimized = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/webp", 0.84);
    });
    if (!optimized) throw new Error("头像压缩失败");
    return readBlobAsDataUrl(optimized);
  } finally {
    cleanup();
  }
}

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("头像读取失败"));
    reader.readAsDataURL(blob);
  });
}

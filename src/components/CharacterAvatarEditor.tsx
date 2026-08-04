"use client";

import { useRef, useState } from "react";
import CharacterAvatar from "./CharacterAvatar";
import { createUploadedAvatar, generateCharacterAvatar } from "@/lib/avatarAssets";
import { getDeviceId, updateCharacterAvatar } from "@/lib/localDb";
import type { Character, GameType } from "@/types";

interface CharacterAvatarEditorProps {
  character: Character;
  gameType: GameType;
  storySetting: string;
  onUpdated: (character: Character) => void;
  showPreview?: boolean;
}

export default function CharacterAvatarEditor({
  character,
  gameType,
  storySetting,
  onUpdated,
  showPreview = true,
}: CharacterAvatarEditorProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveAvatar = async (avatar: Character["avatar"]) => {
    const result = await updateCharacterAvatar(character.id, avatar ?? null);
    if (!result.data) throw new Error(result.error ?? "头像保存失败");
    onUpdated(result.data);
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError(null);
    setIsWorking(true);
    try {
      await saveAvatar(await createUploadedAvatar(file));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "头像上传失败");
    } finally {
      setIsWorking(false);
    }
  };

  const handleGenerate = async () => {
    setError(null);
    setIsWorking(true);
    try {
      const avatar = await generateCharacterAvatar({
        characterName: character.name,
        description: character.description,
        gameType,
        storySetting,
        deviceId: getDeviceId(),
      });
      await saveAvatar(avatar);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "默认头像生成失败");
    } finally {
      setIsWorking(false);
    }
  };

  const handleClear = async () => {
    setError(null);
    setIsWorking(true);
    try {
      await saveAvatar(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "头像重置失败");
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {showPreview && (
        <CharacterAvatar
          name={character.name}
          color={character.avatar_color}
          avatar={character.avatar}
          size={56}
        />
      )}
      <div className="min-w-0">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={isWorking}
            onClick={() => inputRef.current?.click()}
            className="rounded-full border px-3 py-1.5 text-xs transition-colors hover:bg-white/10 disabled:cursor-wait disabled:opacity-50"
            style={{ borderColor: "rgba(200,170,255,0.28)", color: "#e8d5f5" }}
          >
            {character.avatar ? "上传替换" : "上传头像"}
          </button>
          <button
            type="button"
            disabled={isWorking}
            onClick={handleGenerate}
            className="rounded-full border px-3 py-1.5 text-xs transition-colors hover:bg-white/10 disabled:cursor-wait disabled:opacity-50"
            style={{ borderColor: "rgba(200,170,255,0.28)", color: "#c8aaff" }}
          >
            {isWorking ? "处理中…" : character.avatar ? "重新生成" : "生成默认头像"}
          </button>
          {character.avatar && (
            <button
              type="button"
              disabled={isWorking}
              onClick={handleClear}
              className="rounded-full px-2 py-1.5 text-xs transition-opacity hover:opacity-70 disabled:opacity-40"
              style={{ color: "rgba(213,184,245,0.5)" }}
            >
              恢复首字头像
            </button>
          )}
        </div>
        <p className="mt-1.5 text-[11px]" style={{ color: error ? "#ff9ca8" : "rgba(213,184,245,0.4)" }}>
          {error ?? (character.avatar?.source === "uploaded" ? "当前使用你上传的图片，仅保存在本机" : character.avatar ? "当前使用 AI 默认头像，可随时上传替换" : "支持 JPG、PNG、WebP，最大 5 MB")}
        </p>
      </div>
    </div>
  );
}

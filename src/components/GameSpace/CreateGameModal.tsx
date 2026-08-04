"use client";

import { useRef, useState } from "react";
import type {
  GameType,
  StorySourceFormat,
} from "@/types";

export type CreateGameRequest =
  | {
      experience: "v2";
      title: string;
      type: GameType;
      setting: string;
    }
  | {
      experience: "v3";
      title?: string;
      primaryGenre: "campus_otome" | "infinite_flow";
      sourceFormat: StorySourceFormat;
      sourceFileName?: string;
      sourceText: string;
    };

interface CreateGameModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (request: CreateGameRequest) => Promise<void> | void;
}

const GAME_TYPES: { value: GameType; label: string; desc: string; color: string }[] = [
  { value: "otome", label: "乙游", desc: "恋爱养成", color: "#ffb3d9" },
  { value: "mystery", label: "悬疑", desc: "推理探秘", color: "#a3d4ff" },
  { value: "other", label: "其他", desc: "自由冒险", color: "#c8aaff" },
];

const V3_GENRES = [
  {
    value: "campus_otome" as const,
    label: "校园乙游",
    desc: "手机、私聊、论坛与日历",
    color: "#ffb3d9",
  },
  {
    value: "infinite_flow" as const,
    label: "无限流",
    desc: "系统、任务、背包与商店",
    color: "#71f5c2",
  },
];

const COVER_COLORS: Record<GameType, string> = {
  otome: "#ffb3d9",
  mystery: "#a3d4ff",
  other: "#c8aaff",
};

const MAX_SOURCE_BYTES = 20 * 1024 * 1024;

export default function CreateGameModal({
  open,
  onClose,
  onCreate,
}: CreateGameModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [experience, setExperience] = useState<"v2" | "v3">("v3");
  const [title, setTitle] = useState("");
  const [type, setType] = useState<GameType>("otome");
  const [primaryGenre, setPrimaryGenre] = useState<
    "campus_otome" | "infinite_flow"
  >("campus_otome");
  const [setting, setSetting] = useState("");
  const [sourceFormat, setSourceFormat] = useState<StorySourceFormat>("manual");
  const [sourceFileName, setSourceFileName] = useState<string | undefined>();
  const [fileError, setFileError] = useState<string | null>(null);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!open) return null;

  const reset = () => {
    setTitle("");
    setType("otome");
    setPrimaryGenre("campus_otome");
    setSetting("");
    setSourceFormat("manual");
    setSourceFileName(undefined);
    setFileError(null);
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setFileError(null);
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !["txt", "md", "markdown"].includes(extension)) {
      setFileError("当前仅支持 TXT、MD 和 Markdown 文件");
      return;
    }
    if (file.size > MAX_SOURCE_BYTES) {
      setFileError("文件不能超过 20 MB");
      return;
    }
    setIsReadingFile(true);
    try {
      const text = (await file.text()).replace(/^\uFEFF/, "").trim();
      if (!text) throw new Error("文件内容为空");
      setSetting(text);
      setSourceFileName(file.name);
      setSourceFormat(extension === "txt" ? "txt" : "markdown");
    } catch (cause) {
      setFileError(cause instanceof Error ? cause.message : "无法读取文件");
    } finally {
      setIsReadingFile(false);
    }
  };

  const handleSubmit = async () => {
    if (!setting.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (experience === "v2") {
        const finalTitle = title.trim() || setting.trim().slice(0, 12);
        await onCreate({
          experience: "v2",
          title: finalTitle,
          type,
          setting: setting.trim(),
        });
      } else {
        await onCreate({
          experience: "v3",
          title: title.trim() || undefined,
          primaryGenre,
          sourceFormat,
          sourceFileName,
          sourceText: setting.trim(),
        });
      }
      reset();
    } finally {
      setIsSubmitting(false);
    }
  };

  const accentColor =
    experience === "v3"
      ? V3_GENRES.find((genre) => genre.value === primaryGenre)?.color ?? "#c8aaff"
      : COVER_COLORS[type];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(20,17,30,0.84)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto rounded-3xl p-6 sm:p-7"
        style={{
          background:
            "linear-gradient(160deg, rgba(42,38,64,0.98) 0%, rgba(30,27,46,0.98) 100%)",
          border: "1px solid rgba(200,170,255,0.2)",
          boxShadow: "0 24px 80px rgba(120,80,200,0.3)",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold" style={{ color: "#e8d5f5" }}>
              创建新梦境
            </h2>
            <p className="mt-1 text-xs" style={{ color: "rgba(213,184,245,0.5)" }}>
              V3 会把故事设定编译成可游玩的沉浸界面
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="rounded-full p-2 transition-colors hover:bg-white/10"
            style={{ color: "rgba(213,184,245,0.6)" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl p-1" style={{ background: "rgba(200,170,255,0.05)" }}>
          <button
            type="button"
            onClick={() => setExperience("v3")}
            className="rounded-xl px-3 py-2.5 text-sm transition-all"
            style={{
              background: experience === "v3" ? "rgba(200,170,255,0.16)" : "transparent",
              color: experience === "v3" ? "#e8d5f5" : "rgba(213,184,245,0.5)",
            }}
          >
            沉浸模式 V3 <span className="ml-1 text-[10px] text-emerald-300">推荐</span>
          </button>
          <button
            type="button"
            onClick={() => setExperience("v2")}
            className="rounded-xl px-3 py-2.5 text-sm transition-all"
            style={{
              background: experience === "v2" ? "rgba(200,170,255,0.16)" : "transparent",
              color: experience === "v2" ? "#e8d5f5" : "rgba(213,184,245,0.5)",
            }}
          >
            经典模式 V2
          </button>
        </div>

        <div className="mb-5">
          <label className="mb-2.5 block text-sm" style={{ color: "#c9b3e0" }}>
            {experience === "v3" ? "沉浸题材" : "游戏类型"}
          </label>
          <div className={`grid gap-2.5 ${experience === "v3" ? "grid-cols-2" : "grid-cols-3"}`}>
            {(experience === "v3" ? V3_GENRES : GAME_TYPES).map((item) => {
              const selected =
                experience === "v3"
                  ? primaryGenre === item.value
                  : type === item.value;
              return (
                <button
                  type="button"
                  key={item.value}
                  onClick={() => {
                    if (experience === "v3") {
                      setPrimaryGenre(item.value as "campus_otome" | "infinite_flow");
                    } else {
                      setType(item.value as GameType);
                    }
                  }}
                  className="rounded-xl px-2 py-3 text-center transition-all"
                  style={{
                    background: selected ? `${item.color}20` : "rgba(200,170,255,0.05)",
                    border: selected
                      ? `1px solid ${item.color}80`
                      : "1px solid rgba(200,170,255,0.12)",
                  }}
                >
                  <div className="mb-0.5 text-sm font-semibold" style={{ color: selected ? item.color : "#c9b3e0" }}>
                    {item.label}
                  </div>
                  <div className="text-[11px] leading-4" style={{ color: "rgba(213,184,245,0.5)" }}>
                    {item.desc}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-5">
          <label className="mb-2.5 block text-sm" style={{ color: "#c9b3e0" }}>
            梦境名称 <span style={{ color: "rgba(213,184,245,0.4)" }}>（可选）</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="留空时从故事内容中提取"
            maxLength={30}
            className="w-full rounded-xl px-4 py-3 text-base outline-none"
            style={{ color: "#e8d5f5", background: "rgba(200,170,255,0.05)", border: "1px solid rgba(200,170,255,0.15)", fontSize: 16 }}
          />
        </div>

        <div className="mb-6">
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <label className="text-sm" style={{ color: "#c9b3e0" }}>
              {experience === "v3" ? "故事内容或世界设定" : "故事设定"}
            </label>
            {experience === "v3" && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md,.markdown,text/plain,text/markdown"
                  className="hidden"
                  onChange={(event) => void handleFile(event.target.files?.[0])}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isReadingFile}
                  className="rounded-full border px-3 py-1.5 text-xs transition-colors hover:bg-white/10 disabled:opacity-50"
                  style={{ borderColor: "rgba(200,170,255,0.25)", color: "#c8aaff" }}
                >
                  {isReadingFile ? "正在读取…" : "导入 TXT / Markdown"}
                </button>
              </>
            )}
          </div>
          {sourceFileName && (
            <div className="mb-2 flex items-center justify-between rounded-lg px-3 py-2 text-xs" style={{ background: "rgba(113,245,194,0.08)", color: "#9fe8c4" }}>
              <span className="truncate">已在本机读取：{sourceFileName}</span>
              <button
                type="button"
                onClick={() => {
                  setSourceFileName(undefined);
                  setSourceFormat("manual");
                }}
                className="ml-3 shrink-0 opacity-70 hover:opacity-100"
              >
                改为手动输入
              </button>
            </div>
          )}
          <textarea
            value={setting}
            onChange={(event) => {
              setSetting(event.target.value);
              if (!sourceFileName) setSourceFormat("manual");
            }}
            rows={6}
            placeholder={experience === "v3" ? "粘贴小说片段、人物设定、世界观，或导入本地文件…" : "例如：你是一名失忆的公主，在梦中寻找记忆…"}
            className="w-full resize-none rounded-xl px-4 py-3 text-base leading-relaxed outline-none"
            style={{ color: "#e8d5f5", background: "rgba(200,170,255,0.05)", border: "1px solid rgba(200,170,255,0.15)", fontSize: 16 }}
            autoFocus
          />
          {experience === "v3" && (
            <p className="mt-2 text-[11px] leading-4" style={{ color: fileError ? "#ff9ca8" : "rgba(213,184,245,0.4)" }}>
              {fileError ?? "文件只在浏览器本机读取；确认世界档案前不会创建游戏，也不会上传原文件。"}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!setting.trim() || isSubmitting || isReadingFile}
          className="w-full rounded-full py-3.5 text-base font-medium tracking-wider transition-all active:scale-95 disabled:opacity-40 hover:scale-[1.02]"
          style={{
            background: `linear-gradient(135deg, ${accentColor} 0%, #b08fe8 100%)`,
            color: "#1e1b2e",
            boxShadow: "0 8px 30px rgba(200,170,255,0.3)",
          }}
        >
          {isSubmitting
            ? "正在整理世界…"
            : experience === "v3"
              ? "生成世界档案"
              : "开始编织梦境"}
        </button>
      </div>
    </div>
  );
}

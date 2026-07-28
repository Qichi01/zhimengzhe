"use client";

import { useState } from "react";
import type { GameType } from "@/types";

interface CreateGameModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (title: string, type: GameType, setting: string) => void;
}

const GAME_TYPES: { value: GameType; label: string; desc: string; color: string }[] = [
  { value: "otome", label: "乙游", desc: "恋爱养成", color: "#ffb3d9" },
  { value: "mystery", label: "悬疑", desc: "推理探秘", color: "#a3d4ff" },
  { value: "other", label: "其他", desc: "自由冒险", color: "#c8aaff" },
];

const COVER_COLORS: Record<GameType, string> = {
  otome: "#ffb3d9",
  mystery: "#a3d4ff",
  other: "#c8aaff",
};

export default function CreateGameModal({
  open,
  onClose,
  onCreate,
}: CreateGameModalProps) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<GameType>("otome");
  const [setting, setSetting] = useState("");

  if (!open) return null;

  const handleSubmit = () => {
    if (!setting.trim()) return;

    // 如果没有填标题，从设定中截取前 12 个字
    const finalTitle = title.trim() || setting.trim().slice(0, 12);

    onCreate(finalTitle, type, setting.trim());

    // 重置
    setTitle("");
    setType("otome");
    setSetting("");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(20, 17, 30, 0.8)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl p-7"
        style={{
          background: "linear-gradient(160deg, rgba(42,38,64,0.95) 0%, rgba(30,27,46,0.95) 100%)",
          border: "1px solid rgba(200,170,255,0.2)",
          boxShadow: "0 24px 80px rgba(120, 80, 200, 0.3)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold" style={{ color: "#e8d5f5" }}>
            创建新梦境
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full transition-colors hover:bg-white/10"
            style={{ color: "rgba(213,184,245,0.6)" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 游戏类型选择 */}
        <div className="mb-5">
          <label
            className="block text-sm mb-2.5"
            style={{ color: "#c9b3e0" }}
          >
            游戏类型
          </label>
          <div className="grid grid-cols-3 gap-2.5">
            {GAME_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setType(t.value)}
                className="rounded-xl py-3 text-center transition-all duration-200"
                style={{
                  background:
                    type === t.value
                      ? `${t.color}20`
                      : "rgba(200,170,255,0.05)",
                  border:
                    type === t.value
                      ? `1px solid ${t.color}80`
                      : "1px solid rgba(200,170,255,0.12)",
                }}
              >
                <div
                  className="text-sm font-semibold mb-0.5"
                  style={{
                    color: type === t.value ? t.color : "#c9b3e0",
                  }}
                >
                  {t.label}
                </div>
                <div
                  className="text-xs"
                  style={{ color: "rgba(213,184,245,0.5)" }}
                >
                  {t.desc}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 标题（可选） */}
        <div className="mb-5">
          <label
            className="block text-sm mb-2.5"
            style={{ color: "#c9b3e0" }}
          >
            梦境名称{" "}
            <span style={{ color: "rgba(213,184,245,0.4)" }}>
              （可选，留空将自动生成）
            </span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="给你的梦境起个名字..."
            maxLength={30}
            className="w-full rounded-xl px-4 py-3 text-base outline-none transition-all focus:shadow-[0_0_20px_rgba(200,170,255,0.2)]"
            style={{
              color: "#e8d5f5",
              background: "rgba(200,170,255,0.05)",
              border: "1px solid rgba(200,170,255,0.15)",
              fontSize: "16px",
            }}
          />
        </div>

        {/* 故事设定 */}
        <div className="mb-6">
          <label
            className="block text-sm mb-2.5"
            style={{ color: "#c9b3e0" }}
          >
            故事设定
          </label>
          <textarea
            value={setting}
            onChange={(e) => setSetting(e.target.value)}
            rows={4}
            placeholder="例如：你是一名失忆的公主，在梦中寻找记忆..."
            className="w-full resize-none rounded-xl px-4 py-3 text-base leading-relaxed outline-none transition-all focus:shadow-[0_0_20px_rgba(200,170,255,0.2)]"
            style={{
              color: "#e8d5f5",
              background: "rgba(200,170,255,0.05)",
              border: "1px solid rgba(200,170,255,0.15)",
              fontSize: "16px",
            }}
            autoFocus
          />
        </div>

        {/* 创建按钮 */}
        <button
          onClick={handleSubmit}
          disabled={!setting.trim()}
          className="w-full py-3.5 rounded-full text-base font-medium tracking-wider transition-all duration-300 active:scale-95 disabled:opacity-40 hover:scale-[1.02]"
          style={{
            background: `linear-gradient(135deg, ${COVER_COLORS[type]} 0%, #b08fe8 100%)`,
            color: "#1e1b2e",
            boxShadow: "0 8px 30px rgba(200,170,255,0.3)",
          }}
        >
          开始编织梦境
        </button>
      </div>
    </div>
  );
}

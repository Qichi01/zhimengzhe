"use client";

import { useState } from "react";
import type { Save } from "@/types";

interface SaveListProps {
  saves: Save[];
  onLoad: (save: Save) => void;
  onDelete: (saveId: string) => void;
  onClose: () => void;
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 30) return `${days}天前`;
  return date.toLocaleDateString("zh-CN");
}

export default function SaveList({
  saves,
  onLoad,
  onDelete,
  onClose,
}: SaveListProps) {
  const [tab, setTab] = useState<"auto" | "manual">("auto");

  const filtered = saves.filter((s) => s.save_type === tab);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: "rgba(20, 17, 30, 0.8)",
        backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[80vh] flex flex-col rounded-3xl overflow-hidden"
        style={{
          background:
            "linear-gradient(160deg, rgba(42,38,64,0.95) 0%, rgba(30,27,46,0.95) 100%)",
          border: "1px solid rgba(200,170,255,0.2)",
          boxShadow: "0 24px 80px rgba(120, 80, 200, 0.3)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: "rgba(200,170,255,0.1)" }}>
          <h2 className="text-lg font-semibold" style={{ color: "#e8d5f5" }}>
            读取存档
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

        {/* Tab 切换 */}
        <div className="flex gap-2 px-6 pt-4">
          {(["auto", "manual"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-4 py-2 rounded-full text-sm font-medium transition-all"
              style={{
                background:
                  tab === t ? "rgba(200,170,255,0.15)" : "transparent",
                color: tab === t ? "#c8aaff" : "rgba(213,184,245,0.5)",
                border:
                  tab === t
                    ? "1px solid rgba(200,170,255,0.4)"
                    : "1px solid rgba(200,170,255,0.1)",
              }}
            >
              {t === "auto" ? "自动存档" : "手动存档"}
            </button>
          ))}
        </div>

        {/* 存档列表 */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <p style={{ color: "rgba(213,184,245,0.4)" }} className="text-sm">
                {tab === "auto" ? "暂无自动存档" : "暂无手动存档"}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filtered.map((save) => (
                <div
                  key={save.id}
                  className="group rounded-xl p-4 transition-all hover:scale-[1.01]"
                  style={{
                    background: "rgba(200,170,255,0.05)",
                    border: "1px solid rgba(200,170,255,0.12)",
                  }}
                >
                  <div className="flex items-start justify-between">
                    <button
                      onClick={() => onLoad(save)}
                      className="flex-1 text-left"
                    >
                      <div
                        className="font-medium mb-1"
                        style={{ color: "#e8d5f5" }}
                      >
                        {save.label}
                      </div>
                      <div
                        className="text-xs"
                        style={{ color: "rgba(213,184,245,0.5)" }}
                      >
                        第 {save.scene_index + 1} 场景 · {formatTime(save.created_at)}
                      </div>
                    </button>
                    <button
                      onClick={() => onDelete(save.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full hover:bg-red-500/20"
                      style={{ color: "rgba(245,160,168,0.6)" }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

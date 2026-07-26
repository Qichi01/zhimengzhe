"use client";

import Link from "next/link";
import type { Game } from "@/types";
import type { GameType } from "@/types";

const TYPE_LABELS: Record<GameType, string> = {
  otome: "乙游",
  mystery: "悬疑",
  other: "其他",
};

const TYPE_COLORS: Record<GameType, string> = {
  otome: "#ffb3d9",
  mystery: "#a3d4ff",
  other: "#c8aaff",
};

/** 格式化相对时间 */
function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "未开始";
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

interface GameCardProps {
  game: Game;
  onDelete?: (gameId: string) => void;
}

export default function GameCard({ game, onDelete }: GameCardProps) {
  const typeColor = TYPE_COLORS[game.type];

  return (
    <div className="group relative">
      <Link
        href={`/game/${game.id}`}
        className="block rounded-2xl p-5 transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_8px_40px_rgba(200,170,255,0.2)]"
        style={{
          background: "rgba(200,170,255,0.06)",
          border: "1px solid rgba(200,170,255,0.15)",
          minHeight: "160px",
        }}
      >
        {/* 封面色条 */}
        <div
          className="mb-3 h-1 w-full rounded-full"
          style={{
            background: `linear-gradient(90deg, ${game.cover_color} 0%, transparent 100%)`,
          }}
        />

        {/* 标题 */}
        <h3
          className="text-lg font-semibold mb-2 truncate"
          style={{ color: "#e8d5f5" }}
        >
          {game.title}
        </h3>

        {/* 类型标签 */}
        <div className="flex items-center gap-2 mb-3">
          <span
            className="px-2 py-0.5 rounded-full text-xs"
            style={{
              color: typeColor,
              background: `${typeColor}15`,
              border: `1px solid ${typeColor}40`,
            }}
          >
            {TYPE_LABELS[game.type]}
          </span>
          <span
            className="text-xs"
            style={{ color: "rgba(213,184,245,0.5)" }}
          >
            {formatRelativeTime(game.last_played_at)}
          </span>
        </div>

        {/* 设定预览 */}
        <p
          className="text-xs leading-relaxed line-clamp-2"
          style={{ color: "rgba(213,184,245,0.6)" }}
        >
          {game.setting}
        </p>
      </Link>

      {/* 删除按钮 */}
      {onDelete && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (confirm(`确定要删除「${game.title}」吗？所有进度将丢失。`)) {
              onDelete(game.id);
            }
          }}
          className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-full hover:bg-red-500/20"
          style={{ color: "rgba(245,160,168,0.6)" }}
          aria-label="删除游戏"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" />
          </svg>
        </button>
      )}
    </div>
  );
}

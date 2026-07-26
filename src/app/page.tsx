"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import StarfieldBackground from "@/components/StarfieldBackground";
import GameCard from "@/components/GameSpace/GameCard";
import CreateGameModal from "@/components/GameSpace/CreateGameModal";
import { useAuthStore } from "@/stores/authStore";
import {
  getGames,
  createGame,
  deleteGame,
} from "@/lib/localDb";
import { track } from "@/lib/analytics";
import type { Game, GameType } from "@/types";

export default function Home() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [games, setGames] = useState<Game[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const PAGE_SIZE = 8;

  const loadGames = useCallback(async () => {
    setLoading(true);
    const { data, count } = await getGames("local", 1, showAll ? 100 : PAGE_SIZE);
    setGames(data ?? []);
    setTotalCount(count ?? 0);
    setLoading(false);
  }, [showAll]);

  useEffect(() => {
    loadGames();
  }, [loadGames]);

  const handleCreate = async (title: string, type: GameType, setting: string) => {
    const { data, error } = await createGame("local", title, type, setting);
    if (error) {
      alert(`创建失败：${error}`);
      return;
    }
    if (data) {
      track("create_game", { game_type: type });
      router.push(`/game/${data.id}`);
    }
  };

  const handleDelete = async (gameId: string) => {
    const { error } = await deleteGame(gameId);
    if (error) {
      alert(`删除失败：${error}`);
      return;
    }
    setGames((prev) => prev.filter((g) => g.id !== gameId));
    setTotalCount((prev) => prev - 1);
  };

  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at 50% -10%, #2e2b4e 0%, #1e1b2e 55%, #14111e 100%)",
      }}
    >
      <StarfieldBackground density="normal" />

      {/* 顶部导航 */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-8">
        <h1
          className="text-2xl font-bold tracking-[0.15em]"
          style={{
            color: "#e8d5f5",
            textShadow: "0 0 20px rgba(200,170,255,0.4)",
          }}
        >
          织梦者
        </h1>
        <div className="flex items-center gap-3">
          {user && (
            <span
              className="text-xs px-3 py-1.5 rounded-full"
              style={{
                background: "rgba(120,220,170,0.1)",
                border: "1px solid rgba(120,220,170,0.3)",
                color: "#9fe8c4",
              }}
              title={user.email ?? ""}
            >
              已登录
            </span>
          )}
          <Link
            href="/settings"
            aria-label="设置"
            className="p-2 rounded-full transition-all hover:bg-white/5"
            style={{ color: "#e8d5f5" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82V9a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </Link>
        </div>
      </header>

      {/* 主体内容 */}
      <main className="relative z-10 mx-auto max-w-5xl px-6 pb-16 sm:px-8">
        {/* 标题区 */}
        <div className="mb-8 mt-4">
          <h2
            className="text-3xl font-semibold mb-2"
            style={{ color: "#e8d5f5" }}
          >
            我的梦境
          </h2>
          <p
            className="text-sm tracking-wide"
            style={{ color: "rgba(213,184,245,0.5)" }}
          >
            {totalCount > 0
              ? `共 ${totalCount} 个梦境`
              : "编织属于你的第一个梦境吧"}
          </p>
        </div>

        {/* 游戏卡片网格 */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div
              className="inline-block w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: "#c8aaff", borderTopColor: "transparent" }}
            />
          </div>
        ) : games.length === 0 ? (
          /* 空状态 */
          <button
            onClick={() => setShowCreateModal(true)}
            className="w-full rounded-2xl py-16 transition-all duration-300 hover:scale-[1.01]"
            style={{
              background: "rgba(200,170,255,0.04)",
              border: "1px dashed rgba(200,170,255,0.25)",
            }}
          >
            <div className="text-4xl mb-3" style={{ color: "#c8aaff" }}>
              ✦
            </div>
            <p
              className="text-base font-medium mb-1"
              style={{ color: "#e8d5f5" }}
            >
              创建你的第一个梦境
            </p>
            <p
              className="text-sm"
              style={{ color: "rgba(213,184,245,0.5)" }}
            >
              用文字编织一段属于你的故事
            </p>
          </button>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {games.map((game) => (
                <GameCard key={game.id} game={game} onDelete={handleDelete} />
              ))}

              {/* 新建按钮卡片 */}
              <button
                onClick={() => setShowCreateModal(true)}
                className="rounded-2xl p-5 transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_8px_40px_rgba(200,170,255,0.15)]"
                style={{
                  background: "rgba(200,170,255,0.03)",
                  border: "1px dashed rgba(200,170,255,0.2)",
                  minHeight: "160px",
                }}
              >
                <div className="flex flex-col items-center justify-center h-full">
                  <div
                    className="text-3xl mb-2"
                    style={{ color: "#c8aaff" }}
                  >
                    +
                  </div>
                  <span
                    className="text-sm"
                    style={{ color: "rgba(213,184,245,0.6)" }}
                  >
                    新建梦境
                  </span>
                </div>
              </button>
            </div>

            {/* 查看全部 */}
            {totalCount > PAGE_SIZE && !showAll && (
              <div className="mt-6 text-center">
                <button
                  onClick={() => setShowAll(true)}
                  className="px-6 py-2 rounded-full text-sm transition-all hover:bg-white/5"
                  style={{
                    color: "#c8aaff",
                    border: "1px solid rgba(200,170,255,0.2)",
                  }}
                >
                  查看全部 ({totalCount})
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* 创建游戏弹窗 */}
      <CreateGameModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreate}
      />
    </div>
  );
}

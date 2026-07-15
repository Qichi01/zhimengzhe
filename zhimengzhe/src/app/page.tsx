"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/stores/gameStore";
import { useUserStore } from "@/stores/userStore";

export default function Home() {
  const router = useRouter();
  const [setting, setSetting] = useState("");

  const startGame = useGameStore((s) => s.startGame);
  const freeTrialCount = useUserStore((s) => s.freeTrialCount);
  const isPremium = useUserStore((s) => s.isPremium);
  const apiKey = useUserStore((s) => s.apiKey);
  const canPlayUnlimited = useUserStore((s) => s.canPlayUnlimited);
  const decrementFreeTrial = useUserStore((s) => s.decrementFreeTrial);

  // 该标识依赖 zustand persist（localStorage）的值，服务端与客户端首帧可能不一致，
  // 通过 suppressHydrationWarning 静默处理水合差异。
  const unlimited = isPremium || apiKey !== "";
  const canStart = setting.trim().length > 0;

  const handleStart = () => {
    if (!canStart) return;

    // 不能无限玩且体验次数已用尽 → 前往付费页
    if (!canPlayUnlimited() && freeTrialCount <= 0) {
      router.push("/premium");
      return;
    }

    // 不能无限玩 → 扣减一次体验次数
    if (!canPlayUnlimited()) {
      decrementFreeTrial();
    }

    startGame(setting.trim());
    router.push("/play");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleStart();
    }
  };

  return (
    <div
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at 50% 32%, #2e2b4e 0%, #1e1b2e 55%, #14111e 100%)",
      }}
    >
      {/* 梦境光晕装饰 */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[680px] h-[680px] rounded-full blur-2xl"
        style={{
          background:
            "radial-gradient(circle, rgba(200,170,255,0.18) 0%, transparent 65%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-[-120px] right-[-80px] w-[420px] h-[420px] rounded-full blur-2xl"
        style={{
          background:
            "radial-gradient(circle, rgba(176,143,232,0.12) 0%, transparent 70%)",
        }}
      />

      {/* 右上角：设置入口 */}
      <Link
        href="/settings"
        aria-label="设置"
        className="absolute top-5 right-5 z-20 p-2.5 rounded-full transition-all duration-300 hover:bg-white/5"
        style={{ color: "#e8d5f5" }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </Link>

      {/* 剩余体验次数 / 无限畅玩标识 */}
      <div
        suppressHydrationWarning
        className="absolute top-5 left-5 z-20 px-3.5 py-1.5 rounded-full text-xs tracking-wide backdrop-blur-sm"
        style={{
          color: unlimited ? "#c8aaff" : "#d5b8f5",
          background: "rgba(200,170,255,0.08)",
          border: "1px solid rgba(200,170,255,0.2)",
        }}
      >
        {unlimited ? "无限畅玩" : `剩余体验 ${freeTrialCount} / 3`}
      </div>

      <main className="relative z-10 w-full max-w-2xl mx-auto px-6 flex flex-col items-center fade-in">
        {/* 产品名 + slogan */}
        <h1
          className="text-5xl sm:text-6xl font-bold tracking-[0.15em] mb-4"
          style={{
            color: "#e8d5f5",
            textShadow:
              "0 0 30px rgba(200,170,255,0.45), 0 0 70px rgba(200,170,255,0.25)",
          }}
        >
          织梦者
        </h1>
        <p
          className="text-base sm:text-lg tracking-[0.4em] mb-12"
          style={{ color: "#d5b8f5" }}
        >
          用文字编织梦境
        </p>

        {/* 故事设定输入框 */}
        <textarea
          value={setting}
          onChange={(e) => setSetting(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={6}
          placeholder="例如：你是一名失忆的公主，在梦中寻找记忆..."
          className="w-full resize-none rounded-2xl px-5 py-4 text-base leading-relaxed outline-none transition-all duration-300 [&::placeholder]:text-[#9d8bb8] [&::placeholder]:opacity-100 focus:border-[#c8aaff] focus:shadow-[0_0_28px_rgba(200,170,255,0.25)]"
          style={{
            color: "#e8d5f5",
            background: "rgba(200,170,255,0.06)",
            border: "1px solid rgba(200,170,255,0.22)",
          }}
        />

        {/* 开始按钮 */}
        <button
          onClick={handleStart}
          disabled={!canStart}
          className="mt-8 px-10 py-3.5 rounded-full text-base font-medium tracking-widest transition-all duration-300 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed enabled:hover:scale-[1.03] shadow-[0_0_28px_rgba(200,170,255,0.3)] enabled:hover:shadow-[0_0_45px_rgba(200,170,255,0.55)]"
          style={{
            background: "linear-gradient(135deg, #c8aaff 0%, #b08fe8 100%)",
            color: "#1e1b2e",
          }}
        >
          开始编织梦境
        </button>

        <p
          className="mt-4 text-xs tracking-wider"
          style={{ color: "rgba(213,184,245,0.5)" }}
        >
          按 ⌘ / Ctrl + Enter 快速开始
        </p>
      </main>

      {/* 底部：支持织梦者 */}
      <footer className="absolute bottom-6 z-10">
        <Link
          href="/premium"
          className="text-xs tracking-wide transition-opacity duration-300 hover:opacity-100"
          style={{ color: "rgba(213,184,245,0.45)" }}
        >
          支持织梦者
        </Link>
      </footer>
    </div>
  );
}

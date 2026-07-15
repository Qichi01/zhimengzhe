"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/stores/gameStore";
import { useUserStore } from "@/stores/userStore";
import StoryReader from "@/components/StoryReader";

function PlayContent() {
  const router = useRouter();
  const isPlaying = useGameStore((s) => s.isPlaying);
  const canPlayUnlimited = useUserStore((s) => s.canPlayUnlimited);
  const freeTrialCount = useUserStore((s) => s.freeTrialCount);
  const [mounted, setMounted] = useState(false);

  // 等待持久化 store 完成水合，避免 SSR/客户端状态不一致导致的 hydration mismatch。
  // 此处 setState in effect 是同步外部存储（localStorage 持久化）的正当用例。
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // 未在游戏中 -> 回首页
  useEffect(() => {
    if (!mounted) return;
    if (!isPlaying) {
      router.replace("/");
    }
  }, [mounted, isPlaying, router]);

  // 无游玩权限（非付费/无 API Key 且免费次数耗尽）-> 回首页
  useEffect(() => {
    if (!mounted) return;
    if (!canPlayUnlimited() && freeTrialCount <= 0) {
      router.replace("/");
    }
  }, [mounted, canPlayUnlimited, freeTrialCount, router]);

  // 等待水合或校验未通过时显示过渡态
  if (
    !mounted ||
    !isPlaying ||
    (!canPlayUnlimited() && freeTrialCount <= 0)
  ) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "radial-gradient(ellipse at 50% 40%, #2e2b4e 0%, #1e1b2e 70%)",
          color: "#c8aaff",
          fontStyle: "italic",
        }}
      >
        正在进入梦境...
      </div>
    );
  }

  return (
    <div style={{ position: "relative", minHeight: "100vh" }}>
      {/* 顶部半透明返回首页按钮 */}
      <button
        type="button"
        onClick={() => router.replace("/")}
        style={{
          position: "fixed",
          top: "16px",
          left: "16px",
          zIndex: 50,
          padding: "8px 14px",
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.15)",
          color: "#dddddd",
          borderRadius: "8px",
          cursor: "pointer",
          backdropFilter: "blur(6px)",
          fontSize: "14px",
        }}
      >
        ← 返回首页
      </button>

      <StoryReader onExit={() => router.replace("/")} />
    </div>
  );
}

export default function PlayPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "radial-gradient(ellipse at 50% 40%, #2e2b4e 0%, #1e1b2e 70%)",
            color: "#c8aaff",
          }}
        >
          加载中...
        </div>
      }
    >
      <PlayContent />
    </Suspense>
  );
}

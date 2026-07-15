"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUserStore } from "@/stores/userStore";
import { useGameStore } from "@/stores/gameStore";
import { themes } from "@/lib/themes";
import type { Theme, TypewriterSpeed } from "@/types";

const SPEED_OPTIONS: { value: TypewriterSpeed; label: string; desc: string }[] = [
  { value: "slow", label: "慢", desc: "沉浸品读" },
  { value: "medium", label: "中", desc: "节奏舒适" },
  { value: "fast", label: "快", desc: "畅快推进" },
];

// 卡片容器样式：半透明玻璃质感
const cardStyle: React.CSSProperties = {
  background: "rgba(200, 170, 255, 0.05)",
  border: "1px solid rgba(200, 170, 255, 0.15)",
  borderRadius: "20px",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
};

// 主题小预览
function ThemePreview({ theme }: { theme: Theme }) {
  return (
    <div
      className="h-20 w-full overflow-hidden rounded-lg"
      style={{ background: theme.bgGradient }}
    >
      <div className="flex h-full flex-col justify-center gap-1.5 p-3">
        <div
          className="h-1.5 w-2/3 rounded-full"
          style={{ background: theme.textSecondary, opacity: 0.75 }}
        />
        <div
          className="h-1.5 w-1/2 rounded-full"
          style={{ background: theme.textSecondary, opacity: 0.4 }}
        />
        <div
          className="mt-1 h-3 w-3/4 rounded"
          style={{
            background: theme.optionBg,
            border: `1px solid ${theme.optionBorder}`,
          }}
        />
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [mounted, setMounted] = useState(false);

  const apiKey = useUserStore((s) => s.apiKey);
  const themeId = useUserStore((s) => s.themeId);
  const typewriterSpeed = useUserStore((s) => s.typewriterSpeed);
  const setApiKey = useUserStore((s) => s.setApiKey);
  const setThemeId = useUserStore((s) => s.setThemeId);
  const setTypewriterSpeed = useUserStore((s) => s.setTypewriterSpeed);
  const resetGame = useGameStore((s) => s.resetGame);

  const [keyInput, setKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [confirm, setConfirm] = useState<null | "game" | "settings">(null);
  const [toast, setToast] = useState("");

  useEffect(() => setMounted(true), []);

  // 挂载后将输入框与已保存的 key 同步
  useEffect(() => {
    if (mounted) setKeyInput(apiKey);
  }, [mounted, apiKey]);

  const isKeyConfigured = mounted && apiKey.trim() !== "";
  // 渲染时用默认值避免 SSR/CSR 水合不一致
  const themeIdDisplay = mounted ? themeId : "dream-light";
  const speedDisplay = mounted ? typewriterSpeed : "medium";

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 2200);
  };

  const handleSaveKey = () => {
    setApiKey(keyInput.trim());
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1800);
    showToast("API Key 已保存");
  };

  const handleClearGame = () => {
    resetGame();
    setConfirm(null);
    showToast("游戏进度已清空");
  };

  const handleResetAll = () => {
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
    // 清空 localStorage 后刷新页面，让 zustand 重新以默认值初始化
    window.location.reload();
  };

  return (
    <div
      className="min-h-screen w-full"
      style={{
        background:
          "radial-gradient(ellipse at 50% 0%, #2e2b4e 0%, #1e1b2e 60%, #14111f 100%)",
        color: "#e8d5f5",
      }}
    >
      <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:px-8 sm:py-14">
        {/* 顶部标题 + 返回首页 */}
        <header className="mb-10 flex items-center justify-between">
          <Link
            href="/"
            className="group inline-flex items-center gap-1.5 text-sm transition-opacity hover:opacity-100"
            style={{ color: "#c8aaff" }}
          >
            <span className="transition-transform group-hover:-translate-x-0.5">
              ←
            </span>
            返回首页
          </Link>
          <h1
            className="text-2xl font-semibold tracking-wide sm:text-3xl"
            style={{ color: "#e8d5f5" }}
          >
            设置
          </h1>
        </header>

        {/* 卡片 1: API Key 配置 */}
        <section className="mb-6 p-6" style={cardStyle}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold" style={{ color: "#e8d5f5" }}>
              DeepSeek API Key
            </h2>
            {isKeyConfigured ? (
              <span
                className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium"
                style={{
                  background: "rgba(120, 220, 170, 0.12)",
                  border: "1px solid rgba(120, 220, 170, 0.4)",
                  color: "#9fe8c4",
                }}
              >
                ● 已配置
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium"
                style={{
                  background: "rgba(200, 170, 255, 0.08)",
                  border: "1px solid rgba(200, 170, 255, 0.25)",
                  color: "#d5b8f5",
                }}
              >
                未配置
              </span>
            )}
          </div>

          <p
            className="mb-4 text-sm leading-relaxed"
            style={{ color: "#c9b3e0" }}
          >
            填入你的 DeepSeek API Key 即可无限畅玩，无需付费。Key 仅保存在你的浏览器本地。
          </p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div
              className="relative flex-1"
              style={{
                background: "rgba(0, 0, 0, 0.25)",
                border: "1px solid rgba(200, 170, 255, 0.2)",
                borderRadius: "12px",
              }}
            >
              <input
                type={showKey ? "text" : "password"}
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
                spellCheck={false}
                autoComplete="off"
                className="w-full bg-transparent px-4 py-3 pr-12 text-sm outline-none placeholder:text-[#6b5d85] focus:ring-0"
                style={{ color: "#e8d5f5" }}
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs transition-colors hover:bg-white/5"
                style={{ color: "#c8aaff" }}
                aria-label={showKey ? "隐藏 Key" : "显示 Key"}
              >
                {showKey ? "隐藏" : "显示"}
              </button>
            </div>

            <button
              type="button"
              onClick={handleSaveKey}
              className="rounded-xl px-6 py-3 text-sm font-semibold transition-transform hover:scale-[1.03] active:scale-95"
              style={{
                background: "linear-gradient(135deg, #c8aaff 0%, #9d6cf5 100%)",
                color: "#1a1530",
                boxShadow: "0 6px 20px rgba(157, 108, 245, 0.35)",
              }}
            >
              {savedFlash ? "已保存 ✓" : "保存"}
            </button>
          </div>

          <a
            href="https://platform.deepseek.com/api_keys"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1 text-xs transition-opacity hover:opacity-80"
            style={{ color: "#c8aaff" }}
          >
            获取你的 DeepSeek API Key ↗
          </a>
        </section>

        {/* 卡片 2: 主题切换 */}
        <section className="mb-6 p-6" style={cardStyle}>
          <h2 className="mb-1 text-lg font-semibold" style={{ color: "#e8d5f5" }}>
            阅读主题
          </h2>
          <p
            className="mb-4 text-sm leading-relaxed"
            style={{ color: "#c9b3e0" }}
          >
            选择你喜欢的阅读氛围，每个主题都有独特的色调与质感。
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Object.values(themes).map((theme) => {
              const selected = theme.id === themeIdDisplay;
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => setThemeId(theme.id)}
                  className="rounded-2xl p-3 text-left transition-all hover:scale-[1.02]"
                  style={{
                    background: "rgba(0, 0, 0, 0.2)",
                    border: selected
                      ? "2px solid #c8aaff"
                      : "2px solid rgba(200, 170, 255, 0.15)",
                    boxShadow: selected
                      ? "0 0 24px rgba(200, 170, 255, 0.35)"
                      : "none",
                  }}
                >
                  <ThemePreview theme={theme} />
                  <div className="mt-3 flex items-center justify-between">
                    <span
                      className="text-sm font-medium"
                      style={{ color: theme.textPrimary }}
                    >
                      {theme.name}
                    </span>
                    {selected && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{
                          background: "rgba(200, 170, 255, 0.18)",
                          color: "#e8d5f5",
                        }}
                      >
                        当前
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* 卡片 3: 阅读体验 */}
        <section className="mb-6 p-6" style={cardStyle}>
          <h2 className="mb-1 text-lg font-semibold" style={{ color: "#e8d5f5" }}>
            阅读体验
          </h2>
          <p
            className="mb-4 text-sm leading-relaxed"
            style={{ color: "#c9b3e0" }}
          >
            调整场景文字的打字机播放速度。
          </p>

          <div className="grid grid-cols-3 gap-3">
            {SPEED_OPTIONS.map((opt) => {
              const selected = opt.value === speedDisplay;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTypewriterSpeed(opt.value)}
                  className="flex flex-col items-center gap-1 rounded-xl px-3 py-4 transition-all hover:scale-[1.03]"
                  style={{
                    background: selected
                      ? "linear-gradient(135deg, rgba(200,170,255,0.22) 0%, rgba(157,108,245,0.18) 100%)"
                      : "rgba(0, 0, 0, 0.2)",
                    border: selected
                      ? "1px solid #c8aaff"
                      : "1px solid rgba(200, 170, 255, 0.15)",
                    boxShadow: selected
                      ? "0 0 18px rgba(200, 170, 255, 0.3)"
                      : "none",
                  }}
                >
                  <span
                    className="text-lg font-semibold"
                    style={{ color: selected ? "#e8d5f5" : "#c9b3e0" }}
                  >
                    {opt.label}
                  </span>
                  <span
                    className="text-[11px]"
                    style={{ color: selected ? "#d5b8f5" : "#8a7aa8" }}
                  >
                    {opt.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* 卡片 4: 危险区域 / 数据管理 */}
        <section
          className="p-6"
          style={{
            background: "rgba(255, 120, 130, 0.04)",
            border: "1px solid rgba(255, 150, 160, 0.18)",
            borderRadius: "20px",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
        >
          <h2 className="mb-1 text-lg font-semibold" style={{ color: "#f5b8b8" }}>
            数据管理
          </h2>
          <p
            className="mb-4 text-sm leading-relaxed"
            style={{ color: "#c9a0a8" }}
          >
            这些操作不可撤销，请谨慎执行。
          </p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => setConfirm("game")}
              className="flex-1 rounded-xl px-5 py-3 text-sm font-medium transition-all hover:scale-[1.02]"
              style={{
                background: "rgba(255, 150, 160, 0.1)",
                border: "1px solid rgba(255, 150, 160, 0.3)",
                color: "#f5b8b8",
              }}
            >
              清空游戏进度
            </button>
            <button
              type="button"
              onClick={() => setConfirm("settings")}
              className="flex-1 rounded-xl px-5 py-3 text-sm font-medium transition-all hover:scale-[1.02]"
              style={{
                background: "rgba(255, 150, 160, 0.1)",
                border: "1px solid rgba(255, 150, 160, 0.3)",
                color: "#f5b8b8",
              }}
            >
              重置所有设置
            </button>
          </div>
        </section>

        <footer
          className="mt-10 text-center text-xs"
          style={{ color: "#6b5d85" }}
        >
          织梦者 · 你的 API Key 与设置仅存储于本地浏览器
        </footer>
      </div>

      {/* 确认弹窗 */}
      {confirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-5"
          style={{ background: "rgba(10, 8, 18, 0.7)", backdropFilter: "blur(4px)" }}
          onClick={() => setConfirm(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-6"
            style={{
              background: "linear-gradient(160deg, #2a2540 0%, #1e1b2e 100%)",
              border: "1px solid rgba(255, 150, 160, 0.3)",
              boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              className="mb-2 text-lg font-semibold"
              style={{ color: "#f5b8b8" }}
            >
              {confirm === "game" ? "清空游戏进度？" : "重置所有设置？"}
            </h3>
            <p className="mb-5 text-sm leading-relaxed" style={{ color: "#c9b3e0" }}>
              {confirm === "game"
                ? "这将清除当前的故事历史与场景记录，无法恢复。你的 API Key 与设置不受影响。"
                : "这将清除所有设置（API Key、主题、付费状态等）并恢复默认值。此操作无法撤销。"}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirm(null)}
                className="flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors hover:bg-white/5"
                style={{
                  border: "1px solid rgba(200, 170, 255, 0.2)",
                  color: "#c9b3e0",
                }}
              >
                取消
              </button>
              <button
                type="button"
                onClick={confirm === "game" ? handleClearGame : handleResetAll}
                className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition-transform hover:scale-[1.03]"
                style={{
                  background: "linear-gradient(135deg, #ff8a8a 0%, #e0405a 100%)",
                  color: "#fff",
                }}
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 轻提示 toast */}
      {toast && (
        <div className="pointer-events-none fixed bottom-8 left-1/2 z-50 -translate-x-1/2">
          <div
            className="rounded-full px-5 py-2.5 text-sm font-medium"
            style={{
              background: "rgba(40, 35, 60, 0.92)",
              border: "1px solid rgba(200, 170, 255, 0.3)",
              color: "#e8d5f5",
              boxShadow: "0 8px 28px rgba(0, 0, 0, 0.4)",
            }}
          >
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}

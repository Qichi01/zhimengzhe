"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/stores/userStore";
import { useAuthStore } from "@/stores/authStore";
import { useGameStore } from "@/stores/gameStore";
import { themes } from "@/lib/themes";
import { validateAndApplyRedeemCode } from "@/lib/localDb";
import { PROVIDER_LIST, getProvider, getDefaultModel, type ProviderId } from "@/lib/providers";
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

export default function SettingsContent() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  const apiKey = useUserStore((s) => s.apiKey);
  const providerId = useUserStore((s) => s.providerId);
  const modelId = useUserStore((s) => s.modelId);
  const themeId = useUserStore((s) => s.themeId);
  const typewriterSpeed = useUserStore((s) => s.typewriterSpeed);
  const setApiKey = useUserStore((s) => s.setApiKey);
  const setProviderId = useUserStore((s) => s.setProviderId);
  const setModelId = useUserStore((s) => s.setModelId);
  const setThemeId = useUserStore((s) => s.setThemeId);
  const setTypewriterSpeed = useUserStore((s) => s.setTypewriterSpeed);
  const isPremium = useUserStore((s) => s.isPremium);
  const membershipPlan = useUserStore((s) => s.membershipPlan);
  const membershipExpiresAt = useUserStore((s) => s.membershipExpiresAt);
  const remainingFreeTrials = useUserStore((s) => s.remainingFreeTrials);
  const syncLocalProfile = useUserStore((s) => s.syncLocalProfile);
  const resetGame = useGameStore((s) => s.resetGame);

  const { user, signOut } = useAuthStore();

  const [keyInput, setKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [confirm, setConfirm] = useState<null | "game" | "settings">(null);
  const [toast, setToast] = useState("");

  // 兑换码
  const [redeemCode, setRedeemCode] = useState("");
  const [redeemLoading, setRedeemLoading] = useState(false);

  // 当前选中的 provider 和 model（本地状态，保存时写入 store）
  const [selectedProvider, setSelectedProvider] = useState<ProviderId>("deepseek");
  const [selectedModel, setSelectedModel] = useState("deepseek-chat");

  useEffect(() => setMounted(true), []);

  // 挂载后同步本地 profile + API Key 输入框 + provider/model
  useEffect(() => {
    if (mounted) {
      try {
        setKeyInput(apiKey);
        setSelectedProvider(providerId);
        setSelectedModel(modelId);
        syncLocalProfile();
      } catch {
        // 防止 syncLocalProfile 中的错误导致页面崩溃
      }
    }
  }, [mounted, apiKey, providerId, modelId, syncLocalProfile]);

  // 切换 provider 时自动选中该 provider 的默认模型
  const handleProviderChange = (id: ProviderId) => {
    setSelectedProvider(id);
    const defaultModel = getDefaultModel(id);
    setSelectedModel(defaultModel.id);
  };

  const isKeyConfigured = mounted && apiKey.trim() !== "";

  // 安全调用 isPremium（防止 store 状态异常导致崩溃）
  const safeIsPremium = (): boolean => {
    if (!mounted) return false;
    try {
      return isPremium();
    } catch {
      return false;
    }
  };

  // 安全调用 remainingFreeTrials（GLM-4-Flash 永久免费，不再有次数限制）
  const safeRemainingFreeTrials = (): number => {
    return Infinity;
  };

  const themeIdDisplay = mounted ? themeId : "dream-light";
  const speedDisplay = mounted ? typewriterSpeed : "medium";
  const premiumActive = safeIsPremium();

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 2200);
  };

  const handleSaveKey = () => {
    setApiKey(keyInput.trim());
    setProviderId(selectedProvider);
    setModelId(selectedModel);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1800);
    showToast("API 配置已保存");
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

  // 兑换码兑换
  const handleRedeem = async () => {
    if (!redeemCode.trim()) return;
    setRedeemLoading(true);

    try {
      const result = validateAndApplyRedeemCode(redeemCode);

      if (result.ok) {
        syncLocalProfile();
        showToast("兑换成功，会员已激活 ✓");
        setRedeemCode("");
      } else {
        showToast(result.error ?? "兑换失败");
      }
    } catch {
      showToast("兑换失败，请重试");
    }

    setRedeemLoading(false);
  };

  // 登出
  const handleSignOut = async () => {
    try {
      await signOut();
    } catch {
      /* ignore */
    }
    showToast("已登出");
    router.push("/");
  };

  // 安全格式化日期
  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return "";
    try {
      return new Date(dateStr).toLocaleDateString("zh-CN");
    } catch {
      return "";
    }
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

        {/* 卡片 1: API 配置（支持多家大模型） */}
        <section className="mb-6 p-6" style={cardStyle}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold" style={{ color: "#e8d5f5" }}>
              AI 模型配置
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
            支持国内外主流大模型 API，选择你喜欢的提供商并填入 Key 即可无限畅玩。Key 仅保存在你的浏览器本地。
          </p>

          {/* Provider 选择器 */}
          <div className="mb-4">
            <label
              className="mb-2 block text-xs font-medium"
              style={{ color: "#c9b3e0" }}
            >
              AI 提供商
            </label>
            <div
              className="grid grid-cols-2 gap-2 sm:grid-cols-3"
              data-provider-grid
            >
              {PROVIDER_LIST.map((p) => {
                const selected = mounted && selectedProvider === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleProviderChange(p.id)}
                    className="flex flex-col items-start gap-0.5 rounded-xl px-3 py-2.5 text-left transition-all hover:scale-[1.02]"
                    style={{
                      background: selected
                        ? "linear-gradient(135deg, rgba(200,170,255,0.22) 0%, rgba(157,108,245,0.18) 100%)"
                        : "rgba(0, 0, 0, 0.2)",
                      border: selected
                        ? "1px solid #c8aaff"
                        : "1px solid rgba(200, 170, 255, 0.15)",
                      boxShadow: selected
                        ? "0 0 16px rgba(200, 170, 255, 0.28)"
                        : "none",
                    }}
                  >
                    <span
                      className="text-sm font-medium"
                      style={{ color: selected ? "#e8d5f5" : "#c9b3e0" }}
                    >
                      {p.label}
                    </span>
                    <span
                      className="text-[10px] leading-tight"
                      style={{ color: selected ? "#d5b8f5" : "#8a7aa8" }}
                    >
                      {p.description}
                    </span>
                    {p.isChinese && (
                      <span
                        className="mt-0.5 rounded px-1 py-0.5 text-[9px] font-medium"
                        style={{
                          background: "rgba(255, 200, 100, 0.12)",
                          color: "#ffd599",
                        }}
                      >
                        国内可直连
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Model 选择器 */}
          {mounted && (
            <div className="mb-4">
              <label
                className="mb-2 block text-xs font-medium"
                style={{ color: "#c9b3e0" }}
              >
                模型
              </label>
              <div
                className="flex flex-wrap gap-2"
                data-model-list
              >
                {getProvider(selectedProvider).models.map((m) => {
                  const selected = selectedModel === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedModel(m.id)}
                      className="rounded-lg px-3 py-2 text-xs font-medium transition-all hover:scale-[1.03]"
                      style={{
                        background: selected
                          ? "linear-gradient(135deg, rgba(200,170,255,0.18) 0%, rgba(157,108,245,0.14) 100%)"
                          : "rgba(0, 0, 0, 0.2)",
                        border: selected
                          ? "1px solid #c8aaff"
                          : "1px solid rgba(200, 170, 255, 0.12)",
                        color: selected ? "#e8d5f5" : "#c9b3e0",
                      }}
                    >
                      {m.label}
                      {m.recommended && (
                        <span
                          className="ml-1.5 rounded px-1 py-0.5 text-[9px]"
                          style={{
                            background: "rgba(120, 220, 170, 0.15)",
                            color: "#9fe8c4",
                          }}
                        >
                          推荐
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-[11px]" style={{ color: "#8a7aa8" }}>
                上下文窗口：{((getProvider(selectedProvider).models.find((m) => m.id === selectedModel)?.contextWindow ?? 0) / 1000).toFixed(0)}K tokens
              </p>
            </div>
          )}

          {/* API Key 输入 */}
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
                placeholder={`${getProvider(selectedProvider).keyPrefix || "sk-"}xxxxxxxxxxxxxxxxxxxxxxxx`}
                spellCheck={false}
                autoComplete="off"
                className="w-full bg-transparent px-4 py-3 pr-12 text-base outline-none placeholder:text-[#6b5d85] focus:ring-0"
                style={{ color: "#e8d5f5", fontSize: "16px" }}
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
            href={getProvider(selectedProvider).apiKeyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1 text-xs transition-opacity hover:opacity-80"
            style={{ color: "#c8aaff" }}
          >
            获取你的 {getProvider(selectedProvider).label} API Key ↗
          </a>

          {/* 分隔线 */}
          <div
            className="my-5"
            style={{
              borderTop: "1px solid rgba(200, 170, 255, 0.1)",
            }}
          />

          {/* 会员状态 */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium" style={{ color: "#e8d5f5" }}>
                {premiumActive ? (
                  <>
                    会员生效中
                    <span className="ml-2 text-xs" style={{ color: "#9fe8c4" }}>
                      {membershipPlan === "monthly" ? "月卡" : "季卡"}
                      {membershipExpiresAt && (
                        <span className="ml-1" style={{ color: "#8a7aa8" }}>
                          · 至 {formatDate(membershipExpiresAt)}
                        </span>
                      )}
                    </span>
                  </>
                ) : isKeyConfigured ? (
                  <span style={{ color: "#c8aaff" }}>让我们提供 AI 服务</span>
                ) : (
                  <>
                    <span style={{ color: "#9fe8c4" }}>免费畅玩</span>
                    <span className="ml-2 text-xs" style={{ color: "#8a7aa8" }}>
                      GLM-4-Flash 驱动 · 不限次数
                    </span>
                  </>
                )}
              </p>
              {!isKeyConfigured && !premiumActive && (
                <p className="mt-1 text-xs" style={{ color: "#8a7aa8" }}>
                  不想自己配置 API？
                  <Link
                    href="/membership"
                    className="ml-1 underline transition-opacity hover:opacity-80"
                    style={{ color: "#c8aaff" }}
                  >
                    开通会员
                  </Link>
                  或输入兑换码即可无限畅玩
                </p>
              )}
              {(isKeyConfigured || premiumActive) && (
                <p className="mt-1 text-xs">
                  <Link
                    href="/membership"
                    className="underline transition-opacity hover:opacity-80"
                    style={{ color: "#c8aaff" }}
                  >
                    会员计划 →
                  </Link>
                </p>
              )}
            </div>
          </div>

          {/* 兑换码输入 */}
          <div
            className="mt-5"
            style={{
              borderTop: "1px solid rgba(200, 170, 255, 0.1)",
            }}
          />
          <div className="mt-4">
            <p className="mb-2 text-sm font-medium" style={{ color: "#e8d5f5" }}>
              兑换码
            </p>
            <p className="mb-3 text-xs" style={{ color: "#8a7aa8" }}>
              输入你的兑换码即可激活会员，无需登录。
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
                  type="text"
                  value={redeemCode}
                  onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  spellCheck={false}
                  autoComplete="off"
                  className="w-full bg-transparent px-4 py-3 text-base outline-none placeholder:text-[#6b5d85] focus:ring-0"
                  style={{ color: "#e8d5f5", fontSize: "16px" }}
                />
              </div>
              <button
                type="button"
                onClick={handleRedeem}
                disabled={redeemLoading || !redeemCode.trim()}
                className="rounded-xl px-6 py-3 text-sm font-semibold transition-transform hover:scale-[1.03] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: "linear-gradient(135deg, #c8aaff 0%, #9d6cf5 100%)",
                  color: "#1a1530",
                  boxShadow: "0 6px 20px rgba(157, 108, 245, 0.35)",
                }}
              >
                {redeemLoading ? "兑换中..." : "兑换"}
              </button>
            </div>
          </div>
        </section>

        {/* 卡片 2: 账户管理（仅已登录时显示，用于登出） */}
        {user && (
        <section className="mb-6 p-6" style={cardStyle}>
          <h2 className="mb-1 text-lg font-semibold" style={{ color: "#e8d5f5" }}>
            账户
          </h2>
          <p
            className="mb-4 text-sm leading-relaxed"
            style={{ color: "#c9b3e0" }}
          >
            登录后可将数据同步到云端，换设备也能继续游玩。
          </p>

            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium" style={{ color: "#e8d5f5" }}>
                  {user.email}
                </p>
                <p className="mt-0.5 text-xs" style={{ color: "#9fe8c4" }}>
                  已登录
                </p>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-xl px-4 py-2 text-xs font-medium transition-all hover:scale-[1.03] active:scale-95"
                style={{
                  background: "rgba(255, 150, 160, 0.1)",
                  border: "1px solid rgba(255, 150, 160, 0.3)",
                  color: "#f5b8b8",
                }}
              >
                登出
              </button>
            </div>
        </section>
        )}

        {/* 卡片 3: 主题切换 */}
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

        {/* 卡片 4: 阅读体验 */}
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

        {/* 卡片 5: 危险区域 / 数据管理 */}
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

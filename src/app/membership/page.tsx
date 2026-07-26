"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { useUserStore, MAX_FREE_TRIALS } from "@/stores/userStore";
import { track } from "@/lib/analytics";

const PLANS = [
  {
    id: "monthly" as const,
    name: "月卡",
    price: "9.9",
    unit: "元/月",
    benefits: [
      "无限畅玩，不限次数",
      "系统代付 API 费用",
      "使用 DeepSeek 模型",
    ],
    cta: "开通月卡",
  },
];

export default function MembershipPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const apiKey = useUserStore((s) => s.apiKey);
  const membershipPlan = useUserStore((s) => s.membershipPlan);
  const membershipExpiresAt = useUserStore((s) => s.membershipExpiresAt);
  const isPremium = useUserStore((s) => s.isPremium);
  const remainingFreeTrials = useUserStore((s) => s.remainingFreeTrials);
  const setPremiumToken = useUserStore((s) => s.setPremiumToken);
  const activateMembership = useUserStore((s) => s.activateMembership);

  const [mounted, setMounted] = useState(false);
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [activating, setActivating] = useState(false);

  useEffect(() => setMounted(true), []);

  const premium = mounted ? isPremium() : false;
  const remaining = mounted ? remainingFreeTrials() : MAX_FREE_TRIALS;
  const hasOwnKey = mounted && apiKey !== "";

  const handleActivate = async (plan: "monthly" | "quarterly") => {
    if (!user) return;
    setActivating(true);
    setError("");
    const { error } = await activateMembership(user.id, plan);
    setActivating(false);

    if (error) {
      setError(error);
    } else {
      setSuccess(true);
      track("complete_payment", { plan });
      setTimeout(() => router.push("/"), 1500);
    }
  };

  const handleTokenSubmit = async () => {
    const t = token.trim();
    if (!t) {
      setError("请输入验证码");
      return;
    }
    if (!user) {
      setError("账号系统即将上线，请前往「设置」使用兑换码激活");
      return;
    }

    setError("");
    setPremiumToken(t);

    // V2.1 仍用手动验证：任何非空 token 视为月卡激活
    // V2.2 将接入爱发电 Webhook 自动校验
    setActivating(true);
    const { error } = await activateMembership(user.id, "monthly");
    setActivating(false);

    if (error) {
      setError(error);
    } else {
      setSuccess(true);
      track("complete_payment", { plan: "monthly", via: "token" });
      setTimeout(() => router.push("/"), 1500);
    }
  };

  return (
    <div
      className="relative min-h-screen w-full overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at 50% -10%, #3a2a5e 0%, #1e1b2e 55%, #100d1c 100%)",
        color: "#e8d5f5",
      }}
    >
      {/* 顶部光晕 */}
      <div
        className="pointer-events-none absolute left-1/2 top-[-160px] h-[420px] w-[640px] -translate-x-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(200,170,255,0.18) 0%, rgba(157,108,245,0.06) 40%, transparent 70%)",
          filter: "blur(20px)",
        }}
      />

      <div className="relative mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        {/* 顶部导航 */}
        <header className="mb-10 flex items-center justify-between">
          <Link
            href="/"
            className="group inline-flex items-center gap-1.5 text-sm transition-opacity hover:opacity-100"
            style={{ color: "#c8aaff" }}
          >
            <span className="transition-transform group-hover:-translate-x-0.5">←</span>
            返回
          </Link>
          <h1
            className="text-2xl font-semibold tracking-wide sm:text-3xl"
            style={{ color: "#e8d5f5" }}
          >
            会员计划
          </h1>
        </header>

        {/* 当前状态 */}
        {mounted && (
          <div
            className="mb-8 rounded-2xl p-5"
            style={{
              background: "rgba(200,170,255,0.04)",
              border: "1px solid rgba(200,170,255,0.12)",
            }}
          >
            <p className="text-sm" style={{ color: "#c9b3e0" }}>
              {premium ? (
                <>
                  <span style={{ color: "#9fe8c4" }}>● 会员生效中</span>
                  {membershipPlan === "monthly" ? "（月卡）" : "（季卡）"}
                  {membershipExpiresAt && (
                    <span className="ml-2 text-xs" style={{ color: "#8a7aa8" }}>
                      至 {new Date(membershipExpiresAt).toLocaleDateString("zh-CN")}
                    </span>
                  )}
                </>
              ) : hasOwnKey ? (
                <>
                  <span style={{ color: "#c8aaff" }}>● 使用自有 API Key</span>
                  <span className="ml-2 text-xs" style={{ color: "#8a7aa8" }}>
                    可无限畅玩
                  </span>
                </>
              ) : (
                <>
                  <span style={{ color: "#d5b8f5" }}>● 免费体验中</span>
                  <span className="ml-2 text-xs" style={{ color: "#8a7aa8" }}>
                    剩余 {remaining}/{MAX_FREE_TRIALS} 轮
                  </span>
                </>
              )}
            </p>
          </div>
        )}

        {/* 说明文案 */}
        <p
          className="mb-8 text-center text-sm leading-relaxed"
          style={{ color: "#c9b3e0" }}
        >
          适合不想自己配置 API 的小伙伴
        </p>

        {/* 定价卡片 */}
        <div className="mb-8 mx-auto max-w-md">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className="relative flex flex-col overflow-hidden rounded-3xl p-7"
              style={{
                background:
                  "linear-gradient(160deg, rgba(200,170,255,0.1) 0%, rgba(157,108,245,0.05) 50%, rgba(30,27,46,0.5) 100%)",
                border: "1px solid rgba(200,170,255,0.2)",
                boxShadow: "0 12px 40px rgba(120, 80, 200, 0.15)",
              }}
            >
              <div className="mb-4">
                <h3 className="text-lg font-semibold" style={{ color: "#e8d5f5" }}>
                  {plan.name}
                </h3>
              </div>

              <div className="mb-1 flex items-end gap-1">
                <span
                  className="text-4xl font-bold tracking-tight"
                  style={{
                    background: "linear-gradient(135deg, #ffffff 0%, #c8aaff 100%)",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  ¥{plan.price}
                </span>
                <span className="mb-1.5 text-sm" style={{ color: "#d5b8f5" }}>
                  {plan.unit}
                </span>
              </div>

              <ul className="mb-6 flex flex-1 flex-col gap-2.5">
                {plan.benefits.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-sm">
                    <span
                      className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-[10px]"
                      style={{
                        background: "linear-gradient(135deg, #c8aaff, #9d6cf5)",
                        color: "#1a1530",
                        fontWeight: 700,
                      }}
                    >
                      ✓
                    </span>
                    <span style={{ color: "#e8d5f5" }}>{b}</span>
                  </li>
                ))}
              </ul>

              <a
                href="https://afdian.com/a/baibai521520"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => track("click_subscribe", { plan: plan.id })}
                className="block w-full rounded-2xl px-6 py-3.5 text-center text-sm font-semibold transition-transform hover:scale-[1.02] active:scale-95"
                style={{
                  background: "linear-gradient(135deg, #c8aaff 0%, #9d6cf5 100%)",
                  color: "#1a1530",
                  boxShadow: "0 8px 28px rgba(157, 108, 245, 0.3)",
                }}
              >
                {plan.cta}
              </a>
            </div>
          ))}
        </div>

        {/* 爱发电说明 */}
        <div
          className="mb-8 rounded-2xl p-5 text-center"
          style={{
            background: "rgba(200,170,255,0.03)",
            border: "1px solid rgba(200,170,255,0.1)",
          }}
        >
          <p className="text-xs leading-relaxed" style={{ color: "#8a7aa8" }}>
            点击上方按钮前往爱发电完成支付，支付后在感谢消息中会收到验证码。
            <br />
            回到此页面输入验证码即可激活会员。
          </p>
        </div>

        {/* 验证码输入 */}
        <section
          className="mb-8 rounded-2xl p-6"
          style={{
            background: "rgba(200,170,255,0.04)",
            border: "1px solid rgba(200,170,255,0.12)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
        >
          <h2 className="mb-2 text-base font-semibold" style={{ color: "#e8d5f5" }}>
            已支付？输入验证码
          </h2>
          <p className="mb-5 text-sm" style={{ color: "#c9b3e0" }}>
            输入爱发电感谢消息中的验证码，激活会员权益。
          </p>

          {premium && !success ? (
            <div
              className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium"
              style={{
                background: "rgba(120, 220, 170, 0.08)",
                border: "1px solid rgba(120, 220, 170, 0.3)",
                color: "#9fe8c4",
              }}
            >
              ● 你已是会员，无需重复激活
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row">
              <div
                className="relative flex-1"
                style={{
                  background: "rgba(0, 0, 0, 0.25)",
                  border: error
                    ? "1px solid rgba(255, 150, 160, 0.5)"
                    : "1px solid rgba(200, 170, 255, 0.2)",
                  borderRadius: "12px",
                }}
              >
                <input
                  type="text"
                  value={token}
                  onChange={(e) => {
                    setToken(e.target.value);
                    if (error) setError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleTokenSubmit();
                  }}
                  placeholder="输入验证码"
                  spellCheck={false}
                  autoComplete="off"
                  className="w-full bg-transparent px-4 py-3 text-sm outline-none placeholder:text-[#6b5d85]"
                  style={{ color: "#e8d5f5" }}
                  disabled={success || activating}
                />
              </div>

              <button
                type="button"
                onClick={handleTokenSubmit}
                disabled={success || activating}
                className="rounded-xl px-6 py-3 text-sm font-semibold transition-transform hover:scale-[1.03] active:scale-95 disabled:cursor-not-allowed disabled:opacity-70"
                style={{
                  background: success
                    ? "linear-gradient(135deg, #78dcae 0%, #4caf86 100%)"
                    : "linear-gradient(135deg, #c8aaff 0%, #9d6cf5 100%)",
                  color: "#1a1530",
                  boxShadow: success
                    ? "0 6px 20px rgba(120, 220, 170, 0.35)"
                    : "0 6px 20px rgba(157, 108, 245, 0.35)",
                }}
              >
                {success ? "激活成功 ✓" : activating ? "激活中..." : "激活"}
              </button>
            </div>
          )}

          {error && (
            <p className="mt-2 text-xs" style={{ color: "#f5a0a8" }}>
              {error}
            </p>
          )}
          {success && (
            <p className="mt-3 text-sm" style={{ color: "#9fe8c4" }}>
              激活成功！正在为你返回首页…
            </p>
          )}
        </section>

        {/* BYOK 替代方案 */}
        <section
          className="rounded-2xl p-6"
          style={{
            background: "rgba(200,170,255,0.03)",
            border: "1px solid rgba(200,170,255,0.1)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
        >
          <h2 className="mb-2 text-base font-semibold" style={{ color: "#e8d5f5" }}>
            或使用自己的 API Key
          </h2>
          <p className="mb-5 text-sm" style={{ color: "#c9b3e0" }}>
            如果你有自己的 API Key（支持 DeepSeek、OpenAI、Claude 等），填入即可永久免费使用织梦者。
          </p>
          <Link
            href="/settings"
            className="inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-medium transition-transform hover:scale-[1.03] active:scale-95"
            style={{
              background: "rgba(200,170,255,0.1)",
              border: "1px solid rgba(200,170,255,0.3)",
              color: "#e8d5f5",
            }}
          >
            前往设置 →
          </Link>
        </section>

        <footer
          className="mt-10 text-center text-xs"
          style={{ color: "#6b5d85" }}
        >
          织梦者 · 让每一个故事都能被讲述
        </footer>
      </div>
    </div>
  );
}

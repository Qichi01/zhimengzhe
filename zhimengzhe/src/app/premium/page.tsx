"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/stores/userStore";

const BENEFITS: string[] = [
  "无限畅玩，不限次数",
  "使用系统提供的 API Key，无需自备",
  "优先体验新功能",
  "支持织梦者持续开发",
];

export default function PremiumPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  const isPremium = useUserStore((s) => s.isPremium);
  const setPremiumToken = useUserStore((s) => s.setPremiumToken);
  const setPremium = useUserStore((s) => s.setPremium);

  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => setMounted(true), []);

  const isAlreadyPremium = mounted && isPremium;

  const handleUnlock = () => {
    const t = token.trim();
    if (!t) {
      setError("请输入验证码");
      return;
    }
    setError("");
    setPremiumToken(t);
    setPremium(true);
    setSuccess(true);
    // V1 不做真正的校验，任何非空输入即解锁
    window.setTimeout(() => {
      router.push("/");
    }, 1200);
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
      {/* 顶部高光光晕 */}
      <div
        className="pointer-events-none absolute left-1/2 top-[-160px] h-[420px] w-[640px] -translate-x-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(200,170,255,0.28) 0%, rgba(157,108,245,0.12) 40%, transparent 70%)",
          filter: "blur(20px)",
        }}
      />

      <div className="relative mx-auto w-full max-w-2xl px-5 py-10 sm:px-8 sm:py-14">
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
            支持织梦者
          </h1>
        </header>

        {/* 区域 1: 付费方案大卡片 */}
        <section
          className="relative mb-8 overflow-hidden rounded-3xl p-8 text-center"
          style={{
            background:
              "linear-gradient(160deg, rgba(200,170,255,0.12) 0%, rgba(157,108,245,0.06) 50%, rgba(30,27,46,0.6) 100%)",
            border: "1px solid rgba(200,170,255,0.25)",
            boxShadow:
              "0 24px 80px rgba(120, 80, 200, 0.25), inset 0 1px 0 rgba(255,255,255,0.08)",
          }}
        >
          {/* 卡片内部高光 */}
          <div
            className="pointer-events-none absolute -top-24 left-1/2 h-48 w-80 -translate-x-1/2 rounded-full"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(200,170,255,0.35) 0%, transparent 70%)",
              filter: "blur(24px)",
            }}
          />

          <div className="relative">
            <span
              className="inline-block rounded-full px-4 py-1 text-xs font-semibold tracking-widest uppercase"
              style={{
                background: "rgba(200,170,255,0.14)",
                border: "1px solid rgba(200,170,255,0.3)",
                color: "#d5b8f5",
              }}
            >
              月卡会员
            </span>

            <div className="mt-5 flex items-end justify-center gap-1">
              <span
                className="text-5xl font-bold tracking-tight sm:text-6xl"
                style={{
                  background: "linear-gradient(135deg, #ffffff 0%, #c8aaff 100%)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                9.9
              </span>
              <span
                className="mb-2 text-lg font-medium"
                style={{ color: "#d5b8f5" }}
              >
                元/月
              </span>
            </div>

            <ul className="mx-auto mt-6 mb-7 flex max-w-sm flex-col gap-3 text-left">
              {BENEFITS.map((b) => (
                <li key={b} className="flex items-start gap-2.5 text-sm">
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
              href="https://afdian.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center rounded-2xl px-8 py-4 text-base font-bold transition-transform hover:scale-[1.03] active:scale-95 sm:w-auto"
              style={{
                background: "linear-gradient(135deg, #c8aaff 0%, #9d6cf5 50%, #e040fb 100%)",
                color: "#1a1530",
                boxShadow: "0 12px 40px rgba(157, 108, 245, 0.45)",
              }}
            >
              前往爱发电订阅
            </a>
          </div>
        </section>

        {/* 区域 2: BYOK 替代方案 */}
        <section
          className="mb-8 rounded-2xl p-6"
          style={{
            background: "rgba(200,170,255,0.05)",
            border: "1px solid rgba(200,170,255,0.15)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
        >
          <h2 className="mb-2 text-lg font-semibold" style={{ color: "#e8d5f5" }}>
            或使用自己的 API Key
          </h2>
          <p
            className="mb-5 text-sm leading-relaxed"
            style={{ color: "#c9b3e0" }}
          >
            如果你有自己的 DeepSeek API Key，填入即可永久免费使用织梦者。
          </p>
          <Link
            href="/settings"
            className="inline-flex items-center gap-1.5 rounded-xl px-6 py-3 text-sm font-semibold transition-transform hover:scale-[1.03] active:scale-95"
            style={{
              background: "rgba(200,170,255,0.12)",
              border: "1px solid rgba(200,170,255,0.35)",
              color: "#e8d5f5",
            }}
          >
            前往设置 →
          </Link>
        </section>

        {/* 区域 3: Token 验证 */}
        <section
          className="rounded-2xl p-6"
          style={{
            background: "rgba(200,170,255,0.05)",
            border: "1px solid rgba(200,170,255,0.15)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
        >
          <h2 className="mb-2 text-lg font-semibold" style={{ color: "#e8d5f5" }}>
            已订阅？输入验证码
          </h2>
          <p
            className="mb-5 text-sm leading-relaxed"
            style={{ color: "#c9b3e0" }}
          >
            在爱发电完成支付后，你会在感谢消息中收到一个验证码，输入即可解锁。
          </p>

          {isAlreadyPremium && !success ? (
            <div
              className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium"
              style={{
                background: "rgba(120, 220, 170, 0.1)",
                border: "1px solid rgba(120, 220, 170, 0.35)",
                color: "#9fe8c4",
              }}
            >
              ● 你已解锁会员权益，尽情畅玩吧！
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
                    if (e.key === "Enter") handleUnlock();
                  }}
                  placeholder="输入验证码"
                  spellCheck={false}
                  autoComplete="off"
                  className="w-full bg-transparent px-4 py-3 text-sm outline-none placeholder:text-[#6b5d85]"
                  style={{ color: "#e8d5f5" }}
                  disabled={success}
                />
              </div>

              <button
                type="button"
                onClick={handleUnlock}
                disabled={success}
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
                {success ? "解锁成功 ✓" : "解锁"}
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
              解锁成功！正在为你返回首页…
            </p>
          )}
        </section>

        <footer
          className="mt-10 text-center text-xs leading-relaxed"
          style={{ color: "#6b5d85" }}
        >
          织梦者 · 感谢你的支持，让每一个故事都能被讲述
        </footer>
      </div>
    </div>
  );
}

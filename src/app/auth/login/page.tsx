"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";

export default function LoginPage() {
  const router = useRouter();
  const { initAuth, sendOtp, verifyOtp, isLoading, user, isInitialized } =
    useAuthStore();

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  // 已登录则跳转首页
  useEffect(() => {
    if (isInitialized && user) {
      router.push("/");
    }
  }, [isInitialized, user, router]);

  // 倒计时
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // 第一步：发送验证码
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      setError("请输入邮箱");
      return;
    }

    setError("");
    const { error } = await sendOtp(trimmed);

    if (error) {
      setError(error);
    } else {
      setStep("code");
      setCountdown(60);
    }
  };

  // 第二步：验证码登录
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) {
      setError("请输入验证码");
      return;
    }
    if (trimmed.length !== 6) {
      setError("验证码为 6 位数字");
      return;
    }

    setError("");
    const { error } = await verifyOtp(email.trim(), trimmed);

    if (error) {
      setError(error);
    } else {
      // 登录成功，initAuth 的 onAuthStateChange 会触发跳转
      router.push("/");
    }
  };

  // 重新发送
  const handleResend = async () => {
    if (countdown > 0) return;
    setError("");
    setCode("");
    const { error } = await sendOtp(email.trim());
    if (error) {
      setError(error);
    } else {
      setCountdown(60);
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
      {/* 梦境光晕 */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[680px] h-[680px] rounded-full blur-2xl"
        style={{
          background:
            "radial-gradient(circle, rgba(200,170,255,0.18) 0%, transparent 65%)",
        }}
      />

      <div className="relative z-10 w-full max-w-md mx-auto px-6">
        <h1
          className="text-4xl font-bold tracking-[0.15em] mb-3 text-center"
          style={{
            color: "#e8d5f5",
            textShadow:
              "0 0 30px rgba(200,170,255,0.45), 0 0 70px rgba(200,170,255,0.25)",
          }}
        >
          织梦者
        </h1>
        <p
          className="text-sm tracking-[0.3em] mb-10 text-center"
          style={{ color: "#d5b8f5" }}
        >
          {step === "email" ? "登录以保存你的梦境" : "输入验证码"}
        </p>

        {/* 第一步：输入邮箱 */}
        {step === "email" && (
          <form onSubmit={handleSendCode} className="flex flex-col gap-4">
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError("");
              }}
              placeholder="你的邮箱"
              className="w-full rounded-2xl px-5 py-4 text-base outline-none transition-all duration-300 focus:shadow-[0_0_28px_rgba(200,170,255,0.25)]"
              style={{
                color: "#e8d5f5",
                background: "rgba(200,170,255,0.06)",
                border: error
                  ? "1px solid rgba(255,150,160,0.5)"
                  : "1px solid rgba(200,170,255,0.22)",
              }}
              autoFocus
              disabled={isLoading}
            />

            {error && (
              <p className="text-xs" style={{ color: "#f5a0a8" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full px-8 py-3.5 rounded-full text-base font-medium tracking-widest transition-all duration-300 active:scale-95 disabled:opacity-50 hover:scale-[1.03] shadow-[0_0_28px_rgba(200,170,255,0.3)]"
              style={{
                background: "linear-gradient(135deg, #c8aaff 0%, #b08fe8 100%)",
                color: "#1e1b2e",
              }}
            >
              {isLoading ? "发送中..." : "发送验证码"}
            </button>

            <p
              className="text-xs text-center mt-2 leading-relaxed"
              style={{ color: "rgba(213,184,245,0.5)" }}
            >
              我们会向你的邮箱发送一个 6 位验证码，输入即可登录，无需密码。
            </p>
          </form>
        )}

        {/* 第二步：输入验证码 */}
        {step === "code" && (
          <form onSubmit={handleVerify} className="flex flex-col gap-4">
            <p
              className="text-sm text-center mb-2 leading-relaxed"
              style={{ color: "#c9b3e0" }}
            >
              验证码已发送至
              <br />
              <span style={{ color: "#c8aaff" }}>{email}</span>
            </p>

            <input
              type="text"
              value={code}
              onChange={(e) => {
                // 只允许数字，最多 6 位
                const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                setCode(val);
                if (error) setError("");
              }}
              placeholder="6 位验证码"
              inputMode="numeric"
              maxLength={6}
              className="w-full rounded-2xl px-5 py-4 text-center text-2xl tracking-[0.5em] outline-none transition-all duration-300 focus:shadow-[0_0_28px_rgba(200,170,255,0.25)]"
              style={{
                color: "#e8d5f5",
                background: "rgba(200,170,255,0.06)",
                border: error
                  ? "1px solid rgba(255,150,160,0.5)"
                  : "1px solid rgba(200,170,255,0.22)",
              }}
              autoFocus
              disabled={isLoading}
            />

            {error && (
              <p className="text-xs text-center" style={{ color: "#f5a0a8" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading || code.length !== 6}
              className="w-full px-8 py-3.5 rounded-full text-base font-medium tracking-widest transition-all duration-300 active:scale-95 disabled:opacity-50 hover:scale-[1.03] shadow-[0_0_28px_rgba(200,170,255,0.3)]"
              style={{
                background: "linear-gradient(135deg, #c8aaff 0%, #b08fe8 100%)",
                color: "#1e1b2e",
              }}
            >
              {isLoading ? "验证中..." : "登录"}
            </button>

            {/* 重新发送 / 换邮箱 */}
            <div className="flex items-center justify-between mt-2">
              <button
                type="button"
                onClick={handleResend}
                disabled={countdown > 0}
                className="text-xs transition-opacity hover:opacity-80 disabled:opacity-40"
                style={{ color: "#c8aaff" }}
              >
                {countdown > 0 ? `重新发送 (${countdown}s)` : "重新发送验证码"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setError("");
                }}
                className="text-xs transition-opacity hover:opacity-80"
                style={{ color: "rgba(213,184,245,0.5)" }}
              >
                ← 换邮箱
              </button>
            </div>
          </form>
        )}

        <div className="mt-8 text-center">
          <button
            onClick={() => router.push("/")}
            className="text-xs transition-opacity hover:opacity-80"
            style={{ color: "rgba(213,184,245,0.4)" }}
          >
            ← 稍后再说，先逛逛
          </button>
        </div>
      </div>
    </div>
  );
}

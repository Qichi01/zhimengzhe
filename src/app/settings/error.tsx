"use client";

import { useEffect } from "react";

/**
 * 设置页错误边界
 * 专门捕获 /settings 路由的运行时错误
 */
export default function SettingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 将错误上报到控制台（生产环境也可在 Vercel 日志中查看）
    console.error("[Settings Page Error]", error);
  }, [error]);

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-6"
      style={{
        background:
          "radial-gradient(ellipse at 50% 0%, #2e2b4e 0%, #1e1b2e 60%, #14111f 100%)",
        color: "#e8d5f5",
      }}
    >
      <div className="w-full max-w-md text-center">
        <div className="mb-6 text-5xl" style={{ color: "#c8aaff" }}>
          ⚙
        </div>
        <h1 className="mb-3 text-2xl font-semibold" style={{ color: "#e8d5f5" }}>
          设置页暂时打不开
        </h1>
        <p className="mb-8 text-sm leading-relaxed" style={{ color: "#c9b3e0" }}>
          可能是网络波动或浏览器兼容问题。你的数据和配置都安全保存在本地，不会丢失。
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={reset}
            className="rounded-xl px-6 py-3 text-sm font-semibold transition-transform hover:scale-[1.03] active:scale-95"
            style={{
              background: "linear-gradient(135deg, #c8aaff 0%, #9d6cf5 100%)",
              color: "#1a1530",
              boxShadow: "0 6px 20px rgba(157, 108, 245, 0.35)",
            }}
          >
            重新加载
          </button>
          <a
            href="/"
            className="rounded-xl px-6 py-3 text-sm font-medium transition-all hover:scale-[1.03]"
            style={{
              border: "1px solid rgba(200, 170, 255, 0.25)",
              color: "#c9b3e0",
            }}
          >
            返回首页
          </a>
        </div>
      </div>
    </div>
  );
}

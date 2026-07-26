"use client";

/**
 * 全局错误边界
 * 捕获任何未处理的运行时错误，显示友好界面而非白屏
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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
          ✦
        </div>
        <h1 className="mb-3 text-2xl font-semibold" style={{ color: "#e8d5f5" }}>
          页面好像做了一个梦
        </h1>
        <p className="mb-8 text-sm leading-relaxed" style={{ color: "#c9b3e0" }}>
          别担心，你的数据都在。试着刷新一下，或者回到首页重新开始。
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
            重试
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

        {process.env.NODE_ENV === "development" && (
          <details className="mt-8 text-left">
            <summary
              className="cursor-pointer text-xs"
              style={{ color: "#8a7aa8" }}
            >
              错误详情
            </summary>
            <pre
              className="mt-2 overflow-auto rounded-lg p-3 text-xs"
              style={{
                background: "rgba(0, 0, 0, 0.3)",
                color: "#f5b8b8",
              }}
            >
              {error.message}
              {error.digest && `\nDigest: ${error.digest}`}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

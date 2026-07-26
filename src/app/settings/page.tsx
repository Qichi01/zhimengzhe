"use client";

import dynamic from "next/dynamic";

/**
 * 设置页 — 禁用 SSR 预渲染
 *
 * 原因：Zustand persist 在客户端从 localStorage 读取状态，
 * 与 Next.js 静态预渲染的 HTML 不一致，导致 hydration 后重渲染崩溃。
 * 使用 dynamic({ ssr: false }) 让设置页纯客户端渲染，彻底消除此问题。
 */
const SettingsContent = dynamic(() => import("./SettingsContent"), {
  ssr: false,
  loading: () => (
    <div
      className="flex min-h-screen items-center justify-center"
      style={{
        background:
          "radial-gradient(ellipse at 50% 0%, #2e2b4e 0%, #1e1b2e 60%, #14111f 100%)",
      }}
    >
      <div
        className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
        style={{ borderColor: "#c8aaff", borderTopColor: "transparent" }}
      />
    </div>
  ),
});

export default function SettingsPage() {
  return <SettingsContent />;
}

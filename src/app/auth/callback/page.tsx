"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";

/**
 * 魔法链接回调页面
 * Supabase 邮件链接点击后会跳转到此页面并带上 token
 * Supabase SDK 会自动处理 token 交换
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const { initAuth } = useAuthStore();

  useEffect(() => {
    const handleCallback = async () => {
      await initAuth();
      // 登录完成后跳转首页
      router.push("/");
    };
    handleCallback();
  }, [initAuth, router]);

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{
        background:
          "radial-gradient(ellipse at 50% 32%, #2e2b4e 0%, #1e1b2e 55%, #14111e 100%)",
      }}
    >
      <div className="text-center">
        <div
          className="inline-block w-10 h-10 border-2 border-t-transparent rounded-full animate-spin mb-4"
          style={{ borderColor: "#c8aaff", borderTopColor: "transparent" }}
        />
        <p style={{ color: "#d5b8f5" }} className="text-sm tracking-wider">
          正在为你编织梦境入口…
        </p>
      </div>
    </div>
  );
}

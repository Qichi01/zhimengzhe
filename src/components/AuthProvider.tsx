"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useUserStore } from "@/stores/userStore";

/**
 * 认证 Provider
 * 在应用初始化时恢复用户的 Supabase session
 * 登录后自动同步用户会员资料
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const initAuth = useAuthStore((s) => s.initAuth);
  const user = useAuthStore((s) => s.user);
  const syncProfile = useUserStore((s) => s.syncProfile);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  // 用户登录后同步会员资料
  useEffect(() => {
    if (user) {
      syncProfile(user.id);
    }
  }, [user, syncProfile]);

  return <>{children}</>;
}

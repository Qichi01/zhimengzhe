"use client";

import { create } from "zustand";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isInitialized: boolean;

  // Actions
  initAuth: () => Promise<void>;
  sendOtp: (email: string) => Promise<{ error: string | null }>;
  verifyOtp: (email: string, token: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,
  isInitialized: false,

  initAuth: async () => {
    try {
      const supabase = createClient();
      if (!supabase) {
        // Supabase 未配置，跳过认证初始化
        set({ isInitialized: true });
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      set({ user: session?.user ?? null, isInitialized: true });

      // 监听认证状态变化
      supabase.auth.onAuthStateChange((_event, session) => {
        set({ user: session?.user ?? null });
      });
    } catch {
      // 认证初始化失败，不阻塞应用
      set({ isInitialized: true });
    }
  },

  // 发送验证码到邮箱
  sendOtp: async (email) => {
    const supabase = createClient();
    if (!supabase) return { error: "账号系统暂未启用" };

    set({ isLoading: true });
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });

    set({ isLoading: false });
    return { error: error?.message ?? null };
  },

  // 验证 6 位验证码
  verifyOtp: async (email, token) => {
    const supabase = createClient();
    if (!supabase) return { error: "账号系统暂未启用" };

    set({ isLoading: true });
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    });

    set({ isLoading: false });

    if (error) return { error: error.message };

    if (data?.user) {
      set({ user: data.user });
    }

    return { error: null };
  },

  signOut: async () => {
    const supabase = createClient();
    if (!supabase) {
      set({ user: null });
      return;
    }
    await supabase.auth.signOut();
    set({ user: null });
  },

  setUser: (user) => set({ user }),
}));

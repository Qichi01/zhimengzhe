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
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    set({ user: session?.user ?? null, isInitialized: true });

    // 监听认证状态变化
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ user: session?.user ?? null });
    });
  },

  // 发送验证码到邮箱
  sendOtp: async (email) => {
    set({ isLoading: true });
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });

    set({ isLoading: false });
    return { error: error?.message ?? null };
  },

  // 验证 6 位验证码
  verifyOtp: async (email, token) => {
    set({ isLoading: true });
    const supabase = createClient();

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
    await supabase.auth.signOut();
    set({ user: null });
  },

  setUser: (user) => set({ user }),
}));

"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TypewriterSpeed, MembershipPlan } from "@/types";
import type { ProviderId } from "@/lib/providers";
import { createClient } from "@/lib/supabase/client";
import { getUserProfile, updateMembership, incrementFreeTrial } from "@/lib/supabase/queries";
import {
  getLocalProfile,
  setLocalProfile,
  incrementLocalFreeTrial,
  isLocalMembershipActive,
} from "@/lib/localDb";

interface UserState {
  apiKey: string;              // 用户的 API Key
  providerId: ProviderId;      // AI 提供商 ID
  modelId: string;             // 模型 ID
  themeId: string;             // 当前主题 ID
  typewriterSpeed: TypewriterSpeed;

  // ---- 会员状态（云端 + 本地双轨） ----
  membershipPlan: MembershipPlan;
  membershipExpiresAt: string | null;
  freeTrialUsed: number;       // 已用免费体验次数
  premiumToken: string;        // 爱发电付费验证码
  profileSyncedAt: number | null;  // 上次同步时间戳

  // Actions
  setApiKey: (key: string) => void;
  setProviderId: (id: ProviderId) => void;
  setModelId: (id: string) => void;
  setThemeId: (id: string) => void;
  setTypewriterSpeed: (speed: TypewriterSpeed) => void;

  // 会员相关
  setPremiumToken: (token: string) => void;
  syncProfile: (userId: string) => Promise<void>;
  syncLocalProfile: () => void;
  activateMembership: (userId: string, plan: "monthly" | "quarterly") => Promise<{ error: string | null }>;
  activateLocalMembership: (plan: "monthly" | "quarterly", expiresAt: string) => void;
  consumeFreeTrial: (userId?: string) => Promise<{ ok: boolean; error?: string }>;

  // 检查权限
  isPremium: () => boolean;
  canPlayUnlimited: () => boolean;
  remainingFreeTrials: () => number;
}

export const MAX_FREE_TRIALS = 20;

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      apiKey: "",
      providerId: "deepseek",
      modelId: "deepseek-chat",
      themeId: "dream-light",
      typewriterSpeed: "medium",

      membershipPlan: "free",
      membershipExpiresAt: null,
      freeTrialUsed: 0,
      premiumToken: "",
      profileSyncedAt: null,

      setApiKey: (key) => set({ apiKey: key }),
      setProviderId: (id) => set({ providerId: id }),
      setModelId: (id) => set({ modelId: id }),
      setThemeId: (id) => set({ themeId: id }),
      setTypewriterSpeed: (speed) => set({ typewriterSpeed: speed }),

      setPremiumToken: (token) => set({ premiumToken: token }),

      // 从 Supabase 同步用户会员资料（已登录时调用）
      syncProfile: async (userId) => {
        try {
          const { data, error } = await getUserProfile(userId);
          if (error || !data) return;

          set({
            membershipPlan: data.membership_plan,
            membershipExpiresAt: data.membership_expires_at,
            freeTrialUsed: data.free_trial_used,
            profileSyncedAt: Date.now(),
          });
        } catch {
          // Supabase 不可用时静默失败，不阻塞应用
        }
      },

      // 从本地缓存同步会员资料（未登录时调用）
      syncLocalProfile: () => {
        const local = getLocalProfile();
        set({
          membershipPlan: local.membership_plan,
          membershipExpiresAt: local.membership_expires_at,
          freeTrialUsed: local.free_trial_used,
          profileSyncedAt: Date.now(),
        });
      },

      // 激活云端会员
      activateMembership: async (userId, plan) => {
        const { error } = await updateMembership(userId, plan);
        if (error) return { error };

        const now = new Date();
        const expiresAt = new Date(now);
        if (plan === "monthly") expiresAt.setMonth(expiresAt.getMonth() + 1);
        else expiresAt.setMonth(expiresAt.getMonth() + 3);

        set({
          membershipPlan: plan,
          membershipExpiresAt: expiresAt.toISOString(),
          profileSyncedAt: Date.now(),
        });
        return { error: null };
      },

      // 激活本地会员（兑换码）
      activateLocalMembership: (plan, expiresAt) => {
        const profile = getLocalProfile();
        profile.membership_plan = plan;
        profile.membership_expires_at = expiresAt;
        setLocalProfile(profile);

        set({
          membershipPlan: plan,
          membershipExpiresAt: expiresAt,
          profileSyncedAt: Date.now(),
        });
      },

      // 消耗一次免费体验
      consumeFreeTrial: async (userId) => {
        const state = get();
        // 已是会员或有 API Key 不消耗
        if (state.isPremium() || state.apiKey !== "") {
          return { ok: true };
        }
        if (state.remainingFreeTrials() <= 0) {
          return { ok: false, error: "free_exhausted" };
        }

        if (userId) {
          // 已登录 → 同步到 Supabase
          const { error } = await incrementFreeTrial(userId);
          if (error) return { ok: false, error };
        } else {
          // 未登录 → 只更新本地计数
          incrementLocalFreeTrial();
        }

        set((s) => ({
          freeTrialUsed: s.freeTrialUsed + 1,
          profileSyncedAt: Date.now(),
        }));
        return { ok: true };
      },

      // 会员是否有效（云端或本地）
      isPremium: () => {
        const { membershipPlan, membershipExpiresAt } = get();
        if (membershipPlan !== "free" && membershipExpiresAt) {
          return new Date(membershipExpiresAt).getTime() > Date.now();
        }
        // 也检查本地 profile（兜底）
        return isLocalMembershipActive();
      },

      // 是否可无限游玩（会员 或 自带 Key）
      canPlayUnlimited: () => {
        const state = get();
        return state.isPremium() || state.apiKey !== "";
      },

      // 剩余免费次数（同时检查 state 和本地 profile）
      remainingFreeTrials: () => {
        const used = Math.max(get().freeTrialUsed, getLocalProfile().free_trial_used);
        return Math.max(0, MAX_FREE_TRIALS - used);
      },
    }),
    {
      name: "zhimengzhe-user",
      // 只持久化 UI 偏好与缓存，不持久化会员状态（每次从 Supabase 同步）
      partialize: (state) => ({
        apiKey: state.apiKey,
        providerId: state.providerId,
        modelId: state.modelId,
        themeId: state.themeId,
        typewriterSpeed: state.typewriterSpeed,
        premiumToken: state.premiumToken,
        // 会员状态作为缓存持久化，但登录后会重新同步
        membershipPlan: state.membershipPlan,
        membershipExpiresAt: state.membershipExpiresAt,
        freeTrialUsed: state.freeTrialUsed,
        profileSyncedAt: state.profileSyncedAt,
      }),
    }
  )
);

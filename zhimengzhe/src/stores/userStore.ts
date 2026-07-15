"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TypewriterSpeed } from "@/types";

interface UserState {
  apiKey: string;              // 用户的 DeepSeek API Key
  themeId: string;             // 当前主题 ID
  typewriterSpeed: TypewriterSpeed;
  freeTrialCount: number;      // 剩余免费体验次数
  premiumToken: string;        // 爱发电付费 token
  isPremium: boolean;          // 是否已付费解锁

  // Actions
  setApiKey: (key: string) => void;
  setThemeId: (id: string) => void;
  setTypewriterSpeed: (speed: TypewriterSpeed) => void;
  decrementFreeTrial: () => void;
  setPremiumToken: (token: string) => void;
  setPremium: (premium: boolean) => void;

  // 检查是否有有效的无限游玩权限
  canPlayUnlimited: () => boolean;
}

const MAX_FREE_TRIALS = 3;

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      apiKey: "",
      themeId: "dream-light",
      typewriterSpeed: "medium",
      freeTrialCount: MAX_FREE_TRIALS,
      premiumToken: "",
      isPremium: false,

      setApiKey: (key) => set({ apiKey: key }),
      setThemeId: (id) => set({ themeId: id }),
      setTypewriterSpeed: (speed) => set({ typewriterSpeed: speed }),
      decrementFreeTrial: () =>
        set((state) => ({
          freeTrialCount: Math.max(0, state.freeTrialCount - 1),
        })),
      setPremiumToken: (token) => set({ premiumToken: token }),
      setPremium: (premium) => set({ isPremium: premium }),

      canPlayUnlimited: () => {
        const state = get();
        return state.isPremium || state.apiKey !== "";
      },
    }),
    {
      name: "zhimengzhe-user",
    }
  )
);

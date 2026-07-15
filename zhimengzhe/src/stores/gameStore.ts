"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Scene, ChatMessage } from "@/types";

interface GameState {
  // 游戏状态
  storySetting: string;          // 用户输入的故事设定
  scenes: Scene[];               // 所有场景历史
  messages: ChatMessage[];       // 发给 AI 的完整对话历史
  isPlaying: boolean;            // 是否正在游戏中
  isLoading: boolean;            // AI 是否正在生成
  currentSceneIndex: number;     // 当前显示的场景索引

  // Actions
  setStorySetting: (setting: string) => void;
  addScene: (scene: Scene) => void;
  addMessage: (message: ChatMessage) => void;
  setLoading: (loading: boolean) => void;
  startGame: (setting: string) => void;
  resetGame: () => void;
  goToScene: (index: number) => void;
}

const SYSTEM_PROMPT = `你是一位互动小说大师。用户会给出一个故事设定，你需要：

1. 每次只生成一个场景描述（150-300字），营造强烈的画面感和沉浸感
2. 在场景描述后，提供 2-4 个选项供玩家选择
3. 选项要有实际影响力，能真正改变故事走向
4. 保持叙事连贯性，记住之前发生的所有事情
5. 文风要优美、有画面感，像优秀的小说一样
6. 如果故事已经到达结局（玩家成功或失败），在场景描述最后加上【结局】标记，并且不提供选项

输出格式必须严格如下：

[场景描述]
（空行）
选项：
A. [选项1]
B. [选项2]
C. [选项3]（如果有）
D. [选项4]（如果有）

注意：不要输出任何其他内容，不要解释，不要加markdown格式。`;

export const useGameStore = create<GameState>()(
  persist(
    (set) => ({
      storySetting: "",
      scenes: [],
      messages: [],
      isPlaying: false,
      isLoading: false,
      currentSceneIndex: -1,

      setStorySetting: (setting) => set({ storySetting: setting }),

      addScene: (scene) =>
        set((state) => ({
          scenes: [...state.scenes, scene],
          currentSceneIndex: state.scenes.length,
        })),

      addMessage: (message) =>
        set((state) => ({ messages: [...state.messages, message] })),

      setLoading: (loading) => set({ isLoading: loading }),

      startGame: (setting) =>
        set({
          storySetting: setting,
          scenes: [],
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: `故事设定：${setting}\n\n请开始第一章的场景描述。` },
          ],
          isPlaying: true,
          isLoading: false,
          currentSceneIndex: -1,
        }),

      resetGame: () =>
        set({
          storySetting: "",
          scenes: [],
          messages: [],
          isPlaying: false,
          isLoading: false,
          currentSceneIndex: -1,
        }),

      goToScene: (index) => set({ currentSceneIndex: index }),
    }),
    {
      name: "zhimengzhe-game",
    }
  )
);

/**
 * 埋点工具
 * 使用 Umami Cloud 进行匿名事件追踪
 * 不使用 Cookie，不收集个人身份信息
 */

// Umami 全局对象类型声明
declare global {
  interface Window {
    umami?: {
      track: (event: string, props?: Record<string, unknown>) => void;
    };
  }
}

/**
 * 发送埋点事件
 * @param event 事件名
 * @param props 事件属性（不含 PII）
 */
export function track(event: string, props?: Record<string, unknown>): void {
  if (typeof window !== "undefined" && window.umami) {
    try {
      window.umami.track(event, props);
    } catch {
      // 静默失败，不影响用户操作
    }
  }
}

// 常用事件快捷方法
export const analytics = {
  createGame: (gameType: string) =>
    track("create_game", { game_type: gameType }),

  enterGame: (gameType: string, hasSaves: boolean) =>
    track("enter_game", { game_type: gameType, has_saves: hasSaves }),

  startJourney: (action: "new" | "continue" | "load") =>
    track("start_journey", { action }),

  completeChapter: (chapterNumber: number) =>
    track("complete_chapter", { chapter_number: chapterNumber }),

  viewStarMap: (chapterCount: number) =>
    track("view_star_map", { chapter_count: chapterCount }),

  viewRelationship: (characterCount: number) =>
    track("view_relationship", { character_count: characterCount }),

  viewClueBoard: (clueCount: number) =>
    track("view_clue_board", { clue_count: clueCount }),

  viewStoryReview: (chaptersReviewed: number) =>
    track("view_story_review", { chapters_reviewed: chaptersReviewed }),

  hitPaywall: (trigger: "free_exhausted" | "no_key") =>
    track("hit_paywall", { trigger }),

  completePayment: (plan: "monthly" | "quarterly") =>
    track("complete_payment", { plan }),

  saveGame: (chapterNumber?: number) =>
    track("save_game", { chapter_number: chapterNumber }),
};

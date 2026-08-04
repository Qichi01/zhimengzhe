import type {
  NarrativeFrame,
  NarrativeGenreId,
  WorldState,
} from "@/types";
import { getGenrePack } from "./genrePacks";
import {
  applyNarrativeFrameToState,
  createInitialWorldState,
} from "./runtime";
import {
  commitNarrativeFrame,
  getWorldState,
  saveRejectedNarrativeEvents,
} from "./storage";
import {
  validateNarrativeFrame,
  type NarrativeValidationIssue,
} from "./validator";

interface ProcessNarrativeFrameInput {
  gameId: string;
  genreId: NarrativeGenreId;
  sequence: number;
  rawFrame: unknown;
  fallbackFrameId?: string;
}

export interface ProcessNarrativeFrameResult {
  frame: NarrativeFrame | null;
  state: WorldState | null;
  committed: boolean;
  rejectedEventCount: number;
  issues: NarrativeValidationIssue[];
}

/**
 * V3 帧处理单一入口：校验 → 幂等物化 → IndexedDB 原子提交。
 * 界面组件只消费这里返回的 frame/state，不直接读取模型原始 JSON。
 */
export async function processNarrativeFrame({
  gameId,
  genreId,
  sequence,
  rawFrame,
  fallbackFrameId,
}: ProcessNarrativeFrameInput): Promise<ProcessNarrativeFrameResult> {
  const genrePack = getGenrePack(genreId);
  const validation = validateNarrativeFrame(rawFrame, {
    gameId,
    sequence,
    fallbackId: fallbackFrameId,
    allowedEventTypes: genrePack?.allowedEventTypes,
  });

  if (!validation.frame) {
    return {
      frame: null,
      state: null,
      committed: false,
      rejectedEventCount: validation.rejectedEvents.length,
      issues: validation.issues,
    };
  }

  const previousState =
    (await getWorldState(gameId)) ?? createInitialWorldState(gameId);
  const state = applyNarrativeFrameToState(previousState, validation.frame, {
    messageModule:
      genreId === "infinite_flow" ? "team_channel" : "messages",
  });
  const { committed } = await commitNarrativeFrame(validation.frame, state);

  if (committed && validation.rejectedEvents.length > 0) {
    await saveRejectedNarrativeEvents(
      gameId,
      validation.frame.id,
      validation.rejectedEvents,
      validation.issues
    );
  }

  return {
    frame: validation.frame,
    state,
    committed,
    rejectedEventCount: validation.rejectedEvents.length,
    issues: validation.issues,
  };
}

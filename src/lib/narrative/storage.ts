import { openLocalDb } from "@/lib/localDb";
import type {
  NarrativeFrame,
  StoredNarrativeEvent,
  WorldDefinition,
  WorldState,
} from "@/types";
import type { NarrativeValidationIssue } from "./validator";

export async function saveWorldDefinition(
  definition: WorldDefinition
): Promise<void> {
  await putV3Record("world_definitions", definition);
}

export async function getWorldDefinition(
  gameId: string
): Promise<WorldDefinition | null> {
  return getV3Record<WorldDefinition>("world_definitions", gameId);
}

export async function getWorldState(
  gameId: string
): Promise<WorldState | null> {
  return getV3Record<WorldState>("world_states", gameId);
}

export async function saveWorldState(state: WorldState): Promise<void> {
  await putV3Record("world_states", state);
}

export async function getNarrativeFrames(
  gameId: string
): Promise<NarrativeFrame[]> {
  const db = await openLocalDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("narrative_frames", "readonly");
    const request = tx.objectStore("narrative_frames").getAll();
    request.onsuccess = () => {
      const frames = (request.result as NarrativeFrame[])
        .filter((frame) => frame.gameId === gameId)
        .sort((a, b) => a.sequence - b.sequence);
      resolve(frames);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * 同一事务写入叙事帧、事件日志和物化世界状态。
 * 已存在的 frame ID 视为重试并直接跳过，避免事件二次提交。
 */
export async function commitNarrativeFrame(
  frame: NarrativeFrame,
  state: WorldState
): Promise<{ committed: boolean }> {
  const db = await openLocalDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(
      ["narrative_frames", "narrative_events", "world_states"],
      "readwrite"
    );
    const frameStore = tx.objectStore("narrative_frames");
    const eventStore = tx.objectStore("narrative_events");
    const stateStore = tx.objectStore("world_states");
    const existingRequest = frameStore.get(frame.id);
    let committed = false;

    existingRequest.onsuccess = () => {
      if (existingRequest.result) return;
      committed = true;
      frameStore.put(frame);
      frame.events.forEach((event) => {
        const record: StoredNarrativeEvent = {
          ...event,
          gameId: frame.gameId,
          frameId: frame.id,
          frameSequence: frame.sequence,
          createdAt: frame.createdAt,
        };
        eventStore.put(record);
      });
      stateStore.put(state);
    };

    existingRequest.onerror = () => reject(existingRequest.error);
    tx.oncomplete = () => resolve({ committed });
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("叙事帧事务已取消"));
  });
}

export async function saveRejectedNarrativeEvents(
  gameId: string,
  frameId: string,
  rejectedEvents: unknown[],
  issues: NarrativeValidationIssue[]
): Promise<void> {
  if (rejectedEvents.length === 0) return;
  const db = await openLocalDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("narrative_event_failures", "readwrite");
    const store = tx.objectStore("narrative_event_failures");
    const createdAt = new Date().toISOString();
    rejectedEvents.forEach((rawEvent, index) => {
      store.put({
        id: crypto.randomUUID(),
        gameId,
        frameId,
        rawEvent,
        issues,
        index,
        status: "pending_repair",
        createdAt,
      });
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("失败事件写入已取消"));
  });
}

async function putV3Record(storeName: string, value: unknown): Promise<void> {
  const db = await openLocalDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const request = tx.objectStore(storeName).put(value);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function getV3Record<T>(
  storeName: string,
  id: string
): Promise<T | null> {
  const db = await openLocalDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const request = tx.objectStore(storeName).get(id);
    request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
}

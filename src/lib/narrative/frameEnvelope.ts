import type { Option } from "@/types";

interface ComposeFrameInputOptions {
  frameId: string;
  prose: string;
  choices: Option[];
  payload?: Record<string, unknown>;
}

/**
 * 将模型尾包收敛为交给 V3 validator 的输入。
 * 正文、选项和稳定 ID 始终由客户端覆盖，模型不能借尾包篡改可见剧情。
 */
export function composeNarrativeFrameInput({
  frameId,
  prose,
  choices,
  payload,
}: ComposeFrameInputOptions): Record<string, unknown> {
  const safePayload = payload ?? {};
  const rawEvents = Array.isArray(safePayload.events)
    ? safePayload.events.slice(0, 30)
    : [];
  const events = rawEvents.map((event, index) =>
    isRecord(event)
      ? { ...event, id: `${frameId}:event-${index + 1}` }
      : event
  );

  return {
    ...safePayload,
    id: frameId,
    prose,
    choices,
    events,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

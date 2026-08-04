import type {
  CalendarAddPayload,
  ForumPostPayload,
  IllustrationCue,
  InventoryGrantPayload,
  MessageReceivePayload,
  NarrativeCriticality,
  NarrativeEvent,
  NarrativeEventType,
  NarrativeEventVisibility,
  NarrativeFrame,
  QuestUpdatePayload,
  RelationshipUpdatePayload,
  ShopUnlockPayload,
  WorldStatePatch,
} from "@/types";

export interface NarrativeValidationIssue {
  path: string;
  message: string;
}

export interface NarrativeFrameValidationResult {
  frame: NarrativeFrame | null;
  rejectedEvents: unknown[];
  issues: NarrativeValidationIssue[];
}

interface ValidateNarrativeFrameOptions {
  gameId: string;
  sequence: number;
  allowedEventTypes?: NarrativeEventType[];
  fallbackId?: string;
}

const EVENT_TYPES = new Set<NarrativeEventType>([
  "message.receive",
  "forum.post",
  "calendar.add",
  "quest.update",
  "inventory.grant",
  "shop.unlock",
  "relationship.update",
]);

const VISIBILITIES = new Set<NarrativeEventVisibility>([
  "immediate",
  "after_prose",
  "on_module_open",
]);

const CRITICALITIES = new Set<NarrativeCriticality>([
  "ordinary",
  "key",
  "climax",
]);

/**
 * 将模型输出收敛为 V3 白名单协议。
 * 正文有效时，即使部分事件非法也会返回 frame；非法事件独立进入 rejectedEvents。
 */
export function validateNarrativeFrame(
  input: unknown,
  options: ValidateNarrativeFrameOptions
): NarrativeFrameValidationResult {
  const issues: NarrativeValidationIssue[] = [];
  const rejectedEvents: unknown[] = [];
  if (!isRecord(input)) {
    return {
      frame: null,
      rejectedEvents,
      issues: [{ path: "$", message: "叙事帧必须是对象" }],
    };
  }

  const prose = readString(input.prose, 24_000);
  if (!prose) {
    issues.push({ path: "prose", message: "正文不能为空" });
    return { frame: null, rejectedEvents, issues };
  }

  const frameId =
    readIdentifier(input.id) ??
    readIdentifier(options.fallbackId) ??
    `frame-${options.sequence}`;
  const seenEventIds = new Set<string>();
  const allowedTypes = options.allowedEventTypes
    ? new Set(options.allowedEventTypes)
    : EVENT_TYPES;
  const events: NarrativeEvent[] = [];
  const rawEvents = Array.isArray(input.events) ? input.events.slice(0, 30) : [];

  rawEvents.forEach((rawEvent, index) => {
    const event = validateNarrativeEvent(rawEvent, `events[${index}]`, issues);
    if (
      !event ||
      !allowedTypes.has(event.type) ||
      seenEventIds.has(event.id)
    ) {
      if (event && !allowedTypes.has(event.type)) {
        issues.push({
          path: `events[${index}].type`,
          message: `当前题材包不允许事件 ${event.type}`,
        });
      }
      if (event && seenEventIds.has(event.id)) {
        issues.push({
          path: `events[${index}].id`,
          message: "同一叙事帧内事件 ID 不能重复",
        });
      }
      rejectedEvents.push(rawEvent);
      return;
    }
    seenEventIds.add(event.id);
    events.push(event);
  });

  return {
    frame: {
      id: frameId,
      gameId: options.gameId,
      sequence: Math.max(0, Math.trunc(options.sequence)),
      prose,
      choices: validateChoices(input.choices),
      criticality: CRITICALITIES.has(input.criticality as NarrativeCriticality)
        ? (input.criticality as NarrativeCriticality)
        : "ordinary",
      events,
      statePatch: validateStatePatch(input.statePatch),
      illustrationCue: validateIllustrationCue(input.illustrationCue),
      createdAt: new Date().toISOString(),
    },
    rejectedEvents,
    issues,
  };
}

function validateNarrativeEvent(
  input: unknown,
  path: string,
  issues: NarrativeValidationIssue[]
): NarrativeEvent | null {
  if (!isRecord(input)) {
    issues.push({ path, message: "事件必须是对象" });
    return null;
  }
  const id = readIdentifier(input.id);
  const type = input.type;
  if (!id) {
    issues.push({ path: `${path}.id`, message: "事件缺少稳定 ID" });
    return null;
  }
  if (typeof type !== "string" || !EVENT_TYPES.has(type as NarrativeEventType)) {
    issues.push({ path: `${path}.type`, message: "未知事件类型" });
    return null;
  }
  if (!isRecord(input.payload)) {
    issues.push({ path: `${path}.payload`, message: "事件 payload 必须是对象" });
    return null;
  }
  const visibleAt = VISIBILITIES.has(input.visibleAt as NarrativeEventVisibility)
    ? (input.visibleAt as NarrativeEventVisibility)
    : "after_prose";

  switch (type as NarrativeEventType) {
    case "message.receive": {
      const payload = validateMessagePayload(input.payload);
      return payload ? { id, type: "message.receive", visibleAt, payload } : invalidPayload(path, issues);
    }
    case "forum.post": {
      const payload = validateForumPayload(input.payload);
      return payload ? { id, type: "forum.post", visibleAt, payload } : invalidPayload(path, issues);
    }
    case "calendar.add": {
      const payload = validateCalendarPayload(input.payload);
      return payload ? { id, type: "calendar.add", visibleAt, payload } : invalidPayload(path, issues);
    }
    case "quest.update": {
      const payload = validateQuestPayload(input.payload);
      return payload ? { id, type: "quest.update", visibleAt, payload } : invalidPayload(path, issues);
    }
    case "inventory.grant": {
      const payload = validateInventoryPayload(input.payload);
      return payload ? { id, type: "inventory.grant", visibleAt, payload } : invalidPayload(path, issues);
    }
    case "shop.unlock": {
      const payload = validateShopPayload(input.payload);
      return payload ? { id, type: "shop.unlock", visibleAt, payload } : invalidPayload(path, issues);
    }
    case "relationship.update": {
      const payload = validateRelationshipPayload(input.payload);
      return payload ? { id, type: "relationship.update", visibleAt, payload } : invalidPayload(path, issues);
    }
  }
}

function invalidPayload(
  path: string,
  issues: NarrativeValidationIssue[]
): null {
  issues.push({ path: `${path}.payload`, message: "事件 payload 字段不完整" });
  return null;
}

function validateMessagePayload(value: Record<string, unknown>): MessageReceivePayload | null {
  const conversationId = readIdentifier(value.conversationId);
  const senderCharacterId = readIdentifier(value.senderCharacterId);
  const content = readString(value.content, 4000);
  if (!conversationId || !senderCharacterId || !content) return null;
  const messageKind =
    value.messageKind === "image" || value.messageKind === "system"
      ? value.messageKind
      : "text";
  return {
    conversationId,
    senderCharacterId,
    content,
    messageKind,
    imageAssetId: readIdentifier(value.imageAssetId) ?? undefined,
  };
}

function validateForumPayload(value: Record<string, unknown>): ForumPostPayload | null {
  const postId = readIdentifier(value.postId);
  const board = readString(value.board, 80);
  const title = readString(value.title, 160);
  const content = readString(value.content, 8000);
  if (!postId || !board || !title || !content) return null;
  return {
    postId,
    board,
    title,
    content,
    authorCharacterId: readIdentifier(value.authorCharacterId) ?? undefined,
    reliability:
      value.reliability === "verified" || value.reliability === "rumor"
        ? value.reliability
        : "unknown",
  };
}

function validateCalendarPayload(value: Record<string, unknown>): CalendarAddPayload | null {
  const entryId = readIdentifier(value.entryId);
  const title = readString(value.title, 160);
  const storyTime = readString(value.storyTime, 120);
  if (!entryId || !title || !storyTime) return null;
  return {
    entryId,
    title,
    storyTime,
    locationId: readIdentifier(value.locationId) ?? undefined,
    description: readString(value.description, 1000) || undefined,
  };
}

function validateQuestPayload(value: Record<string, unknown>): QuestUpdatePayload | null {
  const questId = readIdentifier(value.questId);
  const title = readString(value.title, 160);
  const statuses: QuestUpdatePayload["status"][] = [
    "hidden",
    "active",
    "completed",
    "failed",
  ];
  const status = statuses.includes(value.status as QuestUpdatePayload["status"])
    ? (value.status as QuestUpdatePayload["status"])
    : null;
  if (!questId || !title || !status) return null;
  return {
    questId,
    title,
    status,
    description: readString(value.description, 1600) || undefined,
    progressLabel: readString(value.progressLabel, 160) || undefined,
  };
}

function validateInventoryPayload(value: Record<string, unknown>): InventoryGrantPayload | null {
  const itemId = readIdentifier(value.itemId);
  const name = readString(value.name, 120);
  const quantity = readPositiveInteger(value.quantity);
  if (!itemId || !name || quantity === null) return null;
  return {
    itemId,
    name,
    quantity,
    description: readString(value.description, 1200) || undefined,
    source: readString(value.source, 160) || undefined,
  };
}

function validateShopPayload(value: Record<string, unknown>): ShopUnlockPayload | null {
  const shopId = readIdentifier(value.shopId);
  const name = readString(value.name, 120);
  if (!shopId || !name) return null;
  return {
    shopId,
    name,
    currencyId: readIdentifier(value.currencyId) ?? undefined,
  };
}

function validateRelationshipPayload(
  value: Record<string, unknown>
): RelationshipUpdatePayload | null {
  const characterId = readIdentifier(value.characterId);
  const label = readString(value.label, 120);
  if (!characterId || !label) return null;
  return {
    characterId,
    label,
    previousLabel: readString(value.previousLabel, 120) || undefined,
    memory: readString(value.memory, 1200) || undefined,
  };
}

function validateChoices(value: unknown): NarrativeFrame["choices"] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 4).flatMap((choice, index) => {
    if (!isRecord(choice)) return [];
    const text = readString(choice.text, 500);
    if (!text) return [];
    return [{ label: readString(choice.label, 8) || String.fromCharCode(65 + index), text }];
  });
}

function validateStatePatch(value: unknown): WorldStatePatch {
  if (!isRecord(value)) return {};
  const currencies = isRecord(value.currencies)
    ? Object.fromEntries(
        Object.entries(value.currencies).flatMap(([key, amount]) =>
          readIdentifier(key) && typeof amount === "number" && Number.isFinite(amount)
            ? [[key, amount]]
            : []
        )
      )
    : undefined;
  const flags = isRecord(value.flags)
    ? Object.fromEntries(
        Object.entries(value.flags).flatMap(([key, flag]) =>
          readIdentifier(key) &&
          (typeof flag === "boolean" || typeof flag === "string" || typeof flag === "number")
            ? [[key, flag]]
            : []
        )
      )
    : undefined;
  return {
    storyTime: readString(value.storyTime, 120) || undefined,
    currentLocationId: readIdentifier(value.currentLocationId) ?? undefined,
    flags,
    currencies,
  };
}

function validateIllustrationCue(value: unknown): IllustrationCue | undefined {
  if (!isRecord(value)) return undefined;
  const reason = readString(value.reason, 160);
  if (!reason) return undefined;
  return {
    reason,
    promptHint: readString(value.promptHint, 600) || undefined,
    characterIds: Array.isArray(value.characterIds)
      ? value.characterIds.flatMap((item) => readIdentifier(item) ?? []).slice(0, 8)
      : undefined,
  };
}

function readIdentifier(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const result = value.trim();
  return result.length > 0 && result.length <= 128 && /^[\w:-]+$/u.test(result)
    ? result
    : null;
}

function readString(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ")
    .trim()
    .slice(0, maxLength);
}

function readPositiveInteger(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const result = Math.trunc(value);
  return result > 0 && result <= 9999 ? result : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

import type {
  NarrativeEvent,
  NarrativeFrame,
  NarrativeModuleId,
  WorldState,
} from "@/types";

interface ApplyNarrativeFrameOptions {
  messageModule?: "messages" | "team_channel";
}

export function createInitialWorldState(gameId: string): WorldState {
  return {
    id: gameId,
    gameId,
    schemaVersion: 1,
    frameSequence: -1,
    eventCursor: 0,
    flags: {},
    currencies: {},
    unreadByModule: {},
    appliedEventIds: [],
    messages: {},
    forumPosts: [],
    calendarEntries: [],
    quests: {},
    inventory: {},
    unlockedShops: {},
    relationships: {},
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 将一帧白名单事件物化为可直接渲染的世界状态。
 * appliedEventIds 保证重放和请求重试不会重复发消息、道具或未读数。
 */
export function applyNarrativeFrameToState(
  currentState: WorldState,
  frame: NarrativeFrame,
  options: ApplyNarrativeFrameOptions = {}
): WorldState {
  const next = structuredClone(currentState);
  const appliedIds = new Set(next.appliedEventIds);
  let appliedCount = 0;

  for (const event of frame.events) {
    if (appliedIds.has(event.id)) continue;
    applyEvent(next, event, options);
    appliedIds.add(event.id);
    appliedCount += 1;
  }

  if (frame.statePatch.storyTime !== undefined) {
    next.storyTime = frame.statePatch.storyTime;
  }
  if (frame.statePatch.currentLocationId !== undefined) {
    next.currentLocationId = frame.statePatch.currentLocationId;
  }
  if (frame.statePatch.flags) {
    Object.assign(next.flags, frame.statePatch.flags);
  }
  if (frame.statePatch.currencies) {
    Object.assign(next.currencies, frame.statePatch.currencies);
  }

  next.appliedEventIds = [...appliedIds];
  next.eventCursor += appliedCount;
  next.frameSequence = Math.max(next.frameSequence, frame.sequence);
  next.updatedAt = new Date().toISOString();
  return next;
}

function applyEvent(
  state: WorldState,
  event: NarrativeEvent,
  options: ApplyNarrativeFrameOptions
) {
  switch (event.type) {
    case "message.receive": {
      const list = state.messages[event.payload.conversationId] ?? [];
      list.push({
        ...event.payload,
        eventId: event.id,
        read: false,
      });
      state.messages[event.payload.conversationId] = list;
      incrementUnread(state, options.messageModule ?? "messages");
      return;
    }
    case "forum.post": {
      state.forumPosts = [
        ...state.forumPosts.filter(
          (post) => post.postId !== event.payload.postId
        ),
        { ...event.payload, eventId: event.id, read: false },
      ];
      incrementUnread(state, "forum");
      return;
    }
    case "calendar.add": {
      state.calendarEntries = [
        ...state.calendarEntries.filter(
          (entry) => entry.entryId !== event.payload.entryId
        ),
        event.payload,
      ];
      incrementUnread(state, "calendar");
      return;
    }
    case "quest.update": {
      state.quests[event.payload.questId] = event.payload;
      incrementUnread(state, "system_panel");
      return;
    }
    case "inventory.grant": {
      const existing = state.inventory[event.payload.itemId];
      state.inventory[event.payload.itemId] = {
        ...event.payload,
        quantity: (existing?.quantity ?? 0) + event.payload.quantity,
      };
      incrementUnread(state, "inventory");
      return;
    }
    case "shop.unlock": {
      state.unlockedShops[event.payload.shopId] = event.payload;
      incrementUnread(state, "shop");
      return;
    }
    case "relationship.update": {
      state.relationships[event.payload.characterId] = event.payload;
      incrementUnread(state, "relationships");
    }
  }
}

function incrementUnread(state: WorldState, moduleId: NarrativeModuleId) {
  state.unreadByModule[moduleId] =
    (state.unreadByModule[moduleId] ?? 0) + 1;
}

export function markNarrativeModuleRead(
  currentState: WorldState,
  moduleId: NarrativeModuleId
): WorldState {
  const next = structuredClone(currentState);
  next.unreadByModule[moduleId] = 0;
  if (moduleId === "messages" || moduleId === "team_channel") {
    Object.values(next.messages).forEach((messages) => {
      messages.forEach((message) => {
        message.read = true;
      });
    });
  }
  if (moduleId === "forum") {
    next.forumPosts.forEach((post) => {
      post.read = true;
    });
  }
  next.updatedAt = new Date().toISOString();
  return next;
}

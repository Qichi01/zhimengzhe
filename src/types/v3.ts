// ============================================================
// 织梦者 V3.0 统一叙事协议
// ============================================================

export type NarrativeCriticality = "ordinary" | "key" | "climax";

export type NarrativeEventType =
  | "message.receive"
  | "forum.post"
  | "calendar.add"
  | "quest.update"
  | "inventory.grant"
  | "shop.unlock"
  | "relationship.update";

export type NarrativeEventVisibility =
  | "immediate"
  | "after_prose"
  | "on_module_open";

export type NarrativeModuleId =
  | "reader"
  | "messages"
  | "moments"
  | "forum"
  | "calendar"
  | "system_panel"
  | "team_channel"
  | "inventory"
  | "shop"
  | "relationships"
  | "archive";

export type NarrativeGenreId =
  | "campus_otome"
  | "infinite_flow"
  | "mystery"
  | "general_fantasy";

interface NarrativeEventBase<
  TType extends NarrativeEventType,
  TPayload
> {
  id: string;
  type: TType;
  payload: TPayload;
  visibleAt: NarrativeEventVisibility;
}

export interface MessageReceivePayload {
  conversationId: string;
  senderCharacterId: string;
  content: string;
  messageKind: "text" | "image" | "system";
  imageAssetId?: string;
}

export interface ForumPostPayload {
  postId: string;
  board: string;
  title: string;
  content: string;
  authorCharacterId?: string;
  reliability?: "verified" | "rumor" | "unknown";
}

export interface CalendarAddPayload {
  entryId: string;
  title: string;
  storyTime: string;
  locationId?: string;
  description?: string;
}

export interface QuestUpdatePayload {
  questId: string;
  title: string;
  status: "hidden" | "active" | "completed" | "failed";
  description?: string;
  progressLabel?: string;
}

export interface InventoryGrantPayload {
  itemId: string;
  name: string;
  quantity: number;
  description?: string;
  source?: string;
}

export interface ShopUnlockPayload {
  shopId: string;
  name: string;
  currencyId?: string;
}

export interface RelationshipUpdatePayload {
  characterId: string;
  label: string;
  previousLabel?: string;
  memory?: string;
}

export type NarrativeEvent =
  | NarrativeEventBase<"message.receive", MessageReceivePayload>
  | NarrativeEventBase<"forum.post", ForumPostPayload>
  | NarrativeEventBase<"calendar.add", CalendarAddPayload>
  | NarrativeEventBase<"quest.update", QuestUpdatePayload>
  | NarrativeEventBase<"inventory.grant", InventoryGrantPayload>
  | NarrativeEventBase<"shop.unlock", ShopUnlockPayload>
  | NarrativeEventBase<"relationship.update", RelationshipUpdatePayload>;

export interface WorldStatePatch {
  storyTime?: string;
  currentLocationId?: string;
  flags?: Record<string, boolean | string | number>;
  currencies?: Record<string, number>;
}

export interface IllustrationCue {
  reason: string;
  promptHint?: string;
  characterIds?: string[];
}

export interface NarrativeFrame {
  id: string;
  gameId: string;
  sequence: number;
  prose: string;
  choices: Array<{ label: string; text: string }>;
  criticality: NarrativeCriticality;
  events: NarrativeEvent[];
  statePatch: WorldStatePatch;
  illustrationCue?: IllustrationCue;
  createdAt: string;
}

export type StoredNarrativeEvent = NarrativeEvent & {
  gameId: string;
  frameId: string;
  frameSequence: number;
  createdAt: string;
};

export interface WorldCharacterDefinition {
  id: string;
  name: string;
  role: "protagonist" | "major" | "minor";
  description: string;
  appearance?: string;
}

export interface VisualBible {
  artStyle: string;
  palette: string[];
  era?: string;
  forbiddenElements: string[];
}

export interface WorldDefinition {
  id: string;
  gameId: string;
  schemaVersion: 1;
  title: string;
  primaryGenre: NarrativeGenreId;
  enabledModules: NarrativeModuleId[];
  characters: WorldCharacterDefinition[];
  locations: Array<{ id: string; name: string; description: string }>;
  rules: string[];
  visualBible: VisualBible;
  sourceHash?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NarrativeMessage extends MessageReceivePayload {
  eventId: string;
  read: boolean;
}

export interface NarrativeForumPost extends ForumPostPayload {
  eventId: string;
  read: boolean;
}

export interface NarrativeInventoryItem {
  itemId: string;
  name: string;
  quantity: number;
  description?: string;
  source?: string;
}

export interface WorldState {
  id: string;
  gameId: string;
  schemaVersion: 1;
  frameSequence: number;
  eventCursor: number;
  storyTime?: string;
  currentLocationId?: string;
  flags: Record<string, boolean | string | number>;
  currencies: Record<string, number>;
  unreadByModule: Partial<Record<NarrativeModuleId, number>>;
  appliedEventIds: string[];
  messages: Record<string, NarrativeMessage[]>;
  forumPosts: NarrativeForumPost[];
  calendarEntries: CalendarAddPayload[];
  quests: Record<string, QuestUpdatePayload>;
  inventory: Record<string, NarrativeInventoryItem>;
  unlockedShops: Record<string, ShopUnlockPayload>;
  relationships: Record<string, RelationshipUpdatePayload>;
  updatedAt: string;
}

export interface NarrativeModuleDefinition {
  id: NarrativeModuleId;
  label: string;
  eventTypes: NarrativeEventType[];
  unlockPolicy: "always" | "first_event" | "explicit";
}

export interface GenrePackDefinition {
  id: NarrativeGenreId;
  version: string;
  label: string;
  modules: NarrativeModuleDefinition[];
  allowedEventTypes: NarrativeEventType[];
  themeTokens: Record<string, string>;
}

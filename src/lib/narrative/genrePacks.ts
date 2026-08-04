import type {
  GenrePackDefinition,
  NarrativeGenreId,
  NarrativeModuleDefinition,
} from "@/types";

const readerModule: NarrativeModuleDefinition = {
  id: "reader",
  label: "正文",
  eventTypes: [],
  unlockPolicy: "always",
};

const relationshipsModule: NarrativeModuleDefinition = {
  id: "relationships",
  label: "角色",
  eventTypes: ["relationship.update"],
  unlockPolicy: "first_event",
};

export const campusOtomePack: GenrePackDefinition = {
  id: "campus_otome",
  version: "3.0.0-alpha.1",
  label: "校园乙游",
  modules: [
    readerModule,
    {
      id: "messages",
      label: "私聊",
      eventTypes: ["message.receive"],
      unlockPolicy: "first_event",
    },
    {
      id: "moments",
      label: "动态",
      eventTypes: [],
      unlockPolicy: "explicit",
    },
    {
      id: "forum",
      label: "校园论坛",
      eventTypes: ["forum.post"],
      unlockPolicy: "first_event",
    },
    {
      id: "calendar",
      label: "日历",
      eventTypes: ["calendar.add"],
      unlockPolicy: "first_event",
    },
    relationshipsModule,
    {
      id: "archive",
      label: "档案",
      eventTypes: [],
      unlockPolicy: "always",
    },
  ],
  allowedEventTypes: [
    "message.receive",
    "forum.post",
    "calendar.add",
    "relationship.update",
  ],
  themeTokens: {
    shell: "campus-phone",
    accent: "#d9a7c7",
    surface: "#fffafc",
  },
};

export const infiniteFlowPack: GenrePackDefinition = {
  id: "infinite_flow",
  version: "3.0.0-alpha.1",
  label: "无限流",
  modules: [
    readerModule,
    {
      id: "system_panel",
      label: "系统",
      eventTypes: ["quest.update"],
      unlockPolicy: "always",
    },
    {
      id: "team_channel",
      label: "队伍频道",
      eventTypes: ["message.receive"],
      unlockPolicy: "first_event",
    },
    {
      id: "inventory",
      label: "背包",
      eventTypes: ["inventory.grant"],
      unlockPolicy: "first_event",
    },
    {
      id: "shop",
      label: "系统商店",
      eventTypes: ["shop.unlock"],
      unlockPolicy: "explicit",
    },
    {
      id: "forum",
      label: "玩家论坛",
      eventTypes: ["forum.post"],
      unlockPolicy: "first_event",
    },
    relationshipsModule,
    {
      id: "archive",
      label: "档案",
      eventTypes: [],
      unlockPolicy: "always",
    },
  ],
  allowedEventTypes: [
    "message.receive",
    "forum.post",
    "quest.update",
    "inventory.grant",
    "shop.unlock",
    "relationship.update",
  ],
  themeTokens: {
    shell: "system-terminal",
    accent: "#71f5c2",
    surface: "#101714",
  },
};

const genrePacks: Record<
  "campus_otome" | "infinite_flow",
  GenrePackDefinition
> = {
  campus_otome: campusOtomePack,
  infinite_flow: infiniteFlowPack,
};

export function getGenrePack(
  genreId: NarrativeGenreId
): GenrePackDefinition | null {
  if (genreId === "campus_otome" || genreId === "infinite_flow") {
    return genrePacks[genreId];
  }
  return null;
}

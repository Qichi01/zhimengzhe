import { getDeviceId, openLocalDb } from "@/lib/localDb";
import type {
  Character,
  Game,
  GameType,
  NarrativeGenreId,
  NarrativeModuleId,
  StorySource,
  StorySourceFormat,
  WorldCreationDraft,
  WorldDefinition,
} from "@/types";
import { getGenrePack } from "./genrePacks";

interface CreateWorldDraftInput {
  title?: string;
  primaryGenre: "campus_otome" | "infinite_flow";
  sourceFormat: StorySourceFormat;
  sourceFileName?: string;
  sourceText: string;
}

const AVATAR_COLORS = [
  "#ffd76b",
  "#c8aaff",
  "#ffb3d9",
  "#8fd9d2",
  "#a3d4ff",
  "#f0a8a8",
];

export async function createWorldCreationDraft({
  title,
  primaryGenre,
  sourceFormat,
  sourceFileName,
  sourceText,
}: CreateWorldDraftInput): Promise<WorldCreationDraft> {
  const cleanSource = sourceText.trim();
  if (!cleanSource) throw new Error("故事内容不能为空");
  const genrePack = getGenrePack(primaryGenre);
  if (!genrePack) throw new Error("暂不支持该题材包");
  const now = new Date().toISOString();
  const draft: WorldCreationDraft = {
    id: crypto.randomUUID(),
    title: deriveTitle(title, sourceFileName, cleanSource),
    primaryGenre,
    sourceFormat,
    sourceFileName,
    sourceText: cleanSource,
    summary: deriveSummary(cleanSource),
    characters: [
      {
        id: crypto.randomUUID(),
        name: "主角",
        role: "protagonist",
        description: "玩家在故事中的角色",
      },
    ],
    enabledModules: genrePack.modules.map((module) => module.id),
    artStyle:
      primaryGenre === "campus_otome"
        ? "清透细腻的校园乙女游戏插画"
        : "明快舒适、有冲击力的多世界冒险插画，突出成长、任务推进与爽感，适合全年龄用户",
    createdAt: now,
    updatedAt: now,
  };
  await putDraft(draft);
  return draft;
}

export async function getWorldCreationDraft(
  draftId: string
): Promise<WorldCreationDraft | null> {
  const db = await openLocalDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("world_drafts", "readonly");
    const request = tx.objectStore("world_drafts").get(draftId);
    request.onsuccess = () =>
      resolve((request.result as WorldCreationDraft | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
}

export async function saveWorldCreationDraft(
  draft: WorldCreationDraft
): Promise<void> {
  await putDraft({ ...draft, updatedAt: new Date().toISOString() });
}

export async function deleteWorldCreationDraft(draftId: string): Promise<void> {
  const db = await openLocalDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("world_drafts", "readwrite");
    tx.objectStore("world_drafts").delete(draftId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** 确认世界档案后，在一个事务里创建游戏、角色、来源和 WorldDefinition。 */
export async function confirmWorldCreationDraft(
  draft: WorldCreationDraft
): Promise<Game> {
  const title = draft.title.trim().slice(0, 30);
  const summary = draft.summary.trim().slice(0, 4000);
  const characters = draft.characters
    .map((character) => ({
      ...character,
      name: character.name.trim().slice(0, 40),
      description: character.description.trim().slice(0, 1200),
    }))
    .filter((character) => character.name);
  if (!title || !summary || characters.length === 0) {
    throw new Error("请补全世界名称、简介和主角信息");
  }
  if (!characters.some((character) => character.role === "protagonist")) {
    throw new Error("世界档案必须包含一位主角");
  }

  const genrePack = getGenrePack(draft.primaryGenre);
  if (!genrePack) throw new Error("暂不支持该题材包");
  const allowedModules = new Set(genrePack.modules.map((module) => module.id));
  const enabledModules = draft.enabledModules.filter((module) =>
    allowedModules.has(module)
  );
  if (!enabledModules.includes("reader")) enabledModules.unshift("reader");

  const now = new Date().toISOString();
  const gameId = crypto.randomUUID();
  const sourceId = crypto.randomUUID();
  const gameType = genreToGameType(draft.primaryGenre);
  const game: Game = {
    id: gameId,
    user_id: getDeviceId(),
    title,
    type: gameType,
    setting: summary,
    cover_color: draft.primaryGenre === "campus_otome" ? "#ffb3d9" : "#71f5c2",
    experience_version: "v3",
    genre_pack_id: draft.primaryGenre,
    world_definition_id: gameId,
    status: "active",
    last_played_at: now,
    created_at: now,
    updated_at: now,
  };
  const storySource: StorySource = {
    id: sourceId,
    gameId,
    format: draft.sourceFormat,
    fileName: draft.sourceFileName,
    content: draft.sourceText,
    characterCount: draft.sourceText.length,
    createdAt: now,
  };
  const sourceHash = await hashText(draft.sourceText);
  const definition: WorldDefinition = {
    id: gameId,
    gameId,
    schemaVersion: 1,
    title,
    primaryGenre: draft.primaryGenre,
    enabledModules,
    characters: characters.map((character) => ({
      id: character.id,
      name: character.name,
      role: character.role,
      description: character.description,
    })),
    locations: [],
    rules: [],
    visualBible: {
      artStyle: draft.artStyle.trim().slice(0, 500),
      palette:
        draft.primaryGenre === "campus_otome"
          ? ["#ffb3d9", "#f8e8f1", "#8d6f9f"]
          : ["#71f5c2", "#183c32", "#d9fff1"],
      forbiddenElements: [
        "文字水印",
        "界面截图",
        "角色外观突变",
        "恐怖血腥画面",
        "色情裸露内容",
        "多角色头像",
        "全身头像",
      ],
    },
    sourceHash,
    createdAt: now,
    updatedAt: now,
  };
  const characterRecords: Character[] = characters.map((character, index) => ({
    id: character.id,
    game_id: gameId,
    name: character.name,
    description: character.description || null,
    role: character.role,
    first_appearance_chapter: 1,
    avatar_color: AVATAR_COLORS[index % AVATAR_COLORS.length],
    avatar: null,
    avatar_auto_attempted_at: null,
    created_at: now,
  }));

  const db = await openLocalDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(
      ["games", "story_sources", "world_definitions", "characters", "world_drafts"],
      "readwrite"
    );
    tx.objectStore("games").put(game);
    tx.objectStore("story_sources").put(storySource);
    tx.objectStore("world_definitions").put(definition);
    const characterStore = tx.objectStore("characters");
    characterRecords.forEach((character) => characterStore.put(character));
    tx.objectStore("world_drafts").delete(draft.id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("世界档案创建已取消"));
  });
  return game;
}

function deriveTitle(
  title: string | undefined,
  fileName: string | undefined,
  sourceText: string
): string {
  const explicit = title?.trim();
  if (explicit) return explicit.slice(0, 30);
  const heading = sourceText
    .split("\n")
    .map((line) => line.replace(/^#+\s*/, "").trim())
    .find(Boolean);
  const fileTitle = fileName?.replace(/\.(txt|md|markdown)$/i, "").trim();
  return (fileTitle || heading || "未命名世界").slice(0, 30);
}

function deriveSummary(sourceText: string): string {
  return sourceText
    .replace(/^#+\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1000);
}

function genreToGameType(genre: NarrativeGenreId): GameType {
  if (genre === "campus_otome") return "otome";
  if (genre === "mystery") return "mystery";
  return "other";
}

async function putDraft(draft: WorldCreationDraft): Promise<void> {
  const db = await openLocalDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("world_drafts", "readwrite");
    tx.objectStore("world_drafts").put(draft);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function hashText(text: string): Promise<string | undefined> {
  try {
    const bytes = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return undefined;
  }
}

export function getDefaultModulesForGenre(
  genre: "campus_otome" | "infinite_flow"
): NarrativeModuleId[] {
  return getGenrePack(genre)?.modules.map((module) => module.id) ?? ["reader"];
}

// ============================================================
// 织梦者 V2.1 本地 IndexedDB 数据库层
// 说明：游客模式下所有数据存本地，登录后可选同步到 Supabase
// ============================================================

import type {
  Game,
  Chapter,
  SceneRecord,
  Save,
  Character,
  Relationship,
  Clue,
  GameMap,
  GameType,
  SaveType,
  CharacterRole,
} from "@/types";

const DB_NAME = "zhimengzhe-local";
const DB_VERSION = 1;

/** 获取或生成设备 ID（用于本地数据隔离） */
export function getDeviceId(): string {
  if (typeof window === "undefined") return "server";
  let id = localStorage.getItem("zhimengzhe_device_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("zhimengzhe_device_id", id);
  }
  return id;
}

/** 打开 IndexedDB */
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB not available"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("games")) {
        const store = db.createObjectStore("games", { keyPath: "id" });
        store.createIndex("user_id", "user_id", { unique: false });
      }
      [
        "chapters",
        "scenes",
        "saves",
        "characters",
        "relationships",
        "clues",
        "maps",
      ].forEach((name) => {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: "id" });
        }
      });
    };
  });
}

/** 通用：获取单个记录 */
async function getOne<T>(
  storeName: string,
  id: string
): Promise<T | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

/** 通用：获取全部记录 */
async function getAll<T>(storeName: string): Promise<T[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => reject(req.error);
  });
}

/** 通用：按索引查询 */
async function getByIndex<T>(
  storeName: string,
  indexName: string,
  value: string | number
): Promise<T[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const idx = store.index(indexName);
    const req = idx.getAll(value);
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => reject(req.error);
  });
}

/** 通用：写入记录 */
async function putRecord(storeName: string, record: unknown): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** 通用：删除记录 */
async function deleteRecord(storeName: string, id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ============================================================
// 游戏相关
// ============================================================

export async function getGames(
  _userId: string,
  page = 1,
  pageSize = 8
): Promise<{ data: Game[] | null; count: number | null; error: string | null }> {
  try {
    const deviceId = getDeviceId();
    const all = await getByIndex<Game>("games", "user_id", deviceId);
    // 按最后游玩时间倒序
    all.sort(
      (a, b) =>
        new Date(b.last_played_at ?? b.created_at).getTime() -
        new Date(a.last_played_at ?? a.created_at).getTime()
    );
    const from = (page - 1) * pageSize;
    const to = from + pageSize;
    const sliced = all.slice(from, to);
    return { data: sliced, count: all.length, error: null };
  } catch (e) {
    return { data: null, count: null, error: String(e) };
  }
}

export async function getGame(
  gameId: string
): Promise<{ data: Game | null; error: string | null }> {
  try {
    const data = await getOne<Game>("games", gameId);
    return { data, error: null };
  } catch (e) {
    return { data: null, error: String(e) };
  }
}

export async function createGame(
  _userId: string,
  title: string,
  type: GameType,
  setting: string,
  coverColor = "#c8aaff"
): Promise<{ data: Game | null; error: string | null }> {
  try {
    const now = new Date().toISOString();
    const game: Game = {
      id: crypto.randomUUID(),
      user_id: getDeviceId(),
      title,
      type,
      setting,
      cover_color: coverColor,
      status: "active",
      last_played_at: now,
      created_at: now,
      updated_at: now,
    };
    await putRecord("games", game);
    return { data: game, error: null };
  } catch (e) {
    return { data: null, error: String(e) };
  }
}

export async function touchGame(gameId: string): Promise<void> {
  try {
    const game = await getOne<Game>("games", gameId);
    if (game) {
      game.last_played_at = new Date().toISOString();
      game.updated_at = new Date().toISOString();
      await putRecord("games", game);
    }
  } catch {
    /* ignore */
  }
}

export async function deleteGame(
  gameId: string
): Promise<{ error: string | null }> {
  try {
    await clearGameData(gameId);
    await deleteRecord("games", gameId);
    return { error: null };
  } catch (e) {
    return { error: String(e) };
  }
}

/**
 * 清空指定游戏的所有进度数据（保留游戏记录本身）
 * 用于「新的开始」时重置剧情进度
 */
export async function clearGameData(gameId: string): Promise<void> {
  const chapters = await getChapters(gameId);
  for (const c of chapters.data ?? []) {
    await deleteRecord("chapters", c.id);
  }
  const scenes = await getScenes(gameId);
  for (const s of scenes.data ?? []) {
    await deleteRecord("scenes", s.id);
  }
  const saves = await getSaves(gameId);
  for (const s of saves.data ?? []) {
    await deleteRecord("saves", s.id);
  }
  const characters = await getCharacters(gameId);
  for (const c of characters.data ?? []) {
    await deleteRecord("characters", c.id);
  }
  const relationships = await getRelationships(gameId);
  for (const r of relationships.data ?? []) {
    await deleteRecord("relationships", r.id);
  }
  const clues = await getClues(gameId);
  for (const c of clues.data ?? []) {
    await deleteRecord("clues", c.id);
  }
  const maps = await getMaps(gameId);
  for (const m of maps.data ?? []) {
    await deleteRecord("maps", m.id);
  }
}

// ============================================================
// 章节相关
// ============================================================

export async function getChapters(
  gameId: string
): Promise<{ data: Chapter[] | null; error: string | null }> {
  try {
    const all = await getAll<Chapter>("chapters");
    const filtered = all
      .filter((c) => c.game_id === gameId)
      .sort((a, b) => a.chapter_number - b.chapter_number);
    return { data: filtered, error: null };
  } catch (e) {
    return { data: null, error: String(e) };
  }
}

export async function createChapter(
  gameId: string,
  chapterNumber: number,
  title?: string
): Promise<{ data: Chapter | null; error: string | null }> {
  try {
    const chapter: Chapter = {
      id: crypto.randomUUID(),
      game_id: gameId,
      chapter_number: chapterNumber,
      title: title ?? null,
      summary: null,
      status: "in_progress",
      created_at: new Date().toISOString(),
    };
    await putRecord("chapters", chapter);
    return { data: chapter, error: null };
  } catch (e) {
    return { data: null, error: String(e) };
  }
}

export async function updateChapterSummary(
  chapterId: string,
  summary: string
): Promise<{ error: string | null }> {
  try {
    const chapter = await getOne<Chapter>("chapters", chapterId);
    if (chapter) {
      chapter.summary = summary;
      chapter.status = "completed";
      await putRecord("chapters", chapter);
    }
    return { error: null };
  } catch (e) {
    return { error: String(e) };
  }
}

// ============================================================
// 场景相关
// ============================================================

export async function getScenes(
  gameId: string
): Promise<{ data: SceneRecord[] | null; error: string | null }> {
  try {
    const all = await getAll<SceneRecord>("scenes");
    const filtered = all
      .filter((s) => s.game_id === gameId)
      .sort((a, b) => a.order_index - b.order_index);
    return { data: filtered, error: null };
  } catch (e) {
    return { data: null, error: String(e) };
  }
}

export async function getScenesByChapter(
  chapterId: string
): Promise<{ data: SceneRecord[] | null; error: string | null }> {
  try {
    const all = await getAll<SceneRecord>("scenes");
    const filtered = all
      .filter((s) => s.chapter_id === chapterId)
      .sort((a, b) => a.order_index - b.order_index);
    return { data: filtered, error: null };
  } catch (e) {
    return { data: null, error: String(e) };
  }
}

export async function createScene(
  scene: Omit<SceneRecord, "id" | "created_at">
): Promise<{ data: SceneRecord | null; error: string | null }> {
  try {
    const record: SceneRecord = {
      ...scene,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };
    await putRecord("scenes", record);
    return { data: record, error: null };
  } catch (e) {
    return { data: null, error: String(e) };
  }
}

export async function getNextSceneIndex(gameId: string): Promise<number> {
  try {
    const all = await getAll<SceneRecord>("scenes");
    const gameScenes = all.filter((s) => s.game_id === gameId);
    if (gameScenes.length === 0) return 0;
    return Math.max(...gameScenes.map((s) => s.order_index)) + 1;
  } catch {
    return 0;
  }
}

// ============================================================
// 存档相关
// ============================================================

export async function getSaves(
  gameId: string,
  saveType?: SaveType
): Promise<{ data: Save[] | null; error: string | null }> {
  try {
    const all = await getAll<Save>("saves");
    let filtered = all.filter((s) => s.game_id === gameId);
    if (saveType) filtered = filtered.filter((s) => s.save_type === saveType);
    filtered.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    return { data: filtered, error: null };
  } catch (e) {
    return { data: null, error: String(e) };
  }
}

export async function createSave(
  gameId: string,
  chapterId: string | null,
  sceneIndex: number,
  label: string,
  saveType: SaveType
): Promise<{ data: Save | null; error: string | null }> {
  try {
    const save: Save = {
      id: crypto.randomUUID(),
      game_id: gameId,
      chapter_id: chapterId,
      scene_index: sceneIndex,
      label,
      save_type: saveType,
      created_at: new Date().toISOString(),
    };
    await putRecord("saves", save);
    return { data: save, error: null };
  } catch (e) {
    return { data: null, error: String(e) };
  }
}

export async function deleteSave(
  saveId: string
): Promise<{ error: string | null }> {
  try {
    await deleteRecord("saves", saveId);
    return { error: null };
  } catch (e) {
    return { error: String(e) };
  }
}

export async function pruneAutoSaves(
  gameId: string,
  keepCount = 10
): Promise<void> {
  try {
    const { data } = await getSaves(gameId, "auto");
    if (!data || data.length <= keepCount) return;
    const toDelete = data.slice(keepCount);
    for (const save of toDelete) {
      await deleteRecord("saves", save.id);
    }
  } catch {
    /* ignore */
  }
}

// ============================================================
// 角色与关系
// ============================================================

export async function getCharacters(
  gameId: string
): Promise<{ data: Character[] | null; error: string | null }> {
  try {
    const all = await getAll<Character>("characters");
    const filtered = all
      .filter((c) => c.game_id === gameId)
      .sort((a, b) =>
        (a.created_at ?? "").localeCompare(b.created_at ?? "")
      );
    return { data: filtered, error: null };
  } catch (e) {
    return { data: null, error: String(e) };
  }
}

export async function upsertCharacter(
  character: Omit<Character, "id" | "created_at">
): Promise<{ data: Character | null; error: string | null }> {
  try {
    const all = await getAll<Character>("characters");
    const existing = all.find(
      (c) => c.game_id === character.game_id && c.name === character.name
    );
    if (existing) {
      existing.description = character.description;
      existing.role = character.role;
      await putRecord("characters", existing);
      return { data: existing, error: null };
    }
    const record: Character = {
      ...character,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };
    await putRecord("characters", record);
    return { data: record, error: null };
  } catch (e) {
    return { data: null, error: String(e) };
  }
}

export async function getRelationships(
  gameId: string
): Promise<{ data: Relationship[] | null; error: string | null }> {
  try {
    const all = await getAll<Relationship>("relationships");
    const filtered = all
      .filter((r) => r.game_id === gameId)
      .sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    return { data: filtered, error: null };
  } catch (e) {
    return { data: null, error: String(e) };
  }
}

export async function upsertRelationship(
  gameId: string,
  characterId: string,
  relationLabel: string
): Promise<{ error: string | null }> {
  try {
    const all = await getAll<Relationship>("relationships");
    const existing = all.find(
      (r) => r.game_id === gameId && r.character_id === characterId
    );
    if (existing) {
      if (existing.relation_label === relationLabel) return { error: null };
      existing.previous_label = existing.relation_label;
      existing.relation_label = relationLabel;
      existing.updated_at = new Date().toISOString();
      await putRecord("relationships", existing);
      return { error: null };
    }
    const record: Relationship = {
      id: crypto.randomUUID(),
      game_id: gameId,
      character_id: characterId,
      relation_label: relationLabel,
      previous_label: null,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    await putRecord("relationships", record);
    return { error: null };
  } catch (e) {
    return { error: String(e) };
  }
}

// ============================================================
// 线索
// ============================================================

export async function getClues(
  gameId: string
): Promise<{ data: Clue[] | null; error: string | null }> {
  try {
    const all = await getAll<Clue>("clues");
    const filtered = all
      .filter((c) => c.game_id === gameId)
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    return { data: filtered, error: null };
  } catch (e) {
    return { data: null, error: String(e) };
  }
}

export async function createClue(
  gameId: string,
  content: string,
  note?: string
): Promise<{ data: Clue | null; error: string | null }> {
  try {
    const clue: Clue = {
      id: crypto.randomUUID(),
      game_id: gameId,
      content,
      note: note ?? null,
      map_id: null,
      created_at: new Date().toISOString(),
    };
    await putRecord("clues", clue);
    return { data: clue, error: null };
  } catch (e) {
    return { data: null, error: String(e) };
  }
}

export async function updateClueNote(
  clueId: string,
  note: string
): Promise<{ error: string | null }> {
  try {
    const clue = await getOne<Clue>("clues", clueId);
    if (clue) {
      clue.note = note;
      await putRecord("clues", clue);
    }
    return { error: null };
  } catch (e) {
    return { error: String(e) };
  }
}

export async function deleteClue(
  clueId: string
): Promise<{ error: string | null }> {
  try {
    await deleteRecord("clues", clueId);
    return { error: null };
  } catch (e) {
    return { error: String(e) };
  }
}

// ============================================================
// 地图
// ============================================================

export async function getMaps(
  gameId: string
): Promise<{ data: GameMap[] | null; error: string | null }> {
  try {
    const all = await getAll<GameMap>("maps");
    const filtered = all
      .filter((m) => m.game_id === gameId)
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    return { data: filtered, error: null };
  } catch (e) {
    return { data: null, error: String(e) };
  }
}

export async function createMap(
  gameId: string,
  title: string,
  layoutData: object,
  chapterId?: string,
  svgContent?: string
): Promise<{ data: GameMap | null; error: string | null }> {
  try {
    const map: GameMap = {
      id: crypto.randomUUID(),
      game_id: gameId,
      chapter_id: chapterId ?? null,
      title,
      layout_data: layoutData as { rooms: import("@/types").MapRoom[] },
      svg_content: svgContent ?? null,
      created_at: new Date().toISOString(),
    };
    await putRecord("maps", map);
    return { data: map, error: null };
  } catch (e) {
    return { data: null, error: String(e) };
  }
}

// ============================================================
// 本地会员缓存 + 兑换码
// ============================================================

const LOCAL_PROFILE_KEY = "zhimengzhe_local_profile";
const REDEEM_CODES_KEY = "zhimengzhe_redeem_codes";

/** 本地缓存的会员信息 */
export interface LocalProfile {
  free_trial_used: number;
  membership_plan: "free" | "monthly" | "quarterly";
  membership_expires_at: string | null;
  last_synced_at: string | null;
}

export function getLocalProfile(): LocalProfile {
  if (typeof window === "undefined") {
    return {
      free_trial_used: 0,
      membership_plan: "free",
      membership_expires_at: null,
      last_synced_at: null,
    };
  }
  const raw = localStorage.getItem(LOCAL_PROFILE_KEY);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      /* ignore */
    }
  }
  return {
    free_trial_used: 0,
    membership_plan: "free",
    membership_expires_at: null,
    last_synced_at: null,
  };
}

export function setLocalProfile(profile: LocalProfile): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(profile));
}

/** 增加本地免费体验次数 */
export function incrementLocalFreeTrial(): void {
  const profile = getLocalProfile();
  profile.free_trial_used += 1;
  setLocalProfile(profile);
}

/** 检查本地会员是否有效 */
export function isLocalMembershipActive(): boolean {
  const profile = getLocalProfile();
  if (profile.membership_plan === "free") return false;
  if (!profile.membership_expires_at) return false;
  return new Date(profile.membership_expires_at).getTime() > Date.now();
}

/** 兑换码结构 */
export interface RedeemCode {
  code: string;
  plan: "monthly" | "quarterly";
  expires_at: string;
  redeemed_at: string;
}

/** 验证并应用兑换码（简单版：硬编码一批有效码） */
export function validateAndApplyRedeemCode(code: string): {
  ok: boolean;
  error?: string;
} {
  if (typeof window === "undefined") return { ok: false, error: "服务端不可用" };

  const normalized = code.trim().toUpperCase().replace(/-/g, "");

  // 简单校验规则：16位字母数字
  if (!/^[A-Z0-9]{16}$/.test(normalized)) {
    return { ok: false, error: "兑换码格式不正确" };
  }

  // 检查是否已使用过
  const used = getUsedRedeemCodes();
  if (used.includes(normalized)) {
    return { ok: false, error: "该兑换码已被使用" };
  }

  // 模拟校验：取前8位作为"批次号"，偶数位为有效码
  // 实际生产环境应该调用后端 API 验证
  const batchPrefix = normalized.slice(0, 8);
  const checksum = normalized
    .slice(8)
    .split("")
    .reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const isValid = checksum % 7 === 0; // 简单校验算法

  if (!isValid) {
    return { ok: false, error: "兑换码无效" };
  }

  // 判断套餐：根据 batchPrefix 的第一个字符
  const plan: "monthly" | "quarterly" =
    parseInt(batchPrefix[0], 36) % 2 === 0 ? "monthly" : "quarterly";

  const now = new Date();
  const expiresAt = new Date(now);
  if (plan === "monthly") expiresAt.setMonth(expiresAt.getMonth() + 1);
  else expiresAt.setMonth(expiresAt.getMonth() + 3);

  // 保存兑换记录
  const record: RedeemCode = {
    code: normalized,
    plan,
    expires_at: expiresAt.toISOString(),
    redeemed_at: now.toISOString(),
  };
  saveRedeemCode(record);

  // 更新本地会员状态
  const profile = getLocalProfile();
  profile.membership_plan = plan;
  profile.membership_expires_at = expiresAt.toISOString();
  setLocalProfile(profile);

  return { ok: true };
}

function getUsedRedeemCodes(): string[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(REDEEM_CODES_KEY);
  if (!raw) return [];
  try {
    const records: RedeemCode[] = JSON.parse(raw);
    return records.map((r) => r.code);
  } catch {
    return [];
  }
}

function saveRedeemCode(record: RedeemCode): void {
  if (typeof window === "undefined") return;
  const existing = getUsedRedeemCodes();
  const raw = localStorage.getItem(REDEEM_CODES_KEY);
  const records: RedeemCode[] = raw ? JSON.parse(raw) : [];
  records.push(record);
  localStorage.setItem(REDEEM_CODES_KEY, JSON.stringify(records));
}

/** 获取当前有效会员计划（本地视角） */
export function getCurrentMembershipPlan(): {
  plan: "free" | "monthly" | "quarterly";
  isActive: boolean;
  freeTrialsUsed: number;
} {
  const profile = getLocalProfile();
  const isActive =
    profile.membership_plan !== "free" &&
    profile.membership_expires_at !== null &&
    new Date(profile.membership_expires_at).getTime() > Date.now();
  return {
    plan: isActive ? profile.membership_plan : "free",
    isActive,
    freeTrialsUsed: profile.free_trial_used,
  };
}

// ============================================================
// 数据导出（用于登录后上传到云端或手动备份）
// ============================================================

export async function exportAllLocalData(): Promise<{
  games: Game[];
  chapters: Chapter[];
  scenes: SceneRecord[];
  saves: Save[];
  characters: Character[];
  relationships: Relationship[];
  clues: Clue[];
  maps: GameMap[];
}> {
  const [games, chapters, scenes, saves, characters, relationships, clues, maps] =
    await Promise.all([
      getAll<Game>("games"),
      getAll<Chapter>("chapters"),
      getAll<SceneRecord>("scenes"),
      getAll<Save>("saves"),
      getAll<Character>("characters"),
      getAll<Relationship>("relationships"),
      getAll<Clue>("clues"),
      getAll<GameMap>("maps"),
    ]);
  return { games, chapters, scenes, saves, characters, relationships, clues, maps };
}

/** 清空所有本地数据（慎用） */
export async function clearAllLocalData(): Promise<void> {
  const db = await openDb();
  const stores = [
    "games",
    "chapters",
    "scenes",
    "saves",
    "characters",
    "relationships",
    "clues",
    "maps",
  ];
  for (const name of stores) {
    const tx = db.transaction(name, "readwrite");
    const store = tx.objectStore(name);
    store.clear();
  }
}
